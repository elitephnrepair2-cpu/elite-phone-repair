import { tokenSessionId } from './kioskSecurity.ts';
import { createClient } from './runtime.ts';

type Options = { admin?: boolean; worker?: boolean; workerOnly?: boolean; headers?: Record<string, string> };

// Verify credentials before constructing any service-role business operation.
// The public anon key is deliberately never accepted as a worker credential.
export async function authorize(req: Request, options: Options = {}): Promise<Response | null> {
  const deny = (status: number, error: string) => new Response(JSON.stringify({ ok: false, error }), {
    status, headers: { ...options.headers, 'Content-Type': 'application/json' },
  });
  if (req.method !== 'POST') return deny(405, 'Method not allowed');
  try {
    const authorization = req.headers.get('Authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const workerSecret = Deno.env.get('CRM_WORKER_SECRET');
    if ((options.worker || options.workerOnly) && (
      (serviceKey && token === serviceKey) ||
      (workerSecret && req.headers.get('x-crm-worker-secret') === workerSecret)
    )) return null;
    if (options.workerOnly || !token) return deny(401, 'Authentication required');

    const url = Deno.env.get('SUPABASE_URL');
    if (!url || !serviceKey) return deny(503, 'Service unavailable');
    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const {data:{user},error:userError}=await client.auth.getUser(token);
    if(userError || !user)return deny(401,'Authentication required');
    const sessionId=tokenSessionId(token);
    if(!sessionId)return deny(403,'Staff access required');
    const {data:role,error:roleError}=await client.rpc('crm_authorize_staff_session',{p_user:user.id,p_session:sessionId});
    if(roleError)throw roleError;
    const identity=['admin','staff'].includes(role)?{role}:null;
    if (!identity || (options.admin && identity.role !== 'admin')) return deny(403,'Staff access required');
    return null;
  } catch {
    return deny(503, 'Service unavailable');
  }
}

// Decode a session ID only after Auth verifies the access token. The database
// denies permanently suspended handoff sessions and revoked/expired PIN devices.
export async function verifiedStaffIdentity(req:Request,client:any) {
  const token=(req.headers.get('Authorization') || '').replace(/^Bearer /,'');
  if(!token)return null;
  const {data:{user},error}=await client.auth.getUser(token);
  if(error || !user)return null;
  const sessionId=tokenSessionId(token);
  if(!sessionId)return null;
  const {data:role,error:accessError}=await client.rpc('crm_authorize_staff_session',{p_user:user.id,p_session:sessionId});
  if(accessError)throw new Error('Access check unavailable');
  if(!['admin','staff'].includes(role))return null;
  return {user,role,sessionId};
}
