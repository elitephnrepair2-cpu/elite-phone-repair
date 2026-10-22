BEGIN;
-- Provision crm_project_url, crm_anon_key and crm_worker_secret in Vault first.
-- CRM_WORKER_SECRET in Edge Function secrets must match the private Vault value.
CREATE OR REPLACE FUNCTION crm_private.worker_headers()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE gateway_key text; worker_key text;
BEGIN
  SELECT decrypted_secret INTO gateway_key FROM vault.decrypted_secrets WHERE name='crm_anon_key';
  SELECT decrypted_secret INTO worker_key FROM vault.decrypted_secrets WHERE name='crm_worker_secret';
  IF coalesce(gateway_key,'') = '' OR coalesce(worker_key,'') = '' THEN
    RAISE EXCEPTION 'Worker credentials are not configured';
  END IF;
  RETURN jsonb_build_object('Content-Type','application/json',
    'Authorization','Bearer ' || gateway_key,'x-crm-worker-secret',worker_key);
END $$;
REVOKE ALL ON FUNCTION crm_private.worker_headers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA vault FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_quote_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE project_url text;
BEGIN
  SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name='crm_project_url';
  IF coalesce(project_url,'') = '' THEN RAISE EXCEPTION 'Worker URL is not configured'; END IF;
  PERFORM net.http_post(url := project_url || '/functions/v1/notify-new-quote',
    headers := crm_private.worker_headers(),
    body := jsonb_build_object('record',to_jsonb(NEW)));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_new_quote_fn() FROM PUBLIC, anon, authenticated;

-- Keep the existing schedule and job identity, changing only its authentication.
DO $$ DECLARE job record; project_url text; BEGIN
  SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name='crm_project_url';
  IF coalesce(project_url,'') = '' THEN RAISE EXCEPTION 'Worker URL is not configured'; END IF;
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR job IN SELECT jobid FROM cron.job WHERE jobname='process-scheduled-campaigns' LOOP
      PERFORM cron.alter_job(job.jobid, command := format(
        'SELECT net.http_post(url := %L, headers := crm_private.worker_headers(), body := %L::jsonb);',
        project_url || '/functions/v1/process-scheduled','{}'));
    END LOOP;
  END IF;
END $$;
COMMIT;
