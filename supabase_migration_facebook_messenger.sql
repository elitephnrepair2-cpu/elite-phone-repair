-- ====================================================================
-- SUPABASE DATABASE MIGRATION: META FACEBOOK MESSENGER INTEGRATION
-- Elite Phone Repair Database Migration Script
-- ====================================================================

-- 1. Create facebook_conversations table
CREATE TABLE IF NOT EXISTS public.facebook_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  page_id TEXT NOT NULL,
  psid TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_profile_pic TEXT,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_customer_activity_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  unread_count INTEGER DEFAULT 0 NOT NULL,
  CONSTRAINT facebook_conversations_page_psid_key UNIQUE (page_id, psid)
);

-- 2. Create facebook_messages table
CREATE TABLE IF NOT EXISTS public.facebook_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  conversation_id UUID REFERENCES public.facebook_conversations(id) ON DELETE CASCADE NOT NULL,
  page_id TEXT NOT NULL,
  psid TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  meta_message_id TEXT UNIQUE,
  content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'sent' NOT NULL,
  error_message TEXT,
  is_echo BOOLEAN DEFAULT false NOT NULL,
  timestamp_ms BIGINT
);

-- 3. Create Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_fb_messages_conv_created 
ON public.facebook_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_fb_messages_meta_mid 
ON public.facebook_messages(meta_message_id);

CREATE INDEX IF NOT EXISTS idx_fb_conv_psid_page 
ON public.facebook_conversations(page_id, psid);

CREATE INDEX IF NOT EXISTS idx_fb_conv_customer 
ON public.facebook_conversations(customer_id);

CREATE INDEX IF NOT EXISTS idx_fb_conv_last_message 
ON public.facebook_conversations(last_message_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.facebook_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_messages ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if present and create policies for authenticated & anonymous staff access
DROP POLICY IF EXISTS "Allow authenticated and anonymous access to facebook_conversations" ON public.facebook_conversations;
DROP POLICY IF EXISTS "Allow authenticated and anonymous access to facebook_messages" ON public.facebook_messages;

CREATE POLICY "Allow authenticated and anonymous access to facebook_conversations"
ON public.facebook_conversations FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated and anonymous access to facebook_messages"
ON public.facebook_messages FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
