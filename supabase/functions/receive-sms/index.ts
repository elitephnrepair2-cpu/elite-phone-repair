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

    // Clean phone number to 10 digits
    const digitsOnly = from.replace(/\D/g, '')
    const normalizedPhone = digitsOnly.length === 11 && digitsOnly.startsWith('1') 
      ? digitsOnly.substring(1) 
      : digitsOnly

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Generate phone variants for matching (10-digit, (409) 123-4567, 409-123-4567, +14091234567)
    const formattedPhone = normalizedPhone.length === 10 
      ? `(${normalizedPhone.slice(0, 3)}) ${normalizedPhone.slice(3, 6)}-${normalizedPhone.slice(6)}`
      : normalizedPhone
    const dashedPhone = normalizedPhone.length === 10
      ? `${normalizedPhone.slice(0, 3)}-${normalizedPhone.slice(3, 6)}-${normalizedPhone.slice(6)}`
      : normalizedPhone
    const plusOnePhone = `+1${normalizedPhone}`

    // Lookup customer by phone number using all formatting variants
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('id, name')
      .or(`phone.eq.${normalizedPhone},phone.eq.${formattedPhone},phone.eq.${dashedPhone},phone.eq.${plusOnePhone},alt_phone.eq.${normalizedPhone},alt_phone.eq.${formattedPhone}`)
      .limit(1)
      .maybeSingle()

    // 1. Log inbound message into sms_messages table
    const { error: logError } = await supabaseClient
      .from('sms_messages')
      .insert({
        customer_id: customer?.id || null,
        from_phone: normalizedPhone || from,
        message_type: 'transactional',
        direction: 'inbound',
        content: body,
        status: 'sent',
        provider_message_id: messageSid,
        created_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Failed to log inbound SMS to sms_messages:', logError)
    }

    let twimlResponseText = ''

    // 2. Check for opt-out keyword (STOP)
    const isOptOut = body.trim().toLowerCase() === 'stop'

    if (isOptOut) {
      console.log(`Opt-out keyword detected from ${from}. Updating consent status for all matching customer records.`)

      await supabaseClient
        .from('customers')
        .update({
          marketing_sms_consent: false,
          transactional_sms_consent: false,
          revoked_at: new Date().toISOString(),
          revoked_reason: 'Customer replied STOP',
          consent_source: 'twilio_webhook'
        })
        .or(`phone.eq.${normalizedPhone},phone.eq.${formattedPhone},phone.eq.${dashedPhone},phone.eq.${plusOnePhone},alt_phone.eq.${normalizedPhone},alt_phone.eq.${formattedPhone}`)

      // Log consent event
      if (customer) {
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

    // 3. APPOINTMENT CONFIRMATION / CANCELLATION REPLY HANDLING
    const cleanBody = body.trim().toLowerCase()
    const isConfirmReply = ['c', 'confirm', 'confirmed', 'yes', 'y', 'ok'].includes(cleanBody)
    const isCancelReply = ['cancel', 'cancelled', 'no'].includes(cleanBody)

    if (isConfirmReply) {
      const { data: appt } = await supabaseClient
        .from('appointments')
        .select('*')
        .or(`phone.eq."${normalizedPhone}",phone.eq."${formattedPhone}",phone.eq."${dashedPhone}",phone.eq."${plusOnePhone}"`)
        .in('status', ['scheduled', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (appt) {
        console.log(`Confirming appointment ${appt.id} for phone ${normalizedPhone}`)
        await supabaseClient
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', appt.id)

        twimlResponseText = "Thanks! Your appointment with Elite Phone Repair has been confirmed. We look forward to seeing you!"
      }
    } else if (isCancelReply) {
      const { data: appt } = await supabaseClient
        .from('appointments')
        .select('*')
        .or(`phone.eq."${normalizedPhone}",phone.eq."${formattedPhone}",phone.eq."${dashedPhone}",phone.eq."${plusOnePhone}"`)
        .in('status', ['scheduled', 'pending', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (appt) {
        console.log(`Cancelling appointment ${appt.id} for phone ${normalizedPhone}`)
        await supabaseClient
          .from('appointments')
          .update({ 
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', appt.id)

        // Cancel pending SMS jobs for this appointment
        await supabaseClient
          .from('appointment_sms_jobs')
          .update({ status: 'canceled', skip_reason: 'Customer replied CANCEL' })
          .eq('appointment_id', appt.id)
          .eq('status', 'pending')

        twimlResponseText = "Your appointment has been cancelled. Reply here or call us anytime if you would like to reschedule!"
      }
    }

    // 4. [AUTOMATION] — Reply nudge for condition nodes waiting on "has_replied"
    if (customer && !isOptOut) {
      try {
        const { data: activeEnrollments } = await supabaseClient
          .from('automation_enrollments')
          .select('id, current_node_id')
          .eq('contact_id', customer.id)
          .eq('status', 'active')
          .is('processing_locked_at', null)

        if (activeEnrollments && activeEnrollments.length > 0) {
          const nodeIds = activeEnrollments.map((e: any) => e.current_node_id).filter(Boolean)
          if (nodeIds.length > 0) {
            const { data: conditionNodes } = await supabaseClient
              .from('automation_nodes')
              .select('id')
              .in('id', nodeIds)
              .eq('type', 'condition')

            if (conditionNodes && conditionNodes.length > 0) {
              const conditionNodeIdSet = new Set(conditionNodes.map((n: any) => n.id))
              const enrollmentsToNudge = activeEnrollments
                .filter((e: any) => conditionNodeIdSet.has(e.current_node_id))
                .map((e: any) => e.id)

              if (enrollmentsToNudge.length > 0) {
                await supabaseClient
                  .from('automation_enrollments')
                  .update({ next_execution_at: new Date().toISOString() })
                  .in('id', enrollmentsToNudge)
                console.log(`Nudged ${enrollmentsToNudge.length} automation enrollment(s) for customer ${customer.id} due to inbound reply.`)
              }
            }
          }
        }
      } catch (nudgeErr) {
        console.error('Automation reply nudge error (non-critical):', nudgeErr)
      }
    }

    // Return TwiML response to Twilio (with auto-reply text if applicable)
    const twiml = twimlResponseText 
      ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${twimlResponseText}</Message></Response>`
      : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Error handling Twilio webhook:', error)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
})
