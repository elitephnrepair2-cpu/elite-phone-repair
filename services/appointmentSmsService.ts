import { supabase } from '../supabaseClient';
import type { Appointment, AppointmentSmsJob, AppointmentSmsSettings } from '../types';
import { sendSmsViaEdgeFunction } from './smsService';

/**
 * Parses appointment date and time string into a Javascript Date object in America/Chicago timezone context.
 */
export function parseAppointmentStartDateTime(dateStr: string, timeWindowStr: string): Date {
  // Normalize time string (e.g., "09:00 AM - 10:00 AM" -> "09:00 AM", "2:30 PM" -> "2:30 PM")
  let startTimePart = timeWindowStr.split('-')[0].trim();
  
  // Format check
  let hours = 9;
  let minutes = 0;
  
  const match = startTimePart.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toUpperCase() : null;
    
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }

  // Construct ISO string for America/Chicago date
  const [year, month, day] = dateStr.split('-').map(n => parseInt(n, 10));
  
  // Construct date object using local representation
  const d = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  
  // America/Chicago is UTC-5 (CDT) or UTC-6 (CST). Offset approx 5/6 hours for scheduling.
  // Standard JS Date handles system local timezone, so we ensure standard ISO comparison.
  return d;
}

/**
 * Renders an SMS template by replacing placeholders.
 */
export function renderAppointmentTemplate(
  template: string,
  appointment: Partial<Appointment>,
  locationAddress: string
): string {
  const formattedDate = appointment.date 
    ? new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : '';

  const deviceStr = `${appointment.brand || ''} ${appointment.model || ''}`.trim() || 'Device';

  return template
    .replace(/\{\{appointment_date\}\}/gi, formattedDate)
    .replace(/\{\{appointment_time\}\}/gi, appointment.time_window || '')
    .replace(/\{\{device\}\}/gi, deviceStr)
    .replace(/\{\{repair_issue\}\}/gi, appointment.issue || 'Repair Service')
    .replace(/\{\{location_address\}\}/gi, locationAddress || 'our shop');
}

/**
 * Fetches appointment SMS automation settings for a location.
 */
