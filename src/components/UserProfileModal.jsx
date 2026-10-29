import React from 'react';
import { X, User, Mail, Phone, MapPin, Building, Info, LogOut } from 'lucide-react';
import { MOCK_USER } from '../data/mockData';

export default function UserProfileModal({ isOpen, onClose, onSignOut }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Operator Profile</h2>
              <p className="text-[11px] text-slate-400">Frontend Simulation Session</p>
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
          <div className="flex items-center gap-3.5 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-extrabold text-lg flex items-center justify-center shadow-lg shadow-amber-500/10">
              {MOCK_USER.avatarInitials}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{MOCK_USER.name}</span>
                <span className="bg-amber-500/15 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                  {MOCK_USER.role}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-500" />
                {MOCK_USER.email}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-slate-500" />
                {MOCK_USER.phone}
              </div>
            </div>
          </div>

          {/* Store & Location Details */}
          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 space-y-2">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              Assigned Store & Terminal
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-white">{MOCK_USER.storeName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{MOCK_USER.storeBranch}</span>
              </div>
            </div>
          </div>

          {/* Explicit Mock Notice Requirement */}
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-300/90 text-[11px] leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-400 block mb-0.5">Frontend Mock User Notice</span>
              This profile represents simulated frontend data for local demonstration. No external authentication backend or database is connected at this stage.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onSignOut) onSignOut();
            }}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Simulate Sign Out</span>
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
