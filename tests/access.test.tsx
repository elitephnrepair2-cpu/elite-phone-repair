vi.mock('../services/kioskDeviceService',()=>({isKioskLocked:()=>Boolean(localStorage.getItem('elite_kiosk_handoff_v1')),KIOSK_LOCK_EVENT:'elite-kiosk-handoff'}));
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), getVerifiedStaff: vi.fn(), signOutStaff: vi.fn(),
  signInWithEmail: vi.fn(), workspace: vi.fn(), mounted:vi.fn(), unmounted:vi.fn(), authChanged: null as any,
}));
vi.mock('../supabaseClient', () => ({ supabase: { auth: mocks } }));
vi.mock('../services/authService', () => mocks);
vi.mock('../StaffWorkspace', () => ({ default: (props: any) => {
  React.useEffect(()=>{ mocks.mounted(); return ()=>mocks.unmounted(); },[]);
  mocks.workspace(props); return <div>Private workspace<button onClick={props.onSignOut}>Lock workstation</button></div>;
} }));
vi.mock('../components/PublicKiosk', () => ({ default: () => <div>Public check-in</div> }));
vi.mock('../components/InstantQuoteWidget', () => ({ default: () => <div>Public prices</div> }));
import App, { StaffAccess } from '../App';

const member = { id: 'staff-id', name: 'Staff', email: 'staff@example.test', role: 'staff' };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, '', '/');
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockImplementation(callback => {
    mocks.authChanged = callback; return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.getVerifiedStaff.mockResolvedValue(member);
});
afterEach(cleanup);

describe('workstation access', () => {
  it('ignores forged local workstation identities and never mounts private queries for visitors', async () => {
    localStorage.setItem('elite_active_staff', JSON.stringify({ role: 'admin' }));
    localStorage.setItem('elite_staff_pins', JSON.stringify({ '1234': { role: 'admin' } }));
    render(<StaffAccess />);
    await screen.findByRole('button', { name: 'Sign in' });
    expect(mocks.workspace).not.toHaveBeenCalled();
    expect(mocks.getVerifiedStaff).not.toHaveBeenCalled();
    expect(localStorage.getItem('elite_active_staff')).toBeNull();
  });

  it('requires verified membership before mounting private screens', async () => {
    let verify: (value: unknown) => void;
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    mocks.getVerifiedStaff.mockReturnValue(new Promise(resolve => { verify = resolve; }));
    render(<StaffAccess />);
    await waitFor(() => expect(mocks.getVerifiedStaff).toHaveBeenCalled());
    expect(mocks.workspace).not.toHaveBeenCalled();
    await act(async () => verify(member));
    await screen.findByText('Private workspace');
  });

  it('denies an authenticated account without staff membership', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'outsider' } } });
    mocks.getVerifiedStaff.mockResolvedValue(null);
    render(<StaffAccess />);
    await screen.findByText('Staff access required');
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it('unmounts private screens on sign-out and ignores a stale membership response', async () => {
    let verify: (value: unknown) => void;
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    mocks.getVerifiedStaff.mockReturnValue(new Promise(resolve => { verify = resolve; }));
    render(<StaffAccess />);
    await waitFor(() => expect(mocks.getVerifiedStaff).toHaveBeenCalled());
    act(() => mocks.authChanged('SIGNED_OUT', null));
    await screen.findByRole('button', { name: 'Sign in' });
    await act(async () => verify(member));
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it('locks the workstation immediately even before the sign-out request completes', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    mocks.signOutStaff.mockReturnValue(new Promise(() => {}));
    render(<StaffAccess />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lock workstation' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByText('Private workspace')).toBeNull();
  });

  it.each(['kiosk', 'quote_widget'])('public %s does not mount the staff session or private workspace', async view => {
    window.history.replaceState(null, '', `/?view=${view}`);
    render(<App />);
    await screen.findByText(view === 'kiosk' ? 'Public check-in' : 'Public prices');
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it.each([false,true])('passes the explicit trusted-device choice to sign-in (%s)', async trusted => {
    mocks.signInWithEmail.mockResolvedValue({ success: false, error: 'Test login denied' });
    render(<StaffAccess />);
    await screen.findByRole('button', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    if (trusted) fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocks.signInWithEmail).toHaveBeenCalledWith('staff@example.test','password',trusted));
  });
});

it('keeps the same workstation mounted during a focus access check',async()=>{
  mocks.getSession.mockResolvedValue({data:{session:{access_token:'token'}}});
  render(<StaffAccess/>); await screen.findByText('Private workspace');
  let resolve:any; mocks.getVerifiedStaff.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
  act(()=>window.dispatchEvent(new Event('focus')));
  await waitFor(()=>expect(mocks.getVerifiedStaff).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Private workspace')).toBeTruthy();
  expect(mocks.mounted).toHaveBeenCalledTimes(1);expect(mocks.unmounted).not.toHaveBeenCalled();
  await act(async()=>resolve(member));
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
});
it('still removes workstation access when a background check finds revoked membership',async()=>{
  mocks.getSession.mockResolvedValue({data:{session:{access_token:'token'}}});
  render(<StaffAccess/>); await screen.findByText('Private workspace');
  mocks.getVerifiedStaff.mockResolvedValueOnce(null);
  act(()=>window.dispatchEvent(new Event('focus')));
  await screen.findByText('Staff access required');expect(screen.queryByText('Private workspace')).toBeNull();
});
it('a new session token cannot reuse the previous token’s membership check',async()=>{
  mocks.getSession.mockResolvedValue({data:{session:{access_token:'first-token'}}});
  render(<StaffAccess/>); await screen.findByText('Private workspace');
  let resolve:any; mocks.getVerifiedStaff.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
  act(()=>mocks.authChanged('SIGNED_IN',{access_token:'different-token'}));
  expect(screen.queryByText('Private workspace')).toBeNull();
  await waitFor(()=>expect(mocks.getVerifiedStaff).toHaveBeenCalledTimes(2));
  await act(async()=>resolve(null));await screen.findByText('Staff access required');
});

it('handoff mode overrides Back/direct staff URLs and never mounts private queries',async()=>{
 localStorage.setItem('elite_kiosk_handoff_v1','Houston');window.history.replaceState(null,'','/?view=settings');
 mocks.getSession.mockResolvedValue({data:{session:{access_token:'old-staff-token'}}});
 render(<App/>);await screen.findByText('Public check-in');
 expect(mocks.getSession).not.toHaveBeenCalled();expect(mocks.workspace).not.toHaveBeenCalled();
});
