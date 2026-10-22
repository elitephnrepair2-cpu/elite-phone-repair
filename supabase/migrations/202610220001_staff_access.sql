-- Apply only after reviewing docs/SECURITY_ROLLOUT.md. This is not applied by Vite.
BEGIN;
CREATE SCHEMA IF NOT EXISTS crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA crm_private TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.staff_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
DO $$ DECLARE policy_name text; BEGIN
  FOR policy_name IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff_members'
  LOOP EXECUTE format('DROP POLICY %I ON public.staff_members', policy_name); END LOOP;
END $$;

-- Fixed search_path and qualified names: clients cannot influence lookup.
CREATE OR REPLACE FUNCTION crm_private.crm_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = (SELECT auth.uid()) AND active);
$$;
CREATE OR REPLACE FUNCTION crm_private.crm_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = (SELECT auth.uid()) AND active AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION crm_private.crm_is_staff(), crm_private.crm_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crm_private.crm_is_staff(), crm_private.crm_is_admin() TO authenticated, service_role;
DROP POLICY IF EXISTS crm_membership_read ON public.staff_members;
CREATE POLICY crm_membership_read ON public.staff_members FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT crm_private.crm_is_admin()));

-- Replace ALL policies, including unknown legacy policy names. Permissive
-- policies combine with OR, so leaving an old policy would preserve access.
DO $$
DECLARE table_name text; policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customers','tickets','appointments','parts_orders','quotes','sms_messages',
    'sms_consent_events','marketing_campaigns','scheduled_campaigns',
    'appointment_sms_jobs','appointment_sms_settings','automations',
    'automation_nodes','automation_edges','automation_enrollments',
    'automation_execution_log','customer_tags','shop_settings',
    'integration_settings','repair_prices','facebook_conversations',
    'facebook_messages','customers_dedupe_archive'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOR policy_name IN SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    IF table_name = 'repair_prices' THEN
      EXECUTE 'GRANT SELECT ON public.repair_prices TO anon';
      EXECUTE 'CREATE POLICY crm_public_prices ON public.repair_prices FOR SELECT TO anon, authenticated USING (true)';
      EXECUTE 'CREATE POLICY crm_manage_prices ON public.repair_prices FOR ALL TO authenticated USING ((SELECT crm_private.crm_is_admin())) WITH CHECK ((SELECT crm_private.crm_is_admin()))';
    ELSIF table_name = 'customers_dedupe_archive' THEN
      EXECUTE 'REVOKE ALL ON public.customers_dedupe_archive FROM authenticated';
      EXECUTE 'GRANT SELECT ON public.customers_dedupe_archive TO authenticated';
      EXECUTE 'CREATE POLICY crm_archive_admin ON public.customers_dedupe_archive FOR SELECT TO authenticated USING ((SELECT crm_private.crm_is_admin()))';
    ELSIF table_name IN ('integration_settings', 'shop_settings', 'appointment_sms_settings') THEN
      EXECUTE format('CREATE POLICY crm_settings_read ON public.%I FOR SELECT TO authenticated USING ((SELECT crm_private.crm_is_staff()))', table_name);
      EXECUTE format('CREATE POLICY crm_settings_manage ON public.%I FOR ALL TO authenticated USING ((SELECT crm_private.crm_is_admin())) WITH CHECK ((SELECT crm_private.crm_is_admin()))', table_name);
      IF table_name = 'integration_settings' THEN
        -- Tokens stay server-side. Staff cannot read them through the Data API.
        EXECUTE 'DROP POLICY crm_settings_read ON public.integration_settings';
        EXECUTE 'DROP POLICY crm_settings_manage ON public.integration_settings';
        EXECUTE 'REVOKE ALL ON public.integration_settings FROM authenticated';
        EXECUTE 'GRANT SELECT (id, provider, is_connected, merchant_id, selected_device_id) ON public.integration_settings TO authenticated';
        EXECUTE 'CREATE POLICY crm_integration_read ON public.integration_settings FOR SELECT TO authenticated USING ((SELECT crm_private.crm_is_admin()))';
      END IF;
    ELSE
      EXECUTE format('CREATE POLICY crm_staff_access ON public.%I FOR ALL TO authenticated USING ((SELECT crm_private.crm_is_staff())) WITH CHECK ((SELECT crm_private.crm_is_staff()))', table_name);
    END IF;
  END LOOP;
END $$;

-- Legacy SECURITY DEFINER RPCs must not remain a bypass around RLS.
-- Invoker functions still run under the caller's restricted table permissions.
DO $$ DECLARE routine record; BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', routine.signature);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION crm_private.crm_is_staff(), crm_private.crm_is_admin() TO authenticated, service_role;

COMMIT;
