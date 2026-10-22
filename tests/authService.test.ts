// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn(), from: vi.fn() }));
vi.mock('../supabaseClient', () => ({ AUTH_STORAGE_KEY: 'test-auth-token', supabase: {
  auth: mocks,
  from: mocks.from,
} }));
import { getVerifiedStaff, signInWithEmail, signOutStaff } from '../services/authService';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  const query = { select: vi.fn(() => query), eq: mocks.eq.mockImplementation(() => query), maybeSingle: mocks.maybeSingle };
  mocks.from.mockReturnValue(query);
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'verified-id', email: 'staff@example.test', user_metadata: { role: 'admin' } } } });
});
it('takes role from the membership record, never editable user metadata', async () => {
  mocks.maybeSingle.mockResolvedValue({ data: { name: 'Staff', role: 'staff', active: true } });
  expect((await getVerifiedStaff())?.role).toBe('staff');
  expect(mocks.eq).toHaveBeenCalledWith('user_id', 'verified-id');
  expect(mocks.eq).toHaveBeenCalledWith('active', true);
});
it('fails closed when membership cannot be read', async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
  expect(await getVerifiedStaff()).toBeNull();
});
it('does not query membership for an invalid server-verified session', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });
  expect(await getVerifiedStaff()).toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});
it('does not silently trim password characters', async () => {
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  await signInWithEmail(' staff@example.test ', ' password with spaces ');
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'staff@example.test', password: ' password with spaces ' });
});
it('removes trusted and tab sessions even if remote sign-out fails', async () => {
  localStorage.setItem('test-auth-token', 'trusted'); sessionStorage.setItem('test-auth-token', 'tab');
  mocks.signOut.mockRejectedValue(new Error('Offline'));
  await expect(signOutStaff()).rejects.toThrow('Offline');
  expect(localStorage.getItem('test-auth-token')).toBeNull(); expect(sessionStorage.getItem('test-auth-token')).toBeNull();
});
