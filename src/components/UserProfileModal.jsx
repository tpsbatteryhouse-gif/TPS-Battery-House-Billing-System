import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Building,
  LogOut,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { ROLE_CONFIG } from '../utils/permissions';
import { MOCK_USER } from '../data/mockData';

export default function UserProfileModal({ isOpen, onClose, onSignOut }) {
  const [copied, setCopied] = useState(false);
  const authContext = useAuth();
  const user = authContext?.user;
  const member = authContext?.member;
  const signOutUser = authContext?.signOutUser;

  if (!isOpen) return null;

  const displayName = member?.displayName || user?.displayName || MOCK_USER.name;
  const email = member?.email || user?.email || MOCK_USER.email;
  const roleKey = member?.role || 'admin';
  const roleCfg = ROLE_CONFIG[roleKey] || ROLE_CONFIG.admin;
  const uid = user?.uid || 'local-demo-uid';

  const avatarInitials = (displayName || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleCopyUid = () => {
    if (uid) {
      navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOutClick = () => {
    onClose();
    if (signOutUser) {
      signOutUser();
    }
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Staff Member Profile</h2>
              <p className="text-[11px] text-slate-400">Firebase Google Authentication</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Avatar and Main Info */}
          <div className="flex items-center gap-3.5 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                className="w-13 h-13 rounded-2xl border border-slate-700 object-cover shadow-lg"
              />
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-extrabold text-lg flex items-center justify-center shadow-lg shadow-amber-500/10">
                {avatarInitials}
              </div>
            )}
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white truncate">{displayName}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleCfg.badgeColor}`}>
                  {roleCfg.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{email}</span>
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono pt-0.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Active Member Allowlist</span>
              </div>
            </div>
          </div>

          {/* Firebase UID Section */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-medium">Firebase Auth UID</span>
              <span className="text-[10px] text-slate-500 font-mono">Unique ID</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
              <code className="text-[11px] font-mono text-amber-400 truncate flex-1 select-all">
                {uid}
              </code>
              <button
                type="button"
                onClick={handleCopyUid}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Assigned Store & Role Permissions */}
          <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 space-y-2">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              Assigned Business & Permissions
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-white">TPS BATTERYS HOUSE</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {roleCfg.description}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSignOutClick}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
