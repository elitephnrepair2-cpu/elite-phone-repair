-- Create the marketing campaigns table
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  message_body TEXT NOT NULL,
  total_recipients INTEGER DEFAULT 0,
  successful_sends INTEGER DEFAULT 0
);

-- Link individual SMS message logs to campaigns
ALTER TABLE public.sms_messages
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

-- Enable RLS for campaigns
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for anon/authenticated roles to perform select/insert operations
CREATE POLICY "Allow read access to authenticated users" 
ON public.marketing_campaigns FOR SELECT 
TO authenticated, anon 
USING (true);

CREATE POLICY "Allow insert access to authenticated users" 
ON public.marketing_campaigns FOR INSERT 
TO authenticated, anon 
WITH CHECK (true);
