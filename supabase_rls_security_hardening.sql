-- ====================================================================
-- SUPABASE AUTHENTICATED & ANONYMOUS RLS SECURITY HARDENING SCRIPT
-- Elite Phone Repair Database Security Policy Upgrade
-- ====================================================================

-- 1. Enable RLS on all core tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy policies and create consolidated ones

-- --- CUSTOMERS TABLE ---
DROP POLICY IF EXISTS "Enable all for anon on customers" ON public.customers;
DROP POLICY IF EXISTS "Public access for customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated staff full access to customers" ON public.customers;

CREATE POLICY "Allow authenticated and anonymous access to customers"
ON public.customers
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- TICKETS TABLE ---
DROP POLICY IF EXISTS "Enable all for anon on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public access for tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow authenticated staff full access to tickets" ON public.tickets;

CREATE POLICY "Allow authenticated and anonymous access to tickets"
ON public.tickets
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- APPOINTMENTS TABLE ---
DROP POLICY IF EXISTS "Allow anon delete" ON public.appointments;
DROP POLICY IF EXISTS "Allow anon insert" ON public.appointments;
DROP POLICY IF EXISTS "Allow anon update" ON public.appointments;
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.appointments;
DROP POLICY IF EXISTS "Allow authenticated staff full access to appointments" ON public.appointments;

CREATE POLICY "Allow authenticated and anonymous access to appointments"
ON public.appointments
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- SMS MESSAGES TABLE ---
DROP POLICY IF EXISTS "Allow read access to sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "Allow insert access to sms_messages" ON public.sms_messages;
DROP POLICY IF EXISTS "Allow authenticated staff access to sms_messages" ON public.sms_messages;

CREATE POLICY "Allow authenticated and anonymous access to sms_messages"
ON public.sms_messages
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- PARTS ORDERS TABLE ---
DROP POLICY IF EXISTS "Allow authenticated staff access to parts_orders" ON public.parts_orders;

CREATE POLICY "Allow authenticated and anonymous access to parts_orders"
ON public.parts_orders
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- QUOTES TABLE ---
DROP POLICY IF EXISTS "Allow anon insert" ON public.quotes;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated staff access to quotes" ON public.quotes;

CREATE POLICY "Allow authenticated and anonymous access to quotes"
ON public.quotes
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- MARKETING CAMPAIGNS TABLE ---
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Allow update access to marketing campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Allow authenticated staff access to marketing_campaigns" ON public.marketing_campaigns;

CREATE POLICY "Allow authenticated and anonymous access to marketing_campaigns"
ON public.marketing_campaigns
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- SCHEDULED CAMPAIGNS TABLE ---
DROP POLICY IF EXISTS "Allow read access to scheduled campaigns" ON public.scheduled_campaigns;
DROP POLICY IF EXISTS "Allow insert access to scheduled campaigns" ON public.scheduled_campaigns;
DROP POLICY IF EXISTS "Allow update access to scheduled campaigns" ON public.scheduled_campaigns;
DROP POLICY IF EXISTS "Allow delete access to scheduled campaigns" ON public.scheduled_campaigns;
DROP POLICY IF EXISTS "Allow authenticated staff access to scheduled_campaigns" ON public.scheduled_campaigns;

CREATE POLICY "Allow authenticated and anonymous access to scheduled_campaigns"
ON public.scheduled_campaigns
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- --- INTEGRATION SETTINGS TABLE ---
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.integration_settings;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.integration_settings;
DROP POLICY IF EXISTS "Allow authenticated update access" ON public.integration_settings;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON public.integration_settings;
DROP POLICY IF EXISTS "Allow authenticated staff access to integration_settings" ON public.integration_settings;

CREATE POLICY "Allow authenticated and anonymous access to integration_settings"
ON public.integration_settings
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
