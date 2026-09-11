-- 1. Upgrade appointments table with automation tracking columns
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS sms_reminders_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS location_address TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;

-- 2. Create durable job queue for appointment SMS messages
CREATE TABLE IF NOT EXISTS public.appointment_sms_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  appointment_version INT DEFAULT 1,
  job_type TEXT NOT NULL, -- 'immediate_confirmation', 'reminder_24h', 'reminder_2h', 'missed_appointment'
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'claimed', 'sent', 'failed', 'skipped', 'canceled', 'uncertain'
  skip_reason TEXT,
  error_message TEXT,
  provider_message_id TEXT,
  retry_count INT DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance & atomic claiming
CREATE INDEX IF NOT EXISTS idx_appt_sms_jobs_status_scheduled 
ON public.appointment_sms_jobs (status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_appt_sms_jobs_appt_id 
ON public.appointment_sms_jobs (appointment_id);

CREATE INDEX IF NOT EXISTS idx_appt_sms_jobs_customer_id 
ON public.appointment_sms_jobs (customer_id);

-- 3. Create appointment_sms_settings table for store templates and quiet hours
CREATE TABLE IF NOT EXISTS public.appointment_sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT DEFAULT 'Beaumont' UNIQUE,
  dry_run BOOLEAN DEFAULT true, -- SAFE DEFAULT: LIVE SENDING OFF
  test_phone_number TEXT,
  quiet_hours_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TEXT DEFAULT '08:00',
  quiet_hours_end TEXT DEFAULT '22:00',
  timezone TEXT DEFAULT 'America/Chicago',
  enable_immediate_confirmation BOOLEAN DEFAULT true,
  enable_reminder_24h BOOLEAN DEFAULT true,
  enable_reminder_2h BOOLEAN DEFAULT true,
  enable_missed_appointment BOOLEAN DEFAULT true,
  template_immediate_confirmation TEXT DEFAULT 'Your appointment with Elite Phone Repair is confirmed for {{appointment_date}} at {{appointment_time}}.
Device: {{device}}
Repair: {{repair_issue}}
Location: {{location_address}}
If anything changes, reply here and let us know.',
  template_reminder_24h TEXT DEFAULT 'Reminder: You’re scheduled with Elite Phone Repair tomorrow at {{appointment_time}} for your {{device}}.
Location: {{location_address}}
Need to reschedule? Reply here and let us know.',
  template_reminder_2h TEXT DEFAULT 'Your appointment with Elite Phone Repair is coming up today at {{appointment_time}}.
Location: {{location_address}}
Reply here if you need anything.',
  template_missed_appointment TEXT DEFAULT 'Hey, it’s Elite Phone Repair. We missed you for your {{device}} appointment today. Do you still need it fixed? Reply here and we’ll help you find another time.',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default row if not existing
INSERT INTO public.appointment_sms_settings (location, dry_run)
VALUES ('Beaumont', true)
ON CONFLICT (location) DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.appointment_sms_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_sms_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Allow open access to appointment_sms_jobs" ON public.appointment_sms_jobs;
CREATE POLICY "Allow open access to appointment_sms_jobs"
ON public.appointment_sms_jobs FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow open access to appointment_sms_settings" ON public.appointment_sms_settings;
CREATE POLICY "Allow open access to appointment_sms_settings"
ON public.appointment_sms_settings FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
