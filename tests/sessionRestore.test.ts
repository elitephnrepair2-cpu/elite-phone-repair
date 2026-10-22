// @vitest-environment jsdom
import { createClient } from '@supabase/supabase-js';
import { beforeEach, expect, it, vi } from 'vitest';
import { setTrustedDevice, staffSessionStorage } from '../services/sessionStorage';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
const token = () => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: 'test-staff', exp: Math.floor(Date.now()/1000)+3600 }))}.test-signature`;
const client = (key: string) => createClient('https://auth.example.test', 'public-test-key', {
  auth: { storageKey: key, persistSession: true, storage: staffSessionStorage, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: vi.fn(async () => Response.json({
    access_token: token(), refresh_token: 'test-refresh-token', expires_in: 3600, token_type: 'bearer',
    user: { id: 'test-staff', email: 'staff@example.test', user_metadata: {}, app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() },
  })) },
});
it.each([false,true])('restores the real auth-client session after refresh when trusted=%s', async trusted => {
  setTrustedDevice(trusted);
  const storageKey = `refresh-test-${trusted}`;
  const first = client(storageKey);
  const signedIn = await first.auth.signInWithPassword({ email: 'staff@example.test', password: 'test-password' });
  expect(signedIn.error).toBeNull();
  const refreshedPage = client(storageKey);
  const restored = await refreshedPage.auth.getSession();
  expect(restored.data.session?.user.email).toBe('staff@example.test');
  expect(restored.data.session?.refresh_token).toBe('test-refresh-token');
});
it('restores a trusted login when a later browser session has no tab storage', async () => {
  setTrustedDevice(true);
  const first = client('persistent-test');
  await first.auth.signInWithPassword({ email: 'staff@example.test', password: 'test-password' });
  sessionStorage.clear();
  const later = client('persistent-test');
  expect((await later.auth.getSession()).data.session?.user.id).toBe('test-staff');
});
