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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const { customer_id, to_phone, message_type = 'transactional', content, ticket_id, campaign_id } = body

    if ((!customer_id && !to_phone) || !content) {
      throw new Error("Missing required fields: customer_id or to_phone, and content")
    }

    let customer: any = null
    let rawDigits = ""

    if (customer_id) {
      const { data: cust } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('id', customer_id)
        .maybeSingle()
      customer = cust
      if (customer?.phone) {
        rawDigits = customer.phone.replace(/\D/g, '')
      }
    }

    if (!rawDigits && to_phone) {
      rawDigits = to_phone.replace(/\D/g, '')
    }

    let normalizedPhone = ""
    if (rawDigits.length === 10) {
      normalizedPhone = `+1${rawDigits}`
    } else if (rawDigits.length === 11 && rawDigits.startsWith('1')) {
      normalizedPhone = `+${rawDigits}`
    } else if (rawDigits.length > 0) {
      normalizedPhone = `+${rawDigits}`
    } else {
      throw new Error(`Invalid phone number for request`)
    }

    // 3. Evaluate Consent
    let allowed = false
    let reason = ""

    if (to_phone && !customer_id) {
      allowed = true
    } else if (customer) {
      if (message_type === 'transactional') {
        allowed = true
      } else if (message_type === 'marketing') {
        if (customer.marketing_sms_consent === true) {
          allowed = true
        } else {
          reason = "Marketing consent not granted."
        }
      }
    } else {
      allowed = true
    }

    // 4. Handle Skipped Status
    if (!allowed) {
      const { error: logError } = await supabaseClient
        .from('sms_messages')
        .insert({
          customer_id,
          ticket_id,
          message_type,
          content,
          status: 'skipped',
          error_message: reason,
          campaign_id
        })

      if (logError) console.error("Failed to log skipped message:", logError)

      return new Response(
        JSON.stringify({ ok: false, status: 'skipped', reason }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Send via Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio configuration missing (SID, Token, or From Number)")
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    
    const formData = new URLSearchParams()
    formData.append('To', normalizedPhone)
    formData.append('From', fromNumber)
    formData.append('Body', content)

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
      // Success
      const { error: logError } = await supabaseClient
        .from('sms_messages')
        .insert({
          customer_id,
          ticket_id,
          message_type,
          content,
          status: 'sent',
          provider_message_id: twilioData.sid,
          campaign_id
        })

      if (logError) console.error("Failed to log sent message:", logError)

      return new Response(
        JSON.stringify({ ok: true, status: 'sent', message_id: twilioData.sid }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Twilio Error
      const errorMessage = twilioData.message || "Unknown Twilio error"
      const { error: logError } = await supabaseClient
        .from('sms_messages')
        .insert({
          customer_id,
          ticket_id,
          message_type,
          content,
          status: 'failed',
          error_message: errorMessage,
          campaign_id
        })

      if (logError) console.error("Failed to log failed message:", logError)

      return new Response(
        JSON.stringify({ ok: false, status: 'failed', reason: errorMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error("Error in send-sms function:", error.message)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
