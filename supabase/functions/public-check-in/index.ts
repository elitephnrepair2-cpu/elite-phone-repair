import { serve, createClient } from '../_shared/runtime.ts';
import { parseCheckIn, readLimitedBody } from '../_shared/checkIn.ts';

export async function handlePublicCheckIn(req: Request) {
  const allowedOrigins = (Deno.env.get('PUBLIC_CHECK_IN_ORIGINS') || '').split(',').map(v => v.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const allowed = allowedOrigins.includes(origin);
  const headers = {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json',
  };
  const respond = (status: number, ok: boolean) => new Response(JSON.stringify({ ok }), { status, headers });
  if (!allowed) return respond(403, false);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond(405, false);
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const hosts = (Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES') || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!secret || !hosts.length) return respond(503, false);

  let input: ReturnType<typeof parseCheckIn>;
  try { input = parseCheckIn(await readLimitedBody(req)); } catch { return respond(400, false); }
  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: input.verificationToken }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await verification.json();
    if (!verification.ok || result.success !== true || result.action !== 'check_in' || !hosts.includes(result.hostname)) return respond(403, false);
    const client = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.rpc('crm_submit_check_in', { request_id: input.requestId, payload: input.payload });
    if (error) return respond(error.code === 'P0001' ? 429 : 503, false);
    // No customer IDs, matching results or records are returned to the public.
    return respond(200, true);
  } catch { return respond(503, false); }
}

serve(handlePublicCheckIn);
