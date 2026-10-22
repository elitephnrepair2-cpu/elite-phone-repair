BEGIN;
CREATE SCHEMA IF NOT EXISTS crm_private;
REVOKE ALL ON SCHEMA crm_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA crm_private TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS crm_private.intake_receipts (
  request_id uuid PRIMARY KEY,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intake_receipts_created ON crm_private.intake_receipts(created_at);
ALTER TABLE crm_private.intake_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.intake_receipts FROM PUBLIC, anon, authenticated;

-- Called only by the verified Edge Function, never by a browser role.
-- Customer matching, receipt and ticket creation are one transaction.
CREATE OR REPLACE FUNCTION crm_private.crm_submit_check_in(request_id uuid, payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  phone_digits text := regexp_replace(coalesce(payload->>'phone',''), '[^0-9]', '', 'g');
  shop text := payload->>'location';
  customer uuid;
  estimate text;
BEGIN
  IF length(phone_digits) = 11 AND left(phone_digits,1) = '1' THEN phone_digits := substr(phone_digits,2); END IF;
  IF request_id IS NULL OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR shop IS NULL OR shop NOT IN ('Beaumont','Houston')
    OR phone_digits !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'
    OR coalesce(length(trim(payload->>'name')),0) NOT BETWEEN 1 AND 120
    OR coalesce(length(trim(payload->>'device')),0) NOT BETWEEN 1 AND 160
    OR coalesce(length(trim(payload->>'problemDescription')),0) NOT BETWEEN 1 AND 2000
    OR coalesce(length(trim(payload->>'repairCategory')),0) NOT BETWEEN 1 AND 100
    OR coalesce(length(trim(payload->>'heardFrom')),0) NOT BETWEEN 1 AND 100
    OR length(coalesce(payload->>'email','')) > 254
    OR length(coalesce(payload->>'callBackNumber','')) > 30
    OR jsonb_typeof(payload->'transactionalConsent') IS DISTINCT FROM 'boolean'
    OR (payload->>'transactionalConsent') IS DISTINCT FROM 'true'
    OR jsonb_typeof(payload->'promotionalConsent') IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'Invalid check-in' USING ERRCODE = '22023'; END IF;

  -- Serialize the global allowance and receipt check across concurrent requests.
  PERFORM pg_advisory_xact_lock(2200261022);
  IF EXISTS (SELECT 1 FROM crm_private.intake_receipts r WHERE r.request_id = crm_submit_check_in.request_id) THEN RETURN; END IF;
  IF (SELECT count(*) FROM crm_private.intake_receipts WHERE created_at > now() - interval '10 minutes') >= 120
    OR (SELECT count(*) FROM crm_private.intake_receipts WHERE phone = phone_digits AND created_at > now() - interval '10 minutes') >= 3
  THEN RAISE EXCEPTION 'Check-in temporarily unavailable' USING ERRCODE = 'P0001'; END IF;

  SELECT id INTO customer FROM public.customers
    WHERE location = shop AND
      right(regexp_replace(phone, '[^0-9]', '', 'g'),10) = phone_digits
    ORDER BY created_at ASC, id ASC LIMIT 1;
  IF customer IS NULL THEN
    INSERT INTO public.customers(name,phone,email,alt_phone,location,
      transactional_sms_consent,marketing_sms_consent,
      transactional_sms_consent_at,marketing_sms_consent_at,
      consent_source,consent_method,consent_form_version)
    VALUES (trim(payload->>'name'),
      '('||substr(phone_digits,1,3)||') '||substr(phone_digits,4,3)||'-'||substr(phone_digits,7),
      nullif(payload->>'email',''),nullif(payload->>'callBackNumber',''),shop,
      true,(payload->>'promotionalConsent')::boolean,
      now(),CASE WHEN (payload->>'promotionalConsent')::boolean THEN now() ELSE NULL END,
      'public_check_in','checkbox','v2') RETURNING id INTO customer;
  END IF;
  -- A public submission must never overwrite an existing customer's identity,
  -- contact information, or revoked consent merely by knowing their phone.
  -- Live projects may use legacy issue/numeric pricing rather than category/text.
  SELECT CASE WHEN jsonb_typeof(to_jsonb(p)->'price') = 'number'
    THEN '$' || (to_jsonb(p)->>'price') ELSE to_jsonb(p)->>'price' END
    INTO estimate FROM public.repair_prices p
    WHERE p.brand = payload->>'deviceBrand' AND p.model = payload->>'deviceModel'
      AND coalesce(to_jsonb(p)->>'category',to_jsonb(p)->>'issue') = payload->>'repairCategory' LIMIT 1;
  INSERT INTO public.tickets(customer_id,device,problem_description,heard_from,location,repair_type,estimated_cost)
    VALUES(customer,trim(payload->>'device'),trim(payload->>'problemDescription'),
      payload->>'heardFrom',shop,payload->>'repairCategory',estimate);
  INSERT INTO crm_private.intake_receipts VALUES (request_id,phone_digits,now());
END $$;
REVOKE ALL ON FUNCTION crm_private.crm_submit_check_in(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crm_private.crm_submit_check_in(uuid,jsonb) TO service_role;

-- Exposed RPC is an invoker wrapper; the privileged implementation stays private.
CREATE OR REPLACE FUNCTION public.crm_submit_check_in(request_id uuid, payload jsonb)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT crm_private.crm_submit_check_in(request_id,payload);
$$;
REVOKE ALL ON FUNCTION public.crm_submit_check_in(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_submit_check_in(uuid,jsonb) TO service_role;
COMMIT;
