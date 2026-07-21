import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase service configuration missing.")
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all customers
    let allCustomers: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error || !data || data.length === 0) {
        hasMore = false
      } else {
        allCustomers = allCustomers.concat(data)
        if (data.length < pageSize) hasMore = false
        else page++
      }
    }

    // Group by normalized 10-digit phone
    const phoneGroups: Record<string, any[]> = {}

    allCustomers.forEach(c => {
      if (c.phone) {
        const raw = String(c.phone).trim()
        const digits = raw.replace(/\D/g, '')
        const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits

        if (norm && norm.length === 10) {
          if (!phoneGroups[norm]) phoneGroups[norm] = []
          phoneGroups[norm].push(c)
        }
      }
    })

    const duplicateGroups = Object.entries(phoneGroups).filter(([_, list]) => list.length > 1)
    let mergedGroupCount = 0
    let deletedCount = 0

    for (const [normPhone, list] of duplicateGroups) {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const primary = list[0]
      const secondaries = list.slice(1)

      const formatted = `(${normPhone.slice(0, 3)}) ${normPhone.slice(3, 6)}-${normPhone.slice(6)}`
      const hasMarketingConsent = list.some(c => c.marketing_sms_consent === true)
      const hasTransactionalConsent = list.some(c => c.transactional_sms_consent !== false)

      // Update primary record
      await supabaseClient
        .from('customers')
        .update({
          phone: formatted,
          marketing_sms_consent: hasMarketingConsent,
          transactional_sms_consent: hasTransactionalConsent
        })
        .eq('id', primary.id)

      for (const sec of secondaries) {
        // Reassign tickets
        await supabaseClient.from('tickets').update({ customer_id: primary.id }).eq('customer_id', sec.id)
        // Reassign sms_messages
        await supabaseClient.from('sms_messages').update({ customer_id: primary.id }).eq('customer_id', sec.id)
        // Reassign sms_consent_events if table exists
        try {
          await supabaseClient.from('sms_consent_events').update({ customer_id: primary.id }).eq('customer_id', sec.id)
        } catch (_) {}

        // Delete secondary record
        const { error: delErr } = await supabaseClient.from('customers').delete().eq('id', sec.id)
        if (!delErr) {
          deletedCount++
        } else {
          console.error(`Failed deleting customer ${sec.id}:`, delErr)
        }
      }

      mergedGroupCount++
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_customers: allCustomers.length,
        duplicate_groups_merged: mergedGroupCount,
        deleted_records: deletedCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
