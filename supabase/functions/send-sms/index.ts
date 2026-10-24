import { authorize } from '../_shared/authorization.ts';
import { serve, createClient } from '../_shared/runtime.ts';
import { dispatchSms } from '../_shared/smsDispatch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = await authorize(req, { worker:true, headers:corsHeaders });
  if (denied) return denied;
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const payload = await req.json();
    if (typeof payload.idempotency_key !== 'string') {
      return Response.json({ ok:false, error:'Refresh the CRM before sending messages.' }, { status:400, headers:corsHeaders });
    }
    const result = await dispatchSms(db, payload);
    return Response.json(result, { headers:corsHeaders });
  } catch {
    return Response.json({ ok:false, error:'Could not send message. Check the recipient, consent and send status before retrying.' },
      { status:400, headers:corsHeaders });
  }
});
