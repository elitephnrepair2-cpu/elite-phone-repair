import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('../supabase/functions/_shared/runtime.ts', () => mocks);
import { authorize } from '../supabase/functions/_shared/authorization';

beforeEach(() => {
  vi.clearAllMocks();
  const env: Record<string, string> = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'server-only-key', CRM_WORKER_SECRET: 'worker-secret' };
  vi.stubGlobal('Deno', { env: { get: (key: string) => env[key] } });
  const query = { select: () => query, eq: () => query, maybeSingle: mocks.maybeSingle };
  mocks.createClient.mockReturnValue({ auth: mocks, from: () => query });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: 'invalid' });
});
const req = (token = '') => new Request('https://example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
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
  mocks.maybeSingle.mockResolvedValue({ data: { role: 'staff' } });
  expect(await authorize(req('valid-staff'))).toBeNull();
  expect((await authorize(req('valid-staff'), { admin: true }))?.status).toBe(403);
});
it('permits approved admins', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin' } } });
  mocks.maybeSingle.mockResolvedValue({ data: { role: 'admin' } });
  expect(await authorize(req('valid-admin'), { admin: true })).toBeNull();
});
