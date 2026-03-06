
import React, { useState } from 'react';

interface KioskLoginProps {
  onLogin: (password: string) => void;
  correctPassword?: string;
}

const KioskLogin: React.FC<KioskLoginProps> = ({ onLogin, correctPassword }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = correctPassword || '1271';
    if (password === target) {
      onLogin(password);
    } else {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
        <div className="mb-8">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Kiosk Mode</h1>
          <p className="text-slate-500 mt-2">Enter PIN to activate device check-in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              className={`w-full text-center text-4xl tracking-[1em] py-4 bg-slate-50 border-2 rounded-2xl focus:outline-none transition-all ${
                error ? 'border-red-500 ring-4 ring-red-100 animate-shake' : 'border-slate-200 focus:border-red-500'
              }`}
              autoFocus
            />
          </div>

          {error && <p className="text-red-500 font-semibold">Incorrect PIN</p>}

          <button
            type="submit"
            className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl text-xl hover:bg-red-700 transition-all shadow-lg active:scale-95"
          >
            Activate Kiosk
          </button>
        </form>

        <p className="mt-8 text-slate-400 text-sm">
          Elite Phone Repair CRM v1.0
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default KioskLogin;
