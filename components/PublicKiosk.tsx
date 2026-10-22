import React, { useEffect, useRef, useState } from 'react';
import KioskView from './KioskView';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient';

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

// This client cannot inherit a staff session from the shared workstation.
const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export default function PublicKiosk() {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const location = new URLSearchParams(window.location.search).get('location') === 'Houston' ? 'Houston' : 'Beaumont';
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    let disposed = false;
    const render = () => {
      if (disposed || !container.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey, action: 'check_in',
        callback: (value: string) => { setToken(value); setError(''); },
        'expired-callback': () => setToken(''),
        'error-callback': () => { setToken(''); setError('Verification could not load. Please ask the front desk for help.'); },
      });
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-elite-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.dataset.eliteTurnstile = 'true';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const failed = () => setError('Verification could not load. Please ask the front desk for help.');
    script.addEventListener('load', render);
    script.addEventListener('error', failed);
    render();
    return () => {
      disposed = true;
      script.removeEventListener('load', render);
      script.removeEventListener('error', failed);
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  return <main className="min-h-screen bg-slate-900 p-4 sm:p-8">
    <p className="text-center text-white mb-4">Customer check-in · {location}</p>
    <KioskView onExitKiosk={() => window.location.assign('/')} canSubmit={Boolean(siteKey && token)}
      verification={<div className="space-y-2">
        <div ref={container} />
        {!siteKey && <p role="alert">Online check-in is unavailable. Please ask the front desk for help.</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
      </div>}
      onCheckIn={async data => {
        if (!token) return false;
        try {
          const { data: result, error: submitError } = await publicClient.functions.invoke('public-check-in', {
            body: { ...data, location, requestId: requestId.current, verificationToken: token },
          });
          if (submitError || result?.ok !== true) {
            setError('Check-in could not be completed. Please try again or ask the front desk for help.');
            return false;
          }
          requestId.current = crypto.randomUUID();
          setError('');
          return true;
        } catch {
          setError('Check-in could not be completed. Please try again or ask the front desk for help.');
          return false;
        } finally {
          setToken('');
          if (widgetId.current) window.turnstile?.reset(widgetId.current);
        }
      }} />
  </main>;
}
