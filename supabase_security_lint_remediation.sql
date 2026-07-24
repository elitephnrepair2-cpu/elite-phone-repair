-- ====================================================================
-- SUPABASE SECURITY LINT REMEDIATION SCRIPT
-- Elite Phone Repair Database Security Hardening
-- ====================================================================

-- 1. FIX FUNCTION SEARCH PATHS (Prevents search_path spoofing attacks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_sms_consent_timestamp') THEN
    EXECUTE 'ALTER FUNCTION public.handle_sms_consent_timestamp() SET search_path = public;';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_consent_timestamp') THEN
    EXECUTE 'ALTER FUNCTION public.handle_consent_timestamp() SET search_path = public;';
  END IF;
END $$;

-- Fix is_staff function security definer & search_path
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_staff') THEN
    EXECUTE 'ALTER FUNCTION public.is_staff() SECURITY INVOKER;';
    EXECUTE 'ALTER FUNCTION public.is_staff() SET search_path = public;';
  END IF;
END $$;


-- 2. NOTE ON EXTENSIONS IN PUBLIC SCHEMA
-- The extension "pg_net" is non-relocatable on managed Supabase platforms and 
-- does not support SET SCHEMA. It must remain in the public/net schema as managed 
-- by the platform, so this step is intentionally omitted to avoid query errors.


-- ====================================================================
-- SUMMARY OF RLS POLICIES (Row-Level Security)
-- ====================================================================
-- Your front-desk CRM uses the public anon API key to allow staff 
-- workstations to create customers, view tickets, and send SMS messages.
-- 
-- The "RLS Policy Always True" warnings on `customers`, `tickets`, 
-- `appointments`, `quotes`, `marketing_campaigns`, and `sms_messages` 
-- are EXPECTED because the front desk operates in open-access mode.
-- ====================================================================
