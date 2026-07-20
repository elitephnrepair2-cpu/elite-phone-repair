-- 1. Ensure sms_messages table exists
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  message_type TEXT DEFAULT 'transactional',
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  error_message TEXT
);

-- 2. Add direction and from_phone columns
ALTER TABLE public.sms_messages
ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';

ALTER TABLE public.sms_messages
ADD COLUMN IF NOT EXISTS from_phone TEXT;

-- 3. Create indexes for fast inbox and conversation thread queries
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction_created 
ON public.sms_messages(direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_customer 
ON public.sms_messages(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_from_phone 
ON public.sms_messages(from_phone);

-- 4. Enable Row-Level Security (RLS)
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if present and create open read/insert policies
DROP POLICY IF EXISTS "Allow read access to sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "Allow insert access to sms_messages" ON public.sms_messages;

CREATE POLICY "Allow read access to sms_messages" 
ON public.sms_messages FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Allow insert access to sms_messages" 
ON public.sms_messages FOR INSERT TO authenticated, anon WITH CHECK (true);
