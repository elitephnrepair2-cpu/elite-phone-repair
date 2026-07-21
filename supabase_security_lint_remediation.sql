-- ====================================================================
-- SUPABASE SECURITY LINT REMEDIATION SCRIPT
-- Elite Phone Repair Database Security Hardening
-- ====================================================================

-- 1. FIX FUNCTION SEARCH PATHS (Prevents search_path spoofing attacks)
ALTER FUNCTION public.handle_sms_consent_timestamp() SET search_path = public;
ALTER FUNCTION public.handle_consent_timestamp() SET search_path = public;

-- Fix is_staff function security definer & search_path
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_staff') THEN
    EXECUTE 'ALTER FUNCTION public.is_staff() SECURITY INVOKER;';
    EXECUTE 'ALTER FUNCTION public.is_staff() SET search_path = public;';
  END IF;
END $$;


-- 2. MOVE EXTENSION OUT OF PUBLIC SCHEMA
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  END IF;
END $$;


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
