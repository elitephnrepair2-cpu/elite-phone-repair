import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    // Parse form data from Twilio
    const formData = await req.formData()
    const from = formData.get('From')?.toString() || ''
    const to = formData.get('To')?.toString() || ''
    const body = formData.get('Body')?.toString() || ''
    const messageSid = formData.get('MessageSid')?.toString() || ''

    console.log(`Received SMS from ${from}: ${body}`)

    // Clean the phone number (Twilio usually sends +1XXXXXXXXXX)
    const normalizedPhone = from.startsWith('+1') ? from.substring(2) : from.replace(/\D/g, '')

    // Check for opt-out keywords
    const optOutKeywords = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']
    const isOptOut = optOutKeywords.includes(body.trim().toLowerCase())

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (isOptOut && from) {
      console.log(`Opt-out keyword detected from ${from}. Updating consent status.`)

      // Update customer consent status
      // We look up by the phone number
      const { data: customer, error: fetchError } = await supabaseClient
        .from('customers')
        .select('id')
        .or(`phone.eq.${normalizedPhone},alt_phone.eq.${normalizedPhone}`)
        .limit(1)
        .single()

      if (customer) {
         await supabaseClient
          .from('customers')
          .update({
            marketing_sms_consent: false,
            transactional_sms_consent: false,
            revoked_at: new Date().toISOString(),
            revoked_reason: 'Customer replied STOP',
            consent_source: 'twilio_webhook'
          })
          .eq('id', customer.id)

          // Log the event
          await supabaseClient
          .from('sms_consent_events')
          .insert({
            customer_id: customer.id,
            phone: normalizedPhone,
            consent_type: 'opt-out-all',
            status: false,
            source: 'twilio_webhook',
            message_sid: messageSid,
            notes: { body }
          })
      }
    }

    // Return empty TwiML response to Twilio
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Error handling Twilio webhook:', error)
    // Always return 200 to Twilio so it doesn't retry infinitely on error
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
})
