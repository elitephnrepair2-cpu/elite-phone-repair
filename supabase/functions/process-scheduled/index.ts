import { dispatchSms } from '../_shared/smsDispatch.ts';
import { authorize } from '../_shared/authorization.ts';
import { serve, createClient } from "../_shared/runtime.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const denied = await authorize(req, { worker: true, headers: corsHeaders });
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration missing');

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // The database atomically changes pending -> sending and returns only our claim.
    const { data: pendingCampaigns, error: fetchErr } = await supabaseClient.rpc('crm_claim_scheduled_campaigns')

    if (fetchErr) {
      throw new Error("Failed to fetch pending campaigns: " + fetchErr.message)
    }

    if (!pendingCampaigns || pendingCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No pending scheduled campaigns due." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    // 2. Loop through and process each due campaign
    for (const campaign of pendingCampaigns) {
      // Fetch target customers matching the location and consented to marketing (paginated to bypass 1000-row limit)
      let customers: any[] = []
      let p = 0
      let more = true
      let fetchErr = null

      while (more) {
        const { data, error } = await supabaseClient
          .from('customers')
          .select('*')
          .eq('location', campaign.location)
          .eq('marketing_sms_consent', true)
          .order('id', { ascending: true })
          .range(p * 1000, (p + 1) * 1000 - 1)

        if (error) {
          fetchErr = error
          break
        }

        if (!data || data.length === 0) {
          more = false
        } else {
          customers = [...customers, ...data]
          if (data.length < 1000) more = false
          else p++
        }
      }

      if (fetchErr) {
        console.error(`Error fetching customers for campaign ${campaign.id}:`, fetchErr)
        await supabaseClient
          .from('scheduled_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id)
        continue
      }
      if (!customers || customers.length === 0) {
        await supabaseClient
          .from('scheduled_campaigns')
          .update({ status: 'completed', total_recipients: 0, successful_sends: 0 })
          .eq('id', campaign.id)
        results.push({ campaign: campaign.name, status: "completed (0 recipients)" })
        continue
      }

      // Log in marketing_campaigns history table
      const { data: campHist, error: campHistErr } = await supabaseClient
        .from('marketing_campaigns')
        .insert({
          name: campaign.name,
          location: campaign.location,
          message_body: campaign.message_body,
          total_recipients: customers.length,
          successful_sends: 0
        })
        .select()
        .single()

      if (campHistErr || !campHist) {
        console.error(`Failed to log campaign history for campaign ${campaign.id}:`, campHistErr)
        await supabaseClient
          .from('scheduled_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id)
        continue
      }

      // Fetch all tickets once to build a per-customer merge context map
      const customerIds = customers.map((c: any) => c.id)
      const { data: tickets } = await supabaseClient
        .from('tickets')
        .select('customer_id, device, problem_description, location, created_at')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })

      // Build context map: customer_id -> { latestTicket, firstName, etc. }
      // Uses the MOST RECENT ticket per customer (tickets already ordered desc)
      const latestTicketMap = new Map<string, any>()
      if (tickets) {
        for (const t of tickets) {
          if (!latestTicketMap.has(t.customer_id)) {
            latestTicketMap.set(t.customer_id, t)
          }
        }
      }

      let successCount = 0
      let failCount = 0

      // Helper function to send single SMS
      const sendSingleSms = async (customer: any) => {
        // Build merge context for this customer
        const latest = latestTicketMap.get(customer.id) ?? null
        const nameParts = (customer.name ?? '').trim().split(/\s+/)
        const firstName = nameParts[0] ?? ''
        const lastName = nameParts.slice(1).join(' ')

        let lastRepairDate = ''
        let lastRepairMonth = ''
        if (latest?.created_at) {
          const d = new Date(latest.created_at)
          lastRepairDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          lastRepairMonth = d.toLocaleDateString('en-US', { month: 'long' })
        }

        // Render the personalised message — supports all {{tag}} merge tags + legacy {name}/{device}
        let content = campaign.message_body
          .replace(/\{\{first_name\}\}/gi, firstName)
          .replace(/\{\{last_name\}\}/gi, lastName)
          .replace(/\{\{last_device\}\}/gi, latest?.device ?? '')
          .replace(/\{\{last_repair_date\}\}/gi, lastRepairDate)
          .replace(/\{\{last_repair_month\}\}/gi, lastRepairMonth)
          .replace(/\{\{last_repair_issue\}\}/gi, latest?.problem_description ?? '')
          .replace(/\{\{last_repair_location\}\}/gi, latest?.location ?? '')
          // Legacy single-brace format (backward compatibility)
          .replace(/\{name\}/g, customer.name ?? '')
          .replace(/\{device\}/g, latest?.device ?? '')

        const result = await dispatchSms(supabaseClient, {
          customer_id: customer.id, message_type: 'marketing', content,
          campaign_id: campHist.id,
          idempotency_key: `scheduled:${campaign.id}:${customer.phone.replace(/\D/g, '').slice(-10)}`,
        })
        if (result.ok) successCount++
        else failCount++
      }

      // Process in concurrent batches of 15
      const BATCH_SIZE = 15
      for (let i = 0; i < customers.length; i += BATCH_SIZE) {
        const batch = customers.slice(i, i + BATCH_SIZE)
        await Promise.all(batch.map(c => sendSingleSms(c)))
        await new Promise(r => setTimeout(r, 10))
      }

      // Update final stats
      await supabaseClient
        .from('marketing_campaigns')
        .update({ successful_sends: successCount })
        .eq('id', campHist.id)

      await supabaseClient
        .from('scheduled_campaigns')
        .update({
          status: 'completed',
          total_recipients: customers.length,
          successful_sends: successCount
        })
        .eq('id', campaign.id)

      results.push({
        campaign: campaign.name,
        status: "completed",
        recipients: customers.length,
        successful: successCount,
        failed: failCount
      })
    }

    return new Response(
      JSON.stringify({ ok: true, processed: pendingCampaigns.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Operation failed';
    console.error("SCHEDULER EDGE FUNCTION ERROR:", err)
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
