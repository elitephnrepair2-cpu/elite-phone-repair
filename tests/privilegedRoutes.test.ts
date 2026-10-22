import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), serve: vi.fn(), getUser: vi.fn(), handler: null as any }));
vi.mock('../supabase/functions/_shared/runtime.ts', () => mocks);

beforeEach(() => {
  vi.clearAllMocks(); vi.resetModules();
  const env: Record<string,string> = { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' };
  vi.stubGlobal('Deno', { env: { get: (key: string) => env[key] } });
  mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: 'invalid' });
  mocks.serve.mockImplementation(handler => { mocks.handler = handler; });
});
const routes = import.meta.glob('../supabase/functions/*/index.ts');
it.each(['send-sms','send-facebook-messenger','update-sms-consent','clover-api','merge-duplicates',
  'process-scheduled','process-automations','process-appointment-sms','notify-new-quote'])('%s rejects a public key before parsing or performing privileged work', async name => {
  await routes[`../supabase/functions/${name}/index.ts`]();
  // An intentionally malformed body must never be processed by an unauthenticated caller.
  const request = new Request('https://db.example.test', {
    method: 'POST', headers: { Authorization: 'Bearer public-key' }, body: 'not-json',
  });
  const response = await mocks.handler(request);
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ ok: false });
});
