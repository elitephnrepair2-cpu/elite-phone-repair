import { inboundOptOut } from '../_shared/smsPolicy.ts';
import twilio from 'npm:twilio@6.2.0';
import { serve, createClient } from "../_shared/runtime.ts"

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    // Use the configured external URL, never attacker-controlled forwarding headers.
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const webhookUrl = Deno.env.get('TWILIO_SMS_WEBHOOK_URL');
    if (!authToken || !webhookUrl) return new Response('Service unavailable', { status: 503 });
    // Parse form data from Twilio
    const formData = await req.formData()
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== 'string' || key in params) return new Response('Invalid request', { status: 400 });
      params[key] = value;
    }
    if (!twilio.validateRequest(authToken, req.headers.get('X-Twilio-Signature') || '', webhookUrl, params)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const from = formData.get('From')?.toString() || ''
    const to = formData.get('To')?.toString() || ''
    const body = formData.get('Body')?.toString() || ''
    const messageSid = formData.get('MessageSid')?.toString() || ''

    console.log('Verified inbound SMS webhook')

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

    // Record the callback and any phone-level opt-out in one transaction, once per
    // provider ID. STOP persists even when there is no customer record yet.
    const optOut = inboundOptOut(body, params.OptOutType);
    const { data: inbound, error: inboundError } = await supabaseClient.rpc('crm_record_inbound_sms', {
      p_provider_id:messageSid, p_from:from, p_to:to, p_content:body, p_opt_out:optOut,
    });
    if (inboundError || !inbound) throw new Error('Could not persist inbound message');
    const emptyTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    if (inbound.duplicate || optOut) {
      // Twilio handles STOP/START/HELP responses. Returning another Message would
      // duplicate its opt-out confirmation. START never grants marketing consent.
      return new Response(emptyTwiml, { headers:{ 'Content-Type':'text/xml' } });
    }
    const customer = inbound.customer_id ? { id:inbound.customer_id } : null;
    let twimlResponseText = '';

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

        // Fetch location settings for custom reply
        const { data: settings } = await supabaseClient
          .from('appointment_sms_settings')
          .select('*')
          .eq('location', appt.location || 'Beaumont')
          .maybeSingle()

        twimlResponseText = settings?.template_confirmation_reply || "Thanks! Your appointment with Elite Phone Repair is confirmed. We look forward to seeing you!"
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

        // Fetch location settings for custom reply
        const { data: settings } = await supabaseClient
          .from('appointment_sms_settings')
          .select('*')
          .eq('location', appt.location || 'Beaumont')
          .maybeSingle()

        twimlResponseText = settings?.template_cancellation_reply || "Your appointment has been cancelled. Reply here or call us anytime if you would like to reschedule!"
      }
    }

    // 4. [AUTOMATION] — Reply nudge for condition nodes waiting on "has_replied"
    if (customer) {
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

    // Appointment auto-replies must respect the same current phone-level consent.
    if (!inbound.can_reply) twimlResponseText = '';
    // Return TwiML response to Twilio (with auto-reply text if applicable)
    const twiml = twimlResponseText 
      ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${twimlResponseText.replace(/[<>&\"']/g, char => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '\"':'&quot;', "'":'&apos;' })[char] || char)}</Message></Response>`
      : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch {
    console.error('Could not process verified Twilio callback');
    return new Response('Temporarily unavailable', { status:503 });
  }
})
