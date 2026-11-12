import React, { useState, useEffect } from 'react';
import { BatteryCharging, Loader2, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { AUTH_STATUS } from '../../context/authConstants';
import LoginPage from './LoginPage';
import UnauthorizedPage from './UnauthorizedPage';

export default function ProtectedRoute({ children, business }) {
  const { authStatus, signOutUser, refreshMembership } = useAuth();
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Guard against indefinite loading states
  useEffect(() => {
    if (
      authStatus !== AUTH_STATUS.LOADING &&
      authStatus !== AUTH_STATUS.CHECKING_AUTHORIZATION
    ) {
      return;
    }

    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, 7000);

    return () => {
      clearTimeout(timer);
      setIsTimedOut(false);
    };
  }, [authStatus]);

  // Loading / Checking verification state
  if (
    authStatus === AUTH_STATUS.LOADING ||
    authStatus === AUTH_STATUS.CHECKING_AUTHORIZATION
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
            <BatteryCharging className="w-9 h-9 stroke-[2.5]" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>
                {authStatus === AUTH_STATUS.CHECKING_AUTHORIZATION
                  ? 'Verifying staff membership...'
                  : 'Connecting to TPS Battery House...'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Validating administrator access permissions
            </p>
          </div>

          {/* Recovery options if loading takes longer than expected */}
          {isTimedOut && (
            <div className="pt-4 border-t border-slate-800 space-y-3 animate-in fade-in duration-300">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2 text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Connection is taking longer than expected. Please check your network.</span>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (refreshMembership) {
                      refreshMembership();
                    } else if (typeof window !== 'undefined') {
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Verification</span>
                </button>
                {signOutUser && (
                  <button
                    type="button"
                    onClick={signOutUser}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign In with Different Account</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not signed in with Google
  if (authStatus === AUTH_STATUS.UNAUTHENTICATED) {
    return <LoginPage business={business} />;
  }

  // Signed in with Google, but not approved or disabled in Firestore
  if (
    authStatus === AUTH_STATUS.UNAUTHORIZED ||
    authStatus === AUTH_STATUS.DISABLED
  ) {
    return <UnauthorizedPage business={business} />;
  }

  // Active authorized member
  return <>{children}</>;
}
