import React, { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { getVerifiedStaff, signOutStaff, type StaffUser } from './services/authService';
import { StaffLoginView } from './components/StaffLoginView';

const StaffWorkspace = lazy(() => import('./StaffWorkspace'));
const PublicKiosk = lazy(() => import('./components/PublicKiosk'));
const InstantQuoteWidget = lazy(() => import('./components/InstantQuoteWidget'));

function Loading() {
  return <main className="min-h-screen grid place-items-center bg-slate-900 text-white" role="status">Checking access…</main>;
}

export function StaffAccess() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [checkedToken, setCheckedToken] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    localStorage.removeItem('elite_active_staff');
    localStorage.removeItem('elite_staff_pins');
    let mounted = true;
    let authEventSeen = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      if (mounted) setToken(session?.access_token || null);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted && !authEventSeen) setToken(error ? null : data.session?.access_token || null);
    }).catch(() => { if (mounted && !authEventSeen) setToken(null); });
    const recheck = () => setRevision(value => value + 1);
    window.addEventListener('focus', recheck);
    return () => { mounted = false; subscription.unsubscribe(); window.removeEventListener('focus', recheck); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Revalidate membership in the background on focus. Clearing the existing
    // member here remounts the entire CRM and reloads all records on every return.
    // A new token is still hidden by the checkedToken render guard below.
    if (!token) return;
    // Outside the auth event callback to avoid auth-client lock reentrancy.
    getVerifiedStaff().then(member => {
      if (!cancelled) { setStaff(member); setCheckedToken(token); }
    }).catch(() => {
      if (!cancelled) { setStaff(null); setCheckedToken(token); }
    });
    return () => { cancelled = true; };
  }, [token, revision]);

  if (token === undefined || (token && checkedToken !== token)) return <Loading />;
  if (!token) return <StaffLoginView businessName="Elite Phone Repair" />;
  if (!staff) return (
    <main className="min-h-screen grid place-items-center bg-slate-900 text-white p-6">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Staff access required</h1>
        <p>This account does not have access to the workstation. Ask your store manager for help.</p>
        <button className="rounded-xl border border-slate-500 p-3 mr-3" onClick={() => setRevision(value => value + 1)}>Check access again</button>
        <button className="rounded-xl bg-red-600 p-3" onClick={() => { setToken(null); setStaff(null); void signOutStaff().catch(() => {}); }}>Sign out</button>
      </div>
    </main>
  );
  // Private queries and subscriptions mount only after verified staff membership.
  return <Suspense fallback={<Loading />}><StaffWorkspace key={staff.id} activeStaff={staff} onSignOut={() => {
    setToken(null); setStaff(null); void signOutStaff().catch(() => {});
  }} /></Suspense>;
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'kiosk') return <Suspense fallback={<Loading />}><PublicKiosk /></Suspense>;
  if (view === 'quote_widget') return <Suspense fallback={<Loading />}><InstantQuoteWidget /></Suspense>;
  return <StaffAccess />;
}
