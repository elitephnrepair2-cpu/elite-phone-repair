import { beforeEach, expect, it, vi } from 'vitest';
import { parseCheckIn, readLimitedBody } from '../supabase/functions/_shared/checkIn';
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), serve: vi.fn(), rpc: vi.fn() }));
vi.mock('../supabase/functions/_shared/runtime.ts', () => mocks);
import { handlePublicCheckIn } from '../supabase/functions/public-check-in';

export const valid = {
  requestId: '11111111-1111-4111-8111-111111111111', verificationToken: 'valid-challenge',
  name: 'Test Customer', phone: '(409) 555-1212', email: '', callBackNumber: '',
  deviceBrand: 'Apple', deviceModel: 'iPhone 12', device: 'Apple iPhone 12',
  repairCategory: 'Screen', problemDescription: 'Broken screen', heardFrom: 'Other', location: 'Beaumont',
  transactionalConsent: true, promotionalConsent: false,
};
let env: Record<string, string>;
beforeEach(() => {
  vi.clearAllMocks();
  env = { PUBLIC_CHECK_IN_ORIGINS: 'https://crm.example.test', TURNSTILE_SECRET_KEY: 'secret',
    TURNSTILE_ALLOWED_HOSTNAMES: 'crm.example.test', SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service' };
  vi.stubGlobal('Deno', { env: { get: (key: string) => env[key] } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'crm.example.test', action: 'check_in' })));
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null });
});
const request = (body = valid, origin = 'https://crm.example.test') => new Request('https://db.example.test/functions/v1/public-check-in', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
it('strips any supplied IDs, roles, prices, and client IPs', () => {
  const parsed = parseCheckIn({ ...valid, customer_id: 'victim', price: 0, role: 'admin', consent_ip: 'fake' });
  expect(parsed.payload).not.toHaveProperty('customer_id');
  expect(parsed.payload).not.toHaveProperty('price');
  expect(parsed.payload).not.toHaveProperty('consent_ip');
});
it.each([{ phone: '123' }, { location: 'unknown' }, { transactionalConsent: false }, { promotionalConsent: 'true' }, { name: 'x'.repeat(121) }])('rejects invalid or oversized fields %j', change => {
  expect(() => parseCheckIn({ ...valid, ...change })).toThrow();
});
it('limits the actual streamed request body', async () => {
  const req = new Request('https://example.test', { method: 'POST', body: 'x'.repeat(17000) });
  await expect(readLimitedBody(req)).rejects.toThrow('Body too large');
});
it('fails closed when verification is not configured', async () => {
  delete env.TURNSTILE_SECRET_KEY;
  expect((await handlePublicCheckIn(request())).status).toBe(503);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('denies an unapproved origin before any verification or database request', async () => {
  expect((await handlePublicCheckIn(request(valid, 'https://evil.test'))).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([{ success: false }, { success: true, hostname: 'evil.test', action: 'check_in' }, { success: true, hostname: 'crm.example.test', action: 'other' }])('rejects failed or misbound verification %j', async result => {
  vi.mocked(fetch).mockResolvedValue(Response.json(result));
  expect((await handlePublicCheckIn(request())).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('returns only a generic success and delegates one transaction after verification', async () => {
  const response = await handlePublicCheckIn(request());
  expect(await response.json()).toEqual({ ok: true });
  expect(mocks.rpc).toHaveBeenCalledWith('crm_submit_check_in', { request_id: valid.requestId, payload: parseCheckIn(valid).payload });
});
it('does not leak database details or existing customer information', async () => {
  mocks.rpc.mockResolvedValue({ error: { message: 'customer_id=secret-id', code: '23505' } });
  const response = await handlePublicCheckIn(request());
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false });
});
