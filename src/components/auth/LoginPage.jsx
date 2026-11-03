import React from 'react';
import { BatteryCharging, ShieldAlert, Loader2, Info } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

export default function LoginPage({ business }) {
  const { signInWithGoogle, isSigningIn, authError, setAuthError } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      // Error handled inside AuthContext
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand Icon & Heading */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20 font-black">
            <BatteryCharging className="w-9 h-9 stroke-[2.5]" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {business?.businessName || 'TPS BATTERYS HOUSE'}
            </h1>
            <p className="text-xs text-amber-400 font-mono font-medium pt-0.5">
              GST Billing & Store Management System
            </p>
            {business?.gstin && (
              <p className="text-[11px] text-slate-400 pt-1">
                GSTIN: <span className="font-mono text-slate-300 font-semibold">{business.gstin}</span>
              </p>
            )}
          </div>
        </div>

        {/* Notice Card: Strict Access Control */}
        <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-slate-300 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Authorized Staff Only</span>
          </div>
          <p className="text-[11.5px] text-slate-400 leading-relaxed">
            Access to invoices, customer accounts, and store data requires explicit authorization by the business administrator.
          </p>
        </div>

        {/* Error Alert */}
        {authError && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-2.5 animate-fade-in">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11.5px]">
              {authError}
            </div>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-red-400 hover:text-white text-xs font-bold px-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Google Sign-In Button */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-white/5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Official Google G Logo SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-500 pt-1">
            Protected by Firebase Authentication & Cloud Firestore Rules
          </p>
        </div>
      </div>
    </div>
  );
}
