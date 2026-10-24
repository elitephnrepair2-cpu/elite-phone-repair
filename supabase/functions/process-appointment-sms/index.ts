import { dispatchSms } from '../_shared/smsDispatch.ts';
import { canSendSms, appointmentSmsExpired } from '../_shared/smsPolicy.ts';
import { authorize } from '../_shared/authorization.ts';
import { serve, createClient } from "../_shared/runtime.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const denied = await authorize(req, { worker: true, headers: corsHeaders });
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing (URL or Service Role Key)")
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: dueJobs, error: fetchErr } = await supabaseClient.rpc('crm_claim_appointment_sms', { p_limit:10 })

    if (fetchErr) {
      throw new Error("Failed to fetch due appointment jobs: " + fetchErr.message)
    }

    if (!dueJobs || dueJobs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No pending appointment SMS jobs due." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const processedResults = []

    for (const job of dueJobs) {
      // Fetch related appointment
      const { data: appt } = await supabaseClient
        .from('appointments')
        .select('*')
        .eq('id', job.appointment_id)
        .maybeSingle()

      if (!appt) {
        await supabaseClient
          .from('appointment_sms_jobs')
          .update({ status: 'skipped', skip_reason: 'Appointment record not found' })
          .eq('id', job.id)
        continue
      }

      // Check Version Match
      if (job.appointment_version !== (appt.version || 1)) {
        await supabaseClient
          .from('appointment_sms_jobs')
          .update({ status: 'canceled', skip_reason: 'Outdated appointment version' })
          .eq('id', job.id)
        continue
      }

      // Check Pause Setting
      if (appt.sms_reminders_enabled === false) {
        await supabaseClient
          .from('appointment_sms_jobs')
          .update({ status: 'skipped', skip_reason: 'SMS reminders paused on appointment' })
          .eq('id', job.id)
        continue
      }

      // Check Status Eligibility
      const apptStatus = (appt.status || '').toLowerCase()
      if (['checked_in', 'completed', 'arrived', 'cancelled'].includes(apptStatus) && job.job_type !== 'missed_appointment') {
        await supabaseClient
          .from('appointment_sms_jobs')
          .update({ status: 'canceled', skip_reason: `Appointment status is '${appt.status}'` })
          .eq('id', job.id)
        continue
      }

      if (job.job_type === 'missed_appointment' && apptStatus !== 'no_show') {
        await supabaseClient
          .from('appointment_sms_jobs')
          .update({ status: 'skipped', skip_reason: 'Appointment is not marked no-show' })
          .eq('id', job.id)
        continue
      }

      // Fetch Location Settings & Address
      const locationName = appt.location || 'Beaumont'
      const { data: settings } = await supabaseClient
        .from('appointment_sms_settings')
        .select('*')
        .eq('location', locationName)
        .maybeSingle()

      if (appointmentSmsExpired(appt.date,job.job_type,job.scheduled_for,settings?.timezone || 'America/Chicago')) {
        await supabaseClient.from('appointment_sms_jobs').update({ status:'skipped',skip_reason:'Appointment reminder expired' }).eq('id',job.id)
        processedResults.push({ id:job.id,type:job.job_type,outcome:'skipped' })
        continue
      }

      const { data: shopConfig } = await supabaseClient
        .from('shop_settings')
        .select('address')
        .eq('location', locationName)
        .maybeSingle()

      const locationAddress = appt.location_address || shopConfig?.address || 'our shop'

      // Check Customer Consent
      let customer: any = null
      let phoneToUse = appt.phone

      if (job.customer_id) {
        const { data: cust } = await supabaseClient
          .from('customers')
          .select('*')
          .eq('id', job.customer_id)
          .maybeSingle()
        customer = cust
        if (customer?.phone) phoneToUse = customer.phone
      }

      // Check 2-Hour Anti-Bunching Rule
      if (job.customer_id && ['reminder_24h', 'reminder_2h'].includes(job.job_type)) {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        const { data: recentMsgs } = await supabaseClient
          .from('sms_messages')
          .select('id')
          .eq('customer_id', job.customer_id)
          .eq('direction', 'outbound')
          .eq('status', 'sent')
          .gte('created_at', twoHoursAgo)
          .limit(1)

        if (recentMsgs && recentMsgs.length > 0) {
          await supabaseClient
            .from('appointment_sms_jobs')
            .update({ status: 'skipped', skip_reason: 'Skipped due to 2-hour anti-bunching rule' })
            .eq('id', job.id)
          continue
        }
      }

      // Render Template Body
      let template = ''
      if (job.job_type === 'immediate_confirmation') {
        template = settings?.template_immediate_confirmation || 'Your appointment with Elite Phone Repair is confirmed for {{appointment_date}} at {{appointment_time}}.'
      } else if (job.job_type === 'reminder_24h') {
        template = settings?.template_reminder_24h || 'Reminder: You’re scheduled with Elite Phone Repair tomorrow at {{appointment_time}}.'
      } else if (job.job_type === 'reminder_2h') {
        template = settings?.template_reminder_2h || 'Your appointment with Elite Phone Repair is coming up today at {{appointment_time}}.'
      } else if (job.job_type === 'missed_appointment') {
        template = settings?.template_missed_appointment || 'Hey, it’s Elite Phone Repair. We missed you for your appointment today. Reply here if you need to reschedule.'
      }

      const formattedDate = appt.date
        ? new Date(appt.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : ''
      const deviceStr = `${appt.brand || ''} ${appt.model || ''}`.trim() || 'Device'

      const messageContent = template
        .replace(/\{\{appointment_date\}\}/gi, formattedDate)
        .replace(/\{\{appointment_time\}\}/gi, appt.time_window || '')
        .replace(/\{\{device\}\}/gi, deviceStr)
        .replace(/\{\{repair_issue\}\}/gi, appt.issue || 'Repair Service')
        .replace(/\{\{location_address\}\}/gi, locationAddress)

      // DRY-RUN MODE CHECK (Default is DRY-RUN = TRUE for safety)
      const isDryRun = settings?.dry_run !== false

      if (isDryRun && !canSendSms(customer, 'transactional')) {
        await supabaseClient.from('appointment_sms_jobs').update({ status:'skipped', skip_reason:'Transactional consent not granted.' }).eq('id',job.id)
        continue
      }
      if (isDryRun) {
        await supabaseClient
          .from('appointment_sms_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: `dry_run_${Date.now()}`,
            error_message: '[DRY RUN MODE] Simulated send logged successfully without calling Twilio.'
          })
          .eq('id', job.id)

        await supabaseClient.from('sms_messages').insert({
          customer_id: job.customer_id,
          ticket_id: null,
          message_type: 'transactional',
          content: `[DRY-RUN] ${messageContent}`,
          status: 'sent',
          provider_message_id: `dry_run_${Date.now()}`
        })

        processedResults.push({ id: job.id, type: job.job_type, outcome: 'sent (dry_run)' })
        continue
      }

      // Use the same durable consent/dispatch gate as manual and campaign texts.
      const result = await dispatchSms(supabaseClient, {
        customer_id:job.customer_id, to_phone:phoneToUse, message_type:'transactional',
        content:messageContent, idempotency_key:`appointment:${job.appointment_id}:${job.appointment_version}:${job.job_type}`,
      })
      const { error: outcomeError } = await supabaseClient.from('appointment_sms_jobs').update({
        status:result.status === 'conflict' ? 'uncertain' : result.status,
        sent_at:result.ok ? new Date().toISOString() : null,
        provider_message_id:result.message_id || null,
        skip_reason:result.status === 'skipped' ? result.reason : null,
        error_message:result.ok ? null : result.reason,
      }).eq('id',job.id)
      if (outcomeError) throw new Error('Could not record appointment send outcome; review claimed job before retrying')
      processedResults.push({ id:job.id, type:job.job_type, outcome:result.status })
    }

    return new Response(
      JSON.stringify({ ok: true, processed: dueJobs.length, results: processedResults }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error("Error in process-appointment-sms function:", err?.message || err)
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
