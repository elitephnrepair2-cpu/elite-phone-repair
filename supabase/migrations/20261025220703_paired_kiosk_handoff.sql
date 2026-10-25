CREATE TABLE crm_private.kiosk_devices (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.staff_members(user_id) ON DELETE CASCADE,
 location text NOT NULL CHECK(location IN ('Houston','Beaumont')),
 secret_hash text NOT NULL CHECK(secret_hash ~ '^[a-f0-9]{64}$'),
 pin_hash text NOT NULL CHECK(pin_hash ~ '^[a-f0-9]{64}$'), pin_salt text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days', revoked_at timestamptz,
 pin_attempts integer NOT NULL DEFAULT 0, pin_window timestamptz NOT NULL DEFAULT now(), blocked_until timestamptz,
 submit_count integer NOT NULL DEFAULT 0, submit_window timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE crm_private.kiosk_session_locks(session_id uuid PRIMARY KEY, user_id uuid NOT NULL, locked_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE crm_private.kiosk_unlock_sessions(session_id uuid PRIMARY KEY, user_id uuid NOT NULL, device_id uuid REFERENCES crm_private.kiosk_devices(id) ON DELETE SET NULL);
ALTER TABLE crm_private.kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_private.kiosk_session_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_private.kiosk_unlock_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_private.kiosk_devices,crm_private.kiosk_session_locks,crm_private.kiosk_unlock_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON crm_private.kiosk_devices,crm_private.kiosk_session_locks,crm_private.kiosk_unlock_sessions TO service_role;

CREATE FUNCTION crm_private.kiosk_session_open(p_user uuid,p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user IS NOT NULL AND p_session IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM crm_private.kiosk_session_locks WHERE session_id=p_session)
 AND NOT EXISTS(SELECT 1 FROM crm_private.kiosk_unlock_sessions s LEFT JOIN crm_private.kiosk_devices d ON d.id=s.device_id
   WHERE s.session_id=p_session AND (d.id IS NULL OR s.user_id<>p_user OR d.owner_id<>p_user OR d.revoked_at IS NOT NULL OR d.expires_at<=now()))
$$;
REVOKE ALL ON FUNCTION crm_private.kiosk_session_open(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION crm_private.crm_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.staff_members WHERE user_id=(SELECT auth.uid()) AND active)
 AND crm_private.kiosk_session_open((SELECT auth.uid()),nullif((SELECT auth.jwt())->>'session_id','')::uuid)
$$;
CREATE OR REPLACE FUNCTION crm_private.crm_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.staff_members WHERE user_id=(SELECT auth.uid()) AND active AND role='admin')
 AND crm_private.kiosk_session_open((SELECT auth.uid()),nullif((SELECT auth.jwt())->>'session_id','')::uuid)
$$;
DROP POLICY crm_membership_read ON public.staff_members;
CREATE POLICY crm_membership_read ON public.staff_members FOR SELECT TO authenticated
 USING ((SELECT crm_private.crm_is_staff()) AND (user_id=(SELECT auth.uid()) OR (SELECT crm_private.crm_is_admin())));

-- The Edge auth guard uses this same server-side lock; service-only arguments are
-- taken from the user/token verified by Supabase Auth, never browser metadata.
CREATE FUNCTION public.crm_authorize_staff_session(p_user uuid,p_session uuid) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT role FROM public.staff_members WHERE user_id=p_user AND active AND crm_private.kiosk_session_open(p_user,p_session)
$$;
GRANT EXECUTE ON FUNCTION crm_private.kiosk_session_open(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.crm_authorize_staff_session(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_authorize_staff_session(uuid,uuid) TO service_role;

CREATE FUNCTION public.crm_kiosk_device(
 p_action text,p_device uuid,p_secret_hash text,p_user uuid DEFAULT NULL,p_session uuid DEFAULT NULL,
 p_location text DEFAULT NULL,p_pin_hash text DEFAULT NULL,p_salt text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d crm_private.kiosk_devices%ROWTYPE;
BEGIN
 IF p_action='register' THEN
   IF NOT EXISTS(SELECT 1 FROM public.staff_members WHERE user_id=p_user AND active AND role='admin')
     OR NOT crm_private.kiosk_session_open(p_user,p_session) OR p_location IS NULL OR p_location NOT IN ('Houston','Beaumont')
     OR p_pin_hash IS NULL OR p_pin_hash !~ '^[a-f0-9]{64}$' OR length(coalesce(p_salt,''))<>32
   THEN RETURN NULL; END IF;
   INSERT INTO crm_private.kiosk_devices(id,owner_id,location,secret_hash,pin_hash,pin_salt)
    VALUES(p_device,p_user,p_location,p_secret_hash,p_pin_hash,p_salt) RETURNING * INTO d;
   RETURN jsonb_build_object('location',d.location,'expires_at',d.expires_at);
 END IF;
 SELECT * INTO d FROM crm_private.kiosk_devices WHERE id=p_device AND secret_hash=p_secret_hash FOR UPDATE;
 IF NOT FOUND OR d.revoked_at IS NOT NULL OR d.expires_at<=now()
   OR NOT EXISTS(SELECT 1 FROM public.staff_members WHERE user_id=d.owner_id AND active)
 THEN RETURN NULL; END IF;
 IF p_action='start' THEN
   IF d.owner_id IS DISTINCT FROM p_user OR p_session IS NULL THEN RETURN NULL; END IF;
   INSERT INTO crm_private.kiosk_session_locks(session_id,user_id) VALUES(p_session,p_user) ON CONFLICT DO NOTHING;
 ELSIF p_action='submit' THEN
   IF d.submit_window < now()-interval '10 minutes' THEN d.submit_count:=0;d.submit_window:=now(); END IF;
   IF d.submit_count>=60 THEN RETURN jsonb_build_object('limited',true); END IF;
   UPDATE crm_private.kiosk_devices SET submit_count=d.submit_count+1,submit_window=d.submit_window WHERE id=d.id;
 ELSIF p_action='unlock' THEN
   IF d.blocked_until>now() THEN RETURN jsonb_build_object('limited',true); END IF;
   IF d.pin_window < now()-interval '15 minutes' THEN d.pin_attempts:=0;d.pin_window:=now(); END IF;
   UPDATE crm_private.kiosk_devices SET pin_attempts=d.pin_attempts+1,pin_window=d.pin_window,
     blocked_until=CASE WHEN d.pin_attempts+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=d.id;
   RETURN jsonb_build_object('owner_id',d.owner_id,'pin_hash',d.pin_hash,'pin_salt',d.pin_salt);
 ELSIF p_action='bind_unlock' THEN
   IF p_user IS DISTINCT FROM d.owner_id OR p_session IS NULL THEN RETURN NULL; END IF;
   INSERT INTO crm_private.kiosk_unlock_sessions(session_id,user_id,device_id) VALUES(p_session,p_user,d.id);
   UPDATE crm_private.kiosk_devices SET pin_attempts=0,blocked_until=NULL,pin_window=now() WHERE id=d.id;
 ELSIF p_action='revoke' THEN
   IF p_user IS DISTINCT FROM d.owner_id OR NOT crm_private.kiosk_session_open(p_user,p_session) THEN RETURN NULL; END IF;
   UPDATE crm_private.kiosk_devices SET revoked_at=now() WHERE id=d.id;
 ELSE RETURN NULL;
 END IF;
 RETURN jsonb_build_object('owner_id',d.owner_id,'location',d.location,'expires_at',d.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.crm_kiosk_device(text,uuid,text,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crm_kiosk_device(text,uuid,text,uuid,uuid,text,text,text) TO service_role;

-- Use a consent source accepted by the live schema.
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
      'iPad','checkbox','v2') RETURNING id INTO customer;
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
