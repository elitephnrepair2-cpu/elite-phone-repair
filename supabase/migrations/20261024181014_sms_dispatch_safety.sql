-- Service-only dispatch receipts persist BEFORE contacting Twilio. Never automatically
-- retry an ambiguous provider request: a database transaction cannot cover Twilio.
CREATE OR REPLACE FUNCTION crm_private.normalize_sms_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN digits ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' THEN '+1' || digits
    WHEN digits ~ '^1[2-9][0-9]{2}[2-9][0-9]{6}$' THEN '+' || digits END
  FROM (SELECT regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') digits) n
$$;
REVOKE ALL ON FUNCTION crm_private.normalize_sms_phone(text) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA crm_private TO service_role;
GRANT EXECUTE ON FUNCTION crm_private.normalize_sms_phone(text) TO service_role;

CREATE TABLE crm_private.sms_phone_preferences (
  phone text PRIMARY KEY,
  blocked boolean NOT NULL,
  provider_message_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_private.sms_inbound_receipts (
  provider_message_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_private.sms_dispatch_receipts (
  dispatch_key text PRIMARY KEY,
  fingerprint text NOT NULL,
  message_id uuid NOT NULL REFERENCES public.sms_messages(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('dispatching','sent','failed','skipped','uncertain')),
  provider_message_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_private.sms_phone_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_private.sms_inbound_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_private.sms_dispatch_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.sms_phone_preferences, crm_private.sms_inbound_receipts,
  crm_private.sms_dispatch_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON crm_private.sms_phone_preferences, crm_private.sms_inbound_receipts,
  crm_private.sms_dispatch_receipts TO service_role;

-- Preserve existing STOP/revocation history, including alternate phone numbers.
INSERT INTO crm_private.sms_phone_preferences(phone,blocked)
SELECT DISTINCT crm_private.normalize_sms_phone(n.phone),true
FROM public.customers c CROSS JOIN LATERAL (VALUES(c.phone),(c.alt_phone)) n(phone)
WHERE c.revoked_at IS NOT NULL AND c.revoked_reason IS DISTINCT FROM 'User opted out via UI'
  AND crm_private.normalize_sms_phone(n.phone) IS NOT NULL
ON CONFLICT (phone) DO NOTHING;
INSERT INTO crm_private.sms_inbound_receipts(provider_message_id)
SELECT DISTINCT provider_message_id FROM public.sms_messages
WHERE direction='inbound' AND provider_message_id ~ '^SM[0-9a-fA-F]{32}$'
ON CONFLICT DO NOTHING;
-- Built-in expression indexes keep phone checks fast without requiring browser
-- writes to execute a private helper function.
CREATE INDEX customers_sms_phone_digits_idx ON public.customers (regexp_replace(phone,'[^0-9]','','g'));
CREATE INDEX customers_sms_alt_phone_digits_idx ON public.customers (regexp_replace(alt_phone,'[^0-9]','','g'));


CREATE OR REPLACE FUNCTION public.crm_prepare_sms_dispatch(
  p_key text, p_fingerprint text, p_customer_id uuid, p_phone text,
  p_type text, p_content text, p_ticket_id uuid DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL, p_automation_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_phone text; v_customer_id uuid; v_reason text; v_message_id uuid; v_key text;
  v_receipt crm_private.sms_dispatch_receipts%ROWTYPE;
  v_count integer; v_revoked boolean; v_consent boolean;
BEGIN
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR
    p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_type IS NULL OR p_type NOT IN ('transactional','marketing') OR
    p_content IS NULL OR length(trim(p_content)) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Invalid SMS dispatch request' USING ERRCODE='22023';
  END IF;
  IF p_customer_id IS NOT NULL THEN
    SELECT c.id,crm_private.normalize_sms_phone(c.phone) INTO v_customer_id,v_phone
    FROM public.customers c WHERE c.id=p_customer_id;
    IF NOT FOUND THEN v_reason := 'Customer record not found.'; END IF;
  ELSE
    v_phone := crm_private.normalize_sms_phone(p_phone);
    SELECT c.id INTO v_customer_id FROM public.customers c
    WHERE regexp_replace(c.phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2))
      OR regexp_replace(c.alt_phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2))
    ORDER BY c.created_at,c.id LIMIT 1;
  END IF;
  -- Campaigns deduplicate by destination, even across duplicate contact records.
  v_key := CASE WHEN p_campaign_id IS NOT NULL AND v_phone IS NOT NULL
    THEN 'campaign:' || p_campaign_id::text || ':' || v_phone ELSE p_key END;
  -- Serializes simultaneous calls using the same key, including the first insert.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
  SELECT * INTO v_receipt FROM crm_private.sms_dispatch_receipts WHERE dispatch_key=v_key;
  IF FOUND THEN
    IF v_receipt.fingerprint <> p_fingerprint THEN
      RETURN jsonb_build_object('ok',false,'status','conflict','reason','Send key was already used for a different message.');
    END IF;
    RETURN jsonb_build_object('ok',v_receipt.state='sent','status',
      CASE WHEN v_receipt.state='dispatching' THEN 'uncertain' ELSE v_receipt.state END,
      'duplicate',true,'message_id',v_receipt.provider_message_id,
      'reason',coalesce(v_receipt.reason,'Previous send attempt is recorded; it will not be sent again.'));
  END IF;

  IF v_phone IS NULL THEN v_reason := coalesce(v_reason,'Invalid US phone number.'); END IF;

  IF v_reason IS NULL THEN
    -- The legacy UI trigger sets revoked_at when only marketing is unchecked.
    -- That marker uses the individual consent flags; it is not a phone-level STOP.
    SELECT count(*),bool_or(c.revoked_at IS NOT NULL AND c.revoked_reason IS DISTINCT FROM 'User opted out via UI'),
      bool_and(CASE WHEN p_type='marketing' THEN c.marketing_sms_consent IS TRUE ELSE c.transactional_sms_consent IS TRUE END)
    INTO v_count,v_revoked,v_consent FROM public.customers c
    WHERE regexp_replace(c.phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2))
      OR regexp_replace(c.alt_phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2));
    IF EXISTS(SELECT 1 FROM crm_private.sms_phone_preferences WHERE phone=v_phone AND blocked) OR v_revoked THEN
      v_reason := 'This phone number has opted out. The customer must reply START to resume texts.';
    ELSIF v_count=0 OR NOT coalesce(v_consent,false) THEN
      v_reason := CASE WHEN p_type='marketing' THEN 'Marketing consent not granted.' ELSE 'Transactional consent not granted.' END;
    END IF;
  END IF;

  INSERT INTO public.sms_messages(customer_id,ticket_id,campaign_id,automation_id,message_type,content,status,direction,to_phone,error_message)
  VALUES(v_customer_id,p_ticket_id,p_campaign_id,p_automation_id,p_type,p_content,
    CASE WHEN v_reason IS NULL THEN 'queued' ELSE 'skipped' END,'outbound',v_phone,v_reason)
  RETURNING id INTO v_message_id;
  INSERT INTO crm_private.sms_dispatch_receipts(dispatch_key,fingerprint,message_id,state,reason)
  VALUES(v_key,p_fingerprint,v_message_id,CASE WHEN v_reason IS NULL THEN 'dispatching' ELSE 'skipped' END,v_reason);
  RETURN jsonb_build_object('ok',false,'status',CASE WHEN v_reason IS NULL THEN 'dispatching' ELSE 'skipped' END,
    'claimed',v_reason IS NULL,'phone',v_phone,'reason',v_reason,'dispatch_key',v_key);
END $$;

CREATE OR REPLACE FUNCTION public.crm_finish_sms_dispatch(p_key text,p_state text,p_provider_id text DEFAULT NULL,p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_message_id uuid;
BEGIN
  IF p_state IS NULL OR p_state NOT IN ('sent','failed','uncertain') OR (p_state='sent' AND nullif(p_provider_id,'') IS NULL) THEN
    RAISE EXCEPTION 'Invalid SMS outcome';
  END IF;
  UPDATE crm_private.sms_dispatch_receipts SET state=p_state,provider_message_id=p_provider_id,reason=p_reason,updated_at=now()
  WHERE dispatch_key=p_key AND state='dispatching' RETURNING message_id INTO v_message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch is not awaiting an outcome'; END IF;
  UPDATE public.sms_messages SET status=CASE WHEN p_state='sent' THEN 'sent' ELSE 'failed' END,
    provider_message_id=p_provider_id,error_message=CASE WHEN p_state='uncertain' THEN
      'Delivery outcome unknown; review Twilio before retrying. ' || coalesce(p_reason,'') ELSE p_reason END
  WHERE id=v_message_id;
END $$;

CREATE OR REPLACE FUNCTION public.crm_record_inbound_sms(
  p_provider_id text,p_from text,p_to text,p_content text,p_opt_out text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_phone text; v_customer_id uuid; v_inserted text;
BEGIN
  v_phone := crm_private.normalize_sms_phone(p_from);
  IF v_phone IS NULL OR coalesce(p_provider_id,'') !~ '^SM[0-9a-fA-F]{32}$' OR p_content IS NULL OR
     (p_opt_out IS NOT NULL AND p_opt_out NOT IN ('STOP','START','HELP')) THEN RAISE EXCEPTION 'Invalid inbound SMS'; END IF;
  INSERT INTO crm_private.sms_inbound_receipts(provider_message_id) VALUES(p_provider_id)
    ON CONFLICT DO NOTHING RETURNING provider_message_id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN jsonb_build_object('duplicate',true); END IF;
  SELECT c.id INTO v_customer_id FROM public.customers c
  WHERE regexp_replace(c.phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2))
      OR regexp_replace(c.alt_phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2))
  ORDER BY c.created_at,c.id LIMIT 1;
  IF p_opt_out IN ('STOP','START') THEN
    INSERT INTO crm_private.sms_phone_preferences(phone,blocked,provider_message_id)
      VALUES(v_phone,p_opt_out='STOP',p_provider_id)
    ON CONFLICT(phone) DO UPDATE SET blocked=excluded.blocked,provider_message_id=excluded.provider_message_id,updated_at=now();
    UPDATE public.customers c SET
      transactional_sms_consent=p_opt_out='START',
      marketing_sms_consent=CASE WHEN p_opt_out='STOP' THEN false ELSE c.marketing_sms_consent END,
      revoked_at=CASE WHEN p_opt_out='STOP' THEN now() ELSE NULL END,
      revoked_reason=CASE WHEN p_opt_out='STOP' THEN 'Customer replied STOP' ELSE NULL END,
      consent_source='web',consent_method='keyword',
      transactional_sms_consent_at=CASE WHEN p_opt_out='START' THEN now() ELSE c.transactional_sms_consent_at END
    WHERE regexp_replace(c.phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2))
      OR regexp_replace(c.alt_phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2));
  END IF;
  INSERT INTO public.sms_messages(customer_id,from_phone,to_phone,message_type,direction,content,status,provider_message_id)
    VALUES(v_customer_id,v_phone,p_to,'transactional','inbound',p_content,'sent',p_provider_id);
  RETURN jsonb_build_object('duplicate',false,'customer_id',v_customer_id,'can_reply',
    v_customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM crm_private.sms_phone_preferences WHERE phone=v_phone AND blocked)
    AND NOT EXISTS(SELECT 1 FROM public.customers c WHERE
      (regexp_replace(c.phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2))
      OR regexp_replace(c.alt_phone,'[^0-9]','','g') IN (right(v_phone,10),substring(v_phone FROM 2)))
      AND ((c.revoked_at IS NOT NULL AND c.revoked_reason IS DISTINCT FROM 'User opted out via UI')
        OR c.transactional_sms_consent IS DISTINCT FROM true)));
