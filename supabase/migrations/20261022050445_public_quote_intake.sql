BEGIN;

-- Preserve the existing Shopify form without exposing any saved quote rows.
-- It submits exactly these columns and does not request INSERT ... RETURNING.
GRANT INSERT (customer_name, phone, email, brand, model, issue, notes,
  is_manual, status, location) ON public.quotes TO anon;
DROP POLICY IF EXISTS crm_public_quote_insert ON public.quotes;
CREATE POLICY crm_public_quote_insert ON public.quotes FOR INSERT TO anon
WITH CHECK (
  coalesce(length(trim(customer_name)),0) BETWEEN 1 AND 120
  AND coalesce(length(phone),0) BETWEEN 10 AND 30
  AND regexp_replace(phone,'[^0-9]','','g') ~ '^1?[2-9][0-9]{2}[2-9][0-9]{6}$'
  AND coalesce(length(email),0) <= 254
  AND coalesce(length(trim(brand)),0) BETWEEN 1 AND 100
  AND coalesce(length(trim(model)),0) BETWEEN 1 AND 160
  AND coalesce(length(trim(issue)),0) BETWEEN 1 AND 200
  AND coalesce(length(notes),0) <= 4000
  AND location IN ('Beaumont','Houston')
  AND status = 'new' AND is_manual = false AND price IS NULL
);

-- Serialize checks so simultaneous submissions cannot race the allowance.
-- Approved staff and server jobs keep their normal quote-creation workflow.
CREATE OR REPLACE FUNCTION crm_private.limit_public_quote_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE digits text;
BEGIN
  IF crm_private.crm_is_staff() OR
    coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',
      current_setting('request.jwt.claim.role',true)) = 'service_role'
  THEN RETURN NEW; END IF;
  IF coalesce(length(NEW.phone),0) NOT BETWEEN 10 AND 30 THEN
    RAISE EXCEPTION 'Invalid quote request' USING ERRCODE = '22023';
  END IF;
  digits := right(regexp_replace(NEW.phone,'[^0-9]','','g'),10);
  PERFORM pg_advisory_xact_lock(2200261023);
  IF (SELECT count(*) FROM public.quotes WHERE created_at > now() - interval '10 minutes') >= 120
    OR (SELECT count(*) FROM public.quotes WHERE created_at > now() - interval '10 minutes'
      AND right(regexp_replace(phone,'[^0-9]','','g'),10) = digits) >= 3
  THEN RAISE EXCEPTION 'Quote requests temporarily unavailable' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION crm_private.limit_public_quote_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS crm_limit_public_quote_insert ON public.quotes;
CREATE TRIGGER crm_limit_public_quote_insert BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION crm_private.limit_public_quote_insert();

COMMIT;
