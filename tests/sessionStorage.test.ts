// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { isTrustedDevice, setTrustedDevice, staffSessionStorage } from '../services/sessionStorage';

const key = 'sb-example-auth-token';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
it('keeps an ordinary tab session across module reloads without persisting to local storage', async () => {
  staffSessionStorage.setItem(key, 'session');
  expect(sessionStorage.getItem(key)).toBe('session');
  expect(localStorage.getItem(key)).toBeNull();
  vi.resetModules();
  const refreshed = await import('../services/sessionStorage');
  expect(refreshed.staffSessionStorage.getItem(key)).toBe('session');
});
it('persists only explicitly trusted sessions across a new browser tab session', () => {
  setTrustedDevice(true);
  staffSessionStorage.setItem(key, 'trusted-session');
  sessionStorage.clear();
  expect(isTrustedDevice()).toBe(true);
  expect(staffSessionStorage.getItem(key)).toBe('trusted-session');
});
it('does not restore an ordinary session after its tab storage is cleared', () => {
  staffSessionStorage.setItem(key, 'session');
  sessionStorage.clear();
  expect(staffSessionStorage.getItem(key)).toBeNull();
});
it('clears both storage locations on sign-out', () => {
  localStorage.setItem(key, 'old-local'); sessionStorage.setItem(key, 'old-tab');
  staffSessionStorage.removeItem(key);
  expect(localStorage.getItem(key)).toBeNull(); expect(sessionStorage.getItem(key)).toBeNull();
});
it('does not silently trust a legacy persistent login', () => {
  localStorage.setItem(key, 'legacy');
  expect(staffSessionStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem(key)).toBeNull();
});
it('moves a new untrusted login out of persistent storage', () => {
  setTrustedDevice(true); staffSessionStorage.setItem(key, 'trusted-session');
  setTrustedDevice(false); staffSessionStorage.setItem(key, 'tab-session');
  expect(localStorage.getItem(key)).toBeNull(); expect(sessionStorage.getItem(key)).toBe('tab-session');
});
