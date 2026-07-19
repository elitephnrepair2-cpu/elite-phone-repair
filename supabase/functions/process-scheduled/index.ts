import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing (URL or Service Role Key)")
    }
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio configuration missing (SID, Token, or From Number)")
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch pending scheduled campaigns that are due
    const nowIso = new Date().toISOString()
    const { data: pendingCampaigns, error: fetchErr } = await supabaseClient
      .from('scheduled_campaigns')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)

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
      // Set status to 'sending' to lock it
      await supabaseClient
        .from('scheduled_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign.id)

      // Fetch target customers matching the location and consented to marketing
      const { data: customers, error: customerErr } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('location', campaign.location)
        .eq('marketing_sms_consent', true)

      if (customerErr) {
        console.error(`Error fetching customers for campaign ${campaign.id}:`, customerErr)
        await supabaseClient
          .from('scheduled_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id)
        continue
      }

      if (!customers || customers.length === 0) {
        // No recipients, mark as completed
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

      let successCount = 0
      let failCount = 0

      // Loop through customers and send SMS
      for (const customer of customers) {
        // Find last repaired device for tag replacement
        const { data: lastTicket } = await supabaseClient
          .from('tickets')
          .select('device')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const lastDevice = lastTicket?.device || 'your device'
        
        // Parse message content
        let content = campaign.message_body
        content = content.replace(/{name}/g, customer.name)
        content = content.replace(/{device}/g, lastDevice)

        // Normalize phone number (strip non-numeric except optional leading plus)
        let normalizedPhone = customer.phone.replace(/[^\d+]/g, "")
        if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('+')) {
          normalizedPhone = `+1${normalizedPhone}`
        } else if (!normalizedPhone.startsWith('+')) {
          normalizedPhone = `+${normalizedPhone}`
        }

        // Send via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        const formData = new URLSearchParams()
        formData.append('To', normalizedPhone)
        formData.append('From', fromNumber)
        formData.append('Body', content)

        try {
          const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
          })

          const twilioData = await twilioResponse.json()

          if (twilioResponse.ok) {
            successCount++
            // Log SMS messages sent in sms_messages table
            await supabaseClient
              .from('sms_messages')
              .insert({
                customer_id: customer.id,
                message_type: 'marketing',
                content,
                status: 'sent',
                provider_message_id: twilioData.sid,
                campaign_id: campHist.id
              })
          } else {
            failCount++
            const errorMessage = twilioData.message || "Unknown Twilio error"
            await supabaseClient
              .from('sms_messages')
              .insert({
                customer_id: customer.id,
                message_type: 'marketing',
                content,
                status: 'failed',
                error_message: errorMessage,
                campaign_id: campHist.id
              })
          }
        } catch (smsErr) {
          console.error(`Exception sending SMS to customer ${customer.id} in campaign ${campaign.id}:`, smsErr)
          failCount++
          await supabaseClient
            .from('sms_messages')
            .insert({
              customer_id: customer.id,
              message_type: 'marketing',
              content,
              status: 'failed',
              error_message: String(smsErr),
              campaign_id: campHist.id
            })
        }

        // 1-second delay between Twilio calls
        await new Promise(r => setTimeout(r, 1000))
      }

      // Update marketing_campaigns final success sends
      await supabaseClient
        .from('marketing_campaigns')
        .update({ successful_sends: successCount })
        .eq('id', campHist.id)

      // Update scheduled_campaigns status to 'completed'
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
    console.error("SCHEDULER EDGE FUNCTION ERROR:", err)
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
