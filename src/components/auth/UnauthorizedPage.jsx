import React, { useState } from 'react';
import {
  ShieldX,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  UserCheck,
  AlertOctagon,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { AUTH_STATUS } from '../../context/authConstants';

export default function UnauthorizedPage({ business }) {
  const { user, authStatus, signOutUser, refreshMembership } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDisabled = authStatus === AUTH_STATUS.DISABLED;

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshMembership();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Status Header */}
        <div className="text-center space-y-3">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xl font-black ${
              isDisabled
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-red-500/10'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-amber-500/10'
            }`}
          >
            {isDisabled ? (
              <AlertOctagon className="w-9 h-9 stroke-[2.2]" />
            ) : (
              <ShieldX className="w-9 h-9 stroke-[2.2]" />
            )}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isDisabled ? 'Account Suspended' : 'Access Authorization Required'}
            </h1>
            <p className="text-xs text-slate-400 pt-1">
              {isDisabled
                ? 'Your staff account has been deactivated by the store administrator.'
                : 'Your Google identity is verified, but you are not on the authorized staff allowlist.'}
            </p>
          </div>
        </div>

        {/* Signed-In Identity Card */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Signed-In Google Identity</span>
            <span className="text-emerald-400 text-[10px] flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Identity Verified
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Google User'}
                className="w-11 h-11 rounded-full border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shrink-0">
                {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">
                {user?.displayName || 'Google User'}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Copyable UID Box */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Your Firebase Auth UID:</span>
              <span className="text-[10px] text-slate-500">Required for administrator provisioning</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl p-2">
              <code className="text-xs font-mono text-amber-400 truncate flex-1 select-all">
                {user?.uid}
              </code>
              <button
                type="button"
                onClick={handleCopyUid}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                title="Copy UID to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Administrator Contact & Setup Instructions */}
        <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-2 text-xs text-slate-300">
          <div className="font-semibold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Store Administrator Instructions</span>
          </div>

          {isDisabled ? (
            <p className="text-[11.5px] text-slate-400 leading-relaxed">
              If you believe this is an error or need your account reactivated, contact the business administrator of{' '}
              <strong className="text-slate-200">{business?.businessName || 'TPS BATTERYS HOUSE'}</strong>.
            </p>
          ) : (
            <div className="space-y-1.5 text-[11.5px] text-slate-400 leading-relaxed">
              <p>
                To gain access, share your <strong className="text-slate-200">UID</strong> above with the administrator.
              </p>
              <p>
                The administrator must create an active staff membership record in Firestore under:
              </p>
              <code className="block bg-slate-900 p-2 rounded-lg text-[10.5px] font-mono text-slate-300 border border-slate-800 break-all select-all">
                businesses/tps-battery-house/members/{user?.uid}
              </code>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {!isDisabled && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Verifying...' : 'Check Status Again'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={signOutUser}
            className="w-full sm:flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
