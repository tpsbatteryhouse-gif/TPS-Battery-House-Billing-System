import React from 'react';
import { BatteryCharging, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { AUTH_STATUS } from '../../context/authConstants';
import LoginPage from './LoginPage';
import UnauthorizedPage from './UnauthorizedPage';

export default function ProtectedRoute({ children, business }) {
  const { authStatus } = useAuth();

  // Loading / Checking verification state
  if (
    authStatus === AUTH_STATUS.LOADING ||
    authStatus === AUTH_STATUS.CHECKING_AUTHORIZATION
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
        <div className="text-center space-y-4 animate-pulse">
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
