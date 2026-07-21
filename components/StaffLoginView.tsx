import React, { useState } from 'react';
import { StaffUser, authenticateWithPin, signInWithEmail } from '../services/authService';

interface StaffLoginViewProps {
  onLoginSuccess: (user: StaffUser) => void;
  businessName: string;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({
  onLoginSuccess,
  businessName
}) => {
  const [loginMode, setLoginMode] = useState<'pin' | 'email'>('pin');
  const [pin, setPin] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (pin.length < 4) {
      setErrorMsg("Please enter a 4-digit Staff PIN.");
      return;
    }

    const staff = authenticateWithPin(pin);
    if (staff) {
      onLoginSuccess(staff);
    } else {
      setErrorMsg("Invalid Staff PIN. Please check and try again.");
      setPin('');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await signInWithEmail(email, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.error || "Authentication failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected login error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setErrorMsg(null);
    }
  };

  const handleClearPin = () => {
    setPin('');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-700/80 relative z-10 text-white space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/20 text-red-500 rounded-2xl border border-red-500/30 mb-2 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">{businessName}</h1>
          <p className="text-xs text-slate-400 font-medium">Staff Workstation Authentication & Portal Access</p>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => { setLoginMode('pin'); setErrorMsg(null); }}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'pin'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🔢 Staff PIN Access</span>
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('email'); setErrorMsg(null); }}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'email'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>✉️ Supabase Auth</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold text-center animate-in fade-in duration-150">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* PIN Login Form */}
        {loginMode === 'pin' ? (
          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="text-center space-y-2">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                Enter 4-Digit Staff PIN
              </label>
              
              {/* PIN Dots Display */}
              <div className="flex justify-center items-center gap-4 py-2">
                {[0, 1, 2, 3].map(index => (
                  <div
                    key={index}
                    className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                      pin.length > index
                        ? 'border-red-500 bg-red-600/20 text-red-400 shadow-sm'
                        : 'border-slate-700 bg-slate-900/60 text-slate-600'
                    }`}
                  >
                    {pin.length > index ? '●' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumClick(num)}
                  className="h-12 bg-slate-900/80 hover:bg-slate-700/80 active:bg-red-600 text-white font-extrabold text-lg rounded-2xl border border-slate-700 transition-all shadow-sm"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                className="h-12 bg-slate-900/50 hover:bg-rose-900/40 text-rose-400 font-bold text-xs rounded-2xl border border-slate-800 transition-all flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleNumClick('0')}
                className="h-12 bg-slate-900/80 hover:bg-slate-700/80 active:bg-red-600 text-white font-extrabold text-lg rounded-2xl border border-slate-700 transition-all shadow-sm"
              >
                0
              </button>
              <button
                type="submit"
                disabled={pin.length < 4}
                className="h-12 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-extrabold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center"
              >
                Enter →
              </button>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-700/60 text-center text-[11px] text-slate-400 space-y-1">
              <p className="font-bold text-slate-300">Default Workstation PINs:</p>
              <p><span className="text-amber-400 font-bold">1234</span> = Front Desk Staff | <span className="text-amber-400 font-bold">7777</span> = Store Manager</p>
            </div>
          </form>
        ) : (
          /* Email Auth Form */
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Staff Email Address
              </label>
              <input
                type="email"
                placeholder="staff@elitephonerepair.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none text-white placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Account Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none text-white placeholder-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to Workstation</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
