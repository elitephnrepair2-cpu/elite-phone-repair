import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), maybeSingle: vi.fn(), rpc:vi.fn() }));
vi.mock('../supabase/functions/_shared/runtime.ts', () => mocks);
import { authorize } from '../supabase/functions/_shared/authorization';

beforeEach(() => {
  vi.clearAllMocks();
  const env: Record<string, string> = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'server-only-key', CRM_WORKER_SECRET: 'worker-secret' };
  vi.stubGlobal('Deno', { env: { get: (key: string) => env[key] } });
  const query = { select: () => query, eq: () => query, maybeSingle: mocks.maybeSingle };
  mocks.createClient.mockReturnValue({ auth: mocks, from: () => query, rpc:mocks.rpc });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: 'invalid' });
  mocks.rpc.mockResolvedValue({data:null,error:null});
});
const jwt='header.'+btoa(JSON.stringify({session_id:'00000000-0000-4000-8000-000000000099'}))+'.signature';
const req = (token = '') => new Request('https://example.test', { method: 'POST', headers: { Authorization: `Bearer ${token.startsWith('valid-')?jwt:token}` } });
it('rejects an anonymous API key even for worker-enabled functions', async () => {
  expect((await authorize(req('public-anon-key'), { worker: true }))?.status).toBe(401);
});
it('allows only the actual server credential on a worker-only endpoint', async () => {
  expect(await authorize(req('server-only-key'), { workerOnly: true })).toBeNull();
  expect((await authorize(req('public-anon-key'), { workerOnly: true }))?.status).toBe(401);
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it('rejects an authenticated non-member even with admin user metadata', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'outsider', user_metadata: { role: 'admin' } } } });
  mocks.maybeSingle.mockResolvedValue({ data: null });
  expect((await authorize(req('valid-user')))?.status).toBe(403);
});
it('permits staff messaging but denies staff-only credentials on admin endpoints', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'staff' } } });
  mocks.rpc.mockResolvedValue({data:'staff',error:null});
  expect(await authorize(req('valid-staff'))).toBeNull();
  expect((await authorize(req('valid-staff'), { admin: true }))?.status).toBe(403);
});
it('permits approved admins', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin' } } });
  mocks.rpc.mockResolvedValue({data:'admin',error:null});
  expect(await authorize(req('valid-admin'), { admin: true })).toBeNull();
});

it('denies an otherwise valid staff token after the server suspends its kiosk handoff session',async()=>{
 mocks.getUser.mockResolvedValue({data:{user:{id:'staff'}}});mocks.rpc.mockResolvedValue({data:null,error:null});
 expect((await authorize(req('valid-locked')))?.status).toBe(403);
 expect(mocks.rpc).toHaveBeenCalledWith('crm_authorize_staff_session',expect.objectContaining({p_user:'staff'}));
});