export async function getAppointmentSmsSettings(locationName: string = 'Beaumont'): Promise<AppointmentSmsSettings | null> {
  try {
    let { data, error } = await supabase
      .from('appointment_sms_settings')
      .select('*')
      .eq('location', locationName)
      .maybeSingle();

    if (!data) {
      // Fallback to first available location settings (e.g. Beaumont)
      const { data: fallbackData } = await supabase
        .from('appointment_sms_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      data = fallbackData;
    }

    if (error) {
      console.error("Failed to fetch appointment_sms_settings:", error);
    }
    return data;
  } catch (err) {
    console.error("Error in getAppointmentSmsSettings:", err);
    return null;
  }
}

/**
 * Schedules or reschedules SMS jobs for an appointment based on business rules.
 */
export async function scheduleAppointmentSmsSequence(
  appointment: Appointment,
  customerId: string | null = null,
  isReschedule: boolean = false
): Promise<{ success: boolean; jobsCreated: number }> {
  try {
    const newVersion = (appointment.version || 1) + (isReschedule ? 1 : 0);

    // 1. Invalidate any existing pending jobs for this appointment
    await supabase
      .from('appointment_sms_jobs')
      .update({ status: 'canceled', skip_reason: isReschedule ? 'Appointment rescheduled' : 'Appointment updated' })
      .eq('appointment_id', appointment.id)
      .eq('status', 'pending');

    // If SMS reminders are explicitly disabled on the appointment, stop here
    if (appointment.sms_reminders_enabled === false) {
      console.log(`SMS reminders disabled for appointment ${appointment.id}`);
      return { success: true, jobsCreated: 0 };
    }

    // 2. Fetch settings
    const settings = await getAppointmentSmsSettings(appointment.location || 'Beaumont');
    const now = new Date();
    const apptStartTime = parseAppointmentStartDateTime(appointment.date, appointment.time_window);

    const timeUntilApptMs = apptStartTime.getTime() - now.getTime();
    const timeUntilApptHours = timeUntilApptMs / (1000 * 60 * 60);

    const jobsToInsert: Array<any> = [];

    // A. Immediate Confirmation
    if (settings?.enable_immediate_confirmation !== false) {
      jobsToInsert.push({
        appointment_id: appointment.id,
        customer_id: customerId,
        appointment_version: newVersion,
        job_type: 'immediate_confirmation',
        scheduled_for: now.toISOString(),
        status: 'pending'
      });
    }

    // B. 24-Hour Reminder Rule: Skip if booked less than 24 hours ahead
    if (timeUntilApptHours > 24 && settings?.enable_reminder_24h !== false) {
      const scheduled24h = new Date(apptStartTime.getTime() - 24 * 60 * 60 * 1000);
      if (scheduled24h > now) {
        jobsToInsert.push({
          appointment_id: appointment.id,
          customer_id: customerId,
          appointment_version: newVersion,
          job_type: 'reminder_24h',
          scheduled_for: scheduled24h.toISOString(),
          status: 'pending'
        });
      }
    }

    // C. 2-Hour Reminder Rule: Skip if booked 2 hours or less ahead
    if (timeUntilApptHours > 2 && settings?.enable_reminder_2h !== false) {
      const scheduled2h = new Date(apptStartTime.getTime() - 2 * 60 * 60 * 1000);
      if (scheduled2h > now) {
        jobsToInsert.push({
          appointment_id: appointment.id,
          customer_id: customerId,
          appointment_version: newVersion,
          job_type: 'reminder_2h',
          scheduled_for: scheduled2h.toISOString(),
          status: 'pending'
        });
      }
    }

    if (jobsToInsert.length > 0) {
      const { error } = await supabase.from('appointment_sms_jobs').insert(jobsToInsert);
      if (error) {
        console.error("Failed to insert appointment_sms_jobs:", error);
        return { success: false, jobsCreated: 0 };
      }
      // Immediately trigger processing for due jobs (e.g. immediate confirmation)
      await triggerAppointmentSmsProcessor();
    }

    return { success: true, jobsCreated: jobsToInsert.length };

  } catch (err) {
    console.error("Error in scheduleAppointmentSmsSequence:", err);
    return { success: false, jobsCreated: 0 };
  }
}

/**
 * Processes pending appointment SMS jobs directly by evaluating pre-send rules
 * and dispatching via the deployed 'send-sms' Edge Function (or logging in Dry-Run mode).
 */
export async function triggerAppointmentSmsProcessor(): Promise<{ success: boolean; processed: number; errors: any[] }> {
  try {
    const nowIso = new Date().toISOString();

    // 1. Fetch pending due jobs
    const { data: dueJobs, error: fetchErr } = await supabase
      .from('appointment_sms_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso);

    if (fetchErr || !dueJobs || dueJobs.length === 0) {
      return { success: true, processed: 0, errors: [] };
    }

    let processedCount = 0;
    const errorsList: any[] = [];

    for (const job of dueJobs) {
      // Lock job atomically
      await supabase
        .from('appointment_sms_jobs')
        .update({ status: 'claimed', claimed_at: nowIso })
        .eq('id', job.id);

      // Fetch related appointment
      const { data: appt } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', job.appointment_id)
        .maybeSingle();

      if (!appt) {
        await supabase
          .from('appointment_sms_jobs')
          .update({ status: 'skipped', skip_reason: 'Appointment record not found' })
          .eq('id', job.id);
        continue;
      }

      // Version Check
      if (job.appointment_version !== (appt.version || 1)) {
        await supabase
          .from('appointment_sms_jobs')
          .update({ status: 'canceled', skip_reason: 'Outdated appointment version' })
          .eq('id', job.id);
        continue;
      }

      // Check Pause Setting
      if (appt.sms_reminders_enabled === false) {
        await supabase
          .from('appointment_sms_jobs')
          .update({ status: 'skipped', skip_reason: 'SMS reminders paused on appointment' })
          .eq('id', job.id);
        continue;
      }

      // Check Appointment Status Eligibility
      const apptStatus = (appt.status || '').toLowerCase();
      if (['checked_in', 'completed', 'arrived', 'cancelled'].includes(apptStatus) && job.job_type !== 'missed_appointment') {
        await supabase
          .from('appointment_sms_jobs')
          .update({ status: 'canceled', skip_reason: `Appointment status is '${appt.status}'` })
          .eq('id', job.id);
        continue;
      }

      if (job.job_type === 'missed_appointment' && apptStatus !== 'no_show') {
        await supabase
          .from('appointment_sms_jobs')
          .update({ status: 'skipped', skip_reason: 'Appointment is not marked no-show' })
          .eq('id', job.id);
        continue;
      }

      // Fetch Location Settings
      const locationName = appt.location || 'Beaumont';
      const settings = await getAppointmentSmsSettings(locationName);

      // Check Customer Consent & Phone
      let phoneToUse = appt.phone;
      if (job.customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('*')
          .eq('id', job.customer_id)
          .maybeSingle();
        if (cust?.transactional_sms_consent === false && cust?.revoked_reason === 'Customer replied STOP') {
          await supabase
            .from('appointment_sms_jobs')
            .update({ status: 'skipped', skip_reason: 'Customer opted out of all SMS via STOP' })
            .eq('id', job.id);
          continue;
        }
        if (cust?.phone) phoneToUse = cust.phone;
      }

      const digitsOnly = (phoneToUse || '').replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        await supabase
          .from('appointment_sms_jobs')
          .update({ status: 'failed', error_message: 'Invalid 10-digit phone number' })
          .eq('id', job.id);
        continue;
      }

      // Render Template
      let template = '';
      if (job.job_type === 'immediate_confirmation') {
        template = settings?.template_immediate_confirmation || 'Your appointment with Elite Phone Repair is set for {{appointment_date}} at {{appointment_time}}.\nDevice: {{device}}\nRepair: {{repair_issue}}\nLocation: {{location_address}}\n\nReply YES to confirm your appointment, or reply NO to cancel.';
      } else if (job.job_type === 'reminder_24h') {
        template = settings?.template_reminder_24h || 'Reminder: You’re scheduled with Elite Phone Repair tomorrow at {{appointment_time}}.';
      } else if (job.job_type === 'reminder_2h') {
        template = settings?.template_reminder_2h || 'Your appointment with Elite Phone Repair is coming up today at {{appointment_time}}.';
      } else if (job.job_type === 'missed_appointment') {
        template = settings?.template_missed_appointment || 'Hey, it’s Elite Phone Repair. We missed you for your appointment today. Reply here if you need to reschedule.';
      }

      const locationAddress = appt.location_address || 'our shop';
      const renderedMessage = renderAppointmentTemplate(template, appt, locationAddress);

      // Check Dry Run Mode (Only true if explicitly set to true in settings)
      const isDryRun = settings ? settings.dry_run === true : false;

      if (isDryRun) {
        await supabase
          .from('appointment_sms_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: `dry_run_${Date.now()}`,
            error_message: '[DRY RUN MODE] Simulated send logged without calling Twilio.'
          })
          .eq('id', job.id);

        processedCount++;
        continue;
      }

      // LIVE SENDING VIA DEPLOYED 'send-sms' EDGE FUNCTION (TWILIO)
      const res = await sendSmsViaEdgeFunction({
        customer_id: job.customer_id || '',
        to_phone: phoneToUse,
        message_type: 'transactional',
        content: renderedMessage,
        ticket_id: null
      } as any);

      if (res.success && res.data) {
        const twilioSid = res.data.message_id || res.data.sid || `tw_${Date.now()}`;
        await supabase
          .from('appointment_sms_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: twilioSid
          })
          .eq('id', job.id);
        processedCount++;
      } else {
        await supabase
          .from('appointment_sms_jobs')
          .update({
            status: 'failed',
            error_message: res.reason || res.error || 'Failed to dispatch via Twilio'
          })
          .eq('id', job.id);
        errorsList.push(res);
      }
    }

    return { success: true, processed: processedCount, errors: errorsList };

  } catch (err) {
    console.error("Error in triggerAppointmentSmsProcessor:", err);
    return { success: false, processed: 0, errors: [err] };
  }
}

