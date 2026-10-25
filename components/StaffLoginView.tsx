import React, { useState } from 'react';
import { signInWithEmail } from '../services/authService';
import { isTrustedDevice } from '../services/sessionStorage';

export function StaffLoginView({ businessName,onSignedIn }: { businessName: string;onSignedIn?:()=>Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustedDevice, setTrustedDevice] = useState(isTrustedDevice);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const result = await signInWithEmail(email, password, trustedDevice);
      if (!result.success) setError(result.error || 'Unable to sign in. Please try again.');
      else if(onSignedIn) await onSignedIn();
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setPassword('');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md rounded-3xl bg-slate-800 border border-slate-700 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{businessName}</h1>
          <p className="mt-2 text-slate-300">Sign in with your staff account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="staff-email" className="block mb-2">Email</label>
            <input id="staff-email" type="email" autoComplete="username" required value={email}
              onChange={e => setEmail(e.target.value)} disabled={loading}
              className="w-full rounded-xl p-3 bg-slate-900 border border-slate-600" />
          </div>
          <div>
            <label htmlFor="staff-password" className="block mb-2">Password</label>
            <input id="staff-password" type="password" autoComplete="current-password" required value={password}
              onChange={e => setPassword(e.target.value)} disabled={loading}
              className="w-full rounded-xl p-3 bg-slate-900 border border-slate-600" />
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input type="checkbox" checked={trustedDevice} onChange={e => setTrustedDevice(e.target.checked)} disabled={loading} className="mt-1" />
            <span>Keep me signed in on this trusted device
              <span className="block text-xs text-slate-400 mt-1">Use only on your own device. Refreshing keeps you signed in either way.</span>
            </span>
          </label>
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-red-600 p-3 font-bold disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-sm text-slate-400">Need an account or password help? Contact your store manager.</p>
        <a href="/?view=kiosk" className="block text-sm underline text-slate-300">Customer check-in</a>
      </div>
    </main>
  );
}
