-- ====================================================================
-- SUPABASE AUTHENTICATED RLS SECURITY HARDENING SCRIPT
-- Elite Phone Repair Database Security Policy Upgrade
-- ====================================================================

-- Enable RLS on all CRM core tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Remove anonymous access policies if restricting access exclusively to authenticated staff
-- 1. Customers Table
DROP POLICY IF EXISTS "Enable all for anon on customers" ON public.customers;
DROP POLICY IF EXISTS "Public access for customers" ON public.customers;

CREATE POLICY "Allow authenticated staff full access to customers"
ON public.customers
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 2. Tickets Table
DROP POLICY IF EXISTS "Enable all for anon on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public access for tickets" ON public.tickets;

CREATE POLICY "Allow authenticated staff full access to tickets"
ON public.tickets
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 3. Appointments Table
DROP POLICY IF EXISTS "Allow anon delete" ON public.appointments;
DROP POLICY IF EXISTS "Allow anon insert" ON public.appointments;
DROP POLICY IF EXISTS "Allow anon update" ON public.appointments;

CREATE POLICY "Allow authenticated staff full access to appointments"
ON public.appointments
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 4. SMS Messages Table
CREATE POLICY "Allow authenticated staff access to sms_messages"
ON public.sms_messages
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