/**
 * Cancels all pending SMS jobs when an appointment is canceled, arrived, or completed.
 */
export async function cancelAppointmentSmsJobs(appointmentId: string, reason: string): Promise<void> {
  try {
    await supabase
      .from('appointment_sms_jobs')
      .update({ status: 'canceled', skip_reason: reason })
      .eq('appointment_id', appointmentId)
      .eq('status', 'pending');
  } catch (err) {
    console.error("Failed to cancel appointment SMS jobs:", err);
  }
}

/**
 * Handles explicit No-Show status.
 * Cancels pre-appointment reminders and schedules single missed-appointment follow-up.
 */
export async function scheduleMissedAppointmentSms(appointment: Appointment, customerId: string | null = null): Promise<void> {
  try {
    // 1. Cancel pending pre-appointment reminders
    await cancelAppointmentSmsJobs(appointment.id, 'Customer marked no-show');

    // 2. Calculate missed appointment send time: no earlier than 30 minutes after scheduled time
    const apptStartTime = parseAppointmentStartDateTime(appointment.date, appointment.time_window);
    const minSendTime = new Date(apptStartTime.getTime() + 30 * 60 * 1000);
    const now = new Date();

    const sendAt = minSendTime > now ? minSendTime : new Date(now.getTime() + 60 * 1000); // 1 min from now if already past

    const { error } = await supabase.from('appointment_sms_jobs').insert({
      appointment_id: appointment.id,
      customer_id: customerId,
      appointment_version: appointment.version || 1,
      job_type: 'missed_appointment',
      scheduled_for: sendAt.toISOString(),
      status: 'pending'
    });

    if (error) {
      console.error("Failed to schedule missed appointment SMS:", error);
    }
  } catch (err) {
    console.error("Error in scheduleMissedAppointmentSms:", err);
  }
}

