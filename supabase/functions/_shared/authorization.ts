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
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return deny(401, 'Authentication required');
    const { data: member, error: memberError } = await client.from('staff_members')
      .select('role').eq('user_id', user.id).eq('active', true).maybeSingle();
    if (memberError || !member || !['staff', 'admin'].includes(member.role) || (options.admin && member.role !== 'admin')) {
      return deny(403, 'Staff access required');
    }
    return null;
  } catch {
    return deny(503, 'Service unavailable');
  }
}
