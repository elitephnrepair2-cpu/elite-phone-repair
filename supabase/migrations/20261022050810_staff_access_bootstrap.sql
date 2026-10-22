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


COMMIT;