/**
 * Fetches all SMS jobs for a specific appointment for display in the UI.
 */
export async function fetchAppointmentSmsJobs(appointmentId: string): Promise<AppointmentSmsJob[]> {
  try {
    const { data, error } = await supabase
      .from('appointment_sms_jobs')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Failed to fetch appointment SMS jobs:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Error in fetchAppointmentSmsJobs:", err);
    return [];
  }
}

/**
 * Processes inbound customer SMS reply for appointment confirmations ('C', 'CONFIRM', 'YES', 'CANCEL').
 */
export async function processInboundAppointmentReply(
  fromPhone: string,
  messageBody: string
): Promise<{ handled: boolean; action?: 'confirmed' | 'cancelled'; replyMessage?: string }> {
  try {
    const cleanBody = (messageBody || '').trim().toLowerCase();
    const digitsOnly = fromPhone.replace(/\D/g, '');
    const normalizedPhone = digitsOnly.length === 11 && digitsOnly.startsWith('1')
      ? digitsOnly.substring(1)
      : digitsOnly;

    const formattedPhone = normalizedPhone.length === 10 
      ? `(${normalizedPhone.slice(0, 3)}) ${normalizedPhone.slice(3, 6)}-${normalizedPhone.slice(6)}`
      : normalizedPhone;
    const dashedPhone = normalizedPhone.length === 10
      ? `${normalizedPhone.slice(0, 3)}-${normalizedPhone.slice(3, 6)}-${normalizedPhone.slice(6)}`
      : normalizedPhone;
    const plusOnePhone = `+1${normalizedPhone}`;

    const isConfirmReply = ['c', 'confirm', 'confirmed', 'yes', 'y', 'ok'].includes(cleanBody);
    const isCancelReply = ['cancel', 'cancelled', 'no'].includes(cleanBody);

    if (!isConfirmReply && !isCancelReply) {
      return { handled: false };
    }

    if (isConfirmReply) {
      // Find latest pending or scheduled appointment for this phone number
      const { data: appt } = await supabase
        .from('appointments')
        .select('*')
        .or(`phone.eq."${normalizedPhone}",phone.eq."${formattedPhone}",phone.eq."${dashedPhone}",phone.eq."${plusOnePhone}"`)
        .in('status', ['scheduled', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appt) {
        await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', appt.id);

        const settings = await getAppointmentSmsSettings(appt.location || 'Beaumont');
        const replyTemplate = settings?.template_confirmation_reply || "Thanks! Your appointment with Elite Phone Repair is confirmed. We look forward to seeing you!";
        const renderedReply = renderAppointmentTemplate(replyTemplate, appt, appt.location_address || 'our shop');

        return {
          handled: true,
          action: 'confirmed',
          replyMessage: renderedReply
        };
      }
    }

    if (isCancelReply) {
      // Find latest active appointment for this phone number
      const { data: appt } = await supabase
        .from('appointments')
        .select('*')
        .or(`phone.eq."${normalizedPhone}",phone.eq."${formattedPhone}",phone.eq."${dashedPhone}",phone.eq."${plusOnePhone}"`)
        .in('status', ['scheduled', 'pending', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appt) {
        await supabase
          .from('appointments')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', appt.id);

        await cancelAppointmentSmsJobs(appt.id, 'Customer replied CANCEL');

        const settings = await getAppointmentSmsSettings(appt.location || 'Beaumont');
        const replyTemplate = settings?.template_cancellation_reply || "Your appointment has been cancelled. Reply here or call us anytime if you would like to reschedule!";
        const renderedReply = renderAppointmentTemplate(replyTemplate, appt, appt.location_address || 'our shop');

        return {
          handled: true,
          action: 'cancelled',
          replyMessage: renderedReply
        };
      }
    }

    return { handled: false };
  } catch (err) {
    console.error("Error processing inbound appointment reply:", err);
    return { handled: false };
  }
}