END $$;

CREATE OR REPLACE FUNCTION public.crm_claim_appointment_sms(p_limit integer DEFAULT 10)
RETURNS SETOF public.appointment_sms_jobs LANGUAGE sql SET search_path = '' AS $$
  WITH due AS (SELECT id FROM public.appointment_sms_jobs WHERE status='pending' AND scheduled_for<=now()
    ORDER BY scheduled_for,id LIMIT least(greatest(p_limit,1),50) FOR UPDATE SKIP LOCKED)
  UPDATE public.appointment_sms_jobs j SET status='claimed',claimed_at=now() FROM due WHERE j.id=due.id RETURNING j.*
$$;
CREATE OR REPLACE FUNCTION public.crm_claim_scheduled_campaigns()
RETURNS SETOF public.scheduled_campaigns LANGUAGE sql SET search_path = '' AS $$
  WITH due AS (SELECT id FROM public.scheduled_campaigns WHERE status='pending' AND scheduled_for<=now()
    ORDER BY scheduled_for,id LIMIT 1 FOR UPDATE SKIP LOCKED)
  UPDATE public.scheduled_campaigns c SET status='sending' FROM due WHERE c.id=due.id RETURNING c.*
$$;
CREATE OR REPLACE FUNCTION public.crm_claim_automation_enrollments(p_limit integer DEFAULT 10)
RETURNS SETOF jsonb LANGUAGE sql SET search_path = '' AS $$
  WITH due AS (SELECT e.id FROM public.automation_enrollments e JOIN public.automations a ON a.id=e.automation_id
    WHERE e.status='active' AND a.status='active' AND e.processing_locked_at IS NULL AND e.next_execution_at<=now()
    ORDER BY e.next_execution_at,e.id LIMIT least(greatest(p_limit,1),50) FOR UPDATE OF e SKIP LOCKED),
  claimed AS (UPDATE public.automation_enrollments e SET processing_locked_at=now() FROM due WHERE e.id=due.id RETURNING e.*)
  SELECT to_jsonb(e) || jsonb_build_object('automation',to_jsonb(a),'contact',to_jsonb(c)) FROM claimed e
    JOIN public.automations a ON a.id=e.automation_id JOIN public.customers c ON c.id=e.contact_id
$$;

REVOKE ALL ON FUNCTION public.crm_prepare_sms_dispatch(text,text,uuid,text,text,text,uuid,uuid,uuid),
  public.crm_finish_sms_dispatch(text,text,text,text),public.crm_record_inbound_sms(text,text,text,text,text),
  public.crm_claim_appointment_sms(integer),public.crm_claim_scheduled_campaigns(),public.crm_claim_automation_enrollments(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_prepare_sms_dispatch(text,text,uuid,text,text,text,uuid,uuid,uuid),
  public.crm_finish_sms_dispatch(text,text,text,text),public.crm_record_inbound_sms(text,text,text,text,text),
  public.crm_claim_appointment_sms(integer),public.crm_claim_scheduled_campaigns(),public.crm_claim_automation_enrollments(integer)
  TO service_role;
