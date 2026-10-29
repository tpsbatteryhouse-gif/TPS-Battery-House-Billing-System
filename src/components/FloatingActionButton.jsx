import React from 'react';
import { Plus } from 'lucide-react';

export default function FloatingActionButton({ onClick, visible = true, label = 'Create new invoice' }) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-30 no-print pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="group flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold p-3.5 sm:px-4 sm:py-3.5 rounded-full shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-amber-500/40"
      >
        <Plus className="w-5 h-5 stroke-[3] group-hover:rotate-90 transition-transform duration-200" />
        <span className="hidden sm:inline text-xs tracking-tight font-black uppercase">
          New Invoice
        </span>
      </button>
    </div>
  );
}
