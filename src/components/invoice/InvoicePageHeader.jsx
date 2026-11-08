import React from 'react';
import {
  Receipt,
  RotateCcw,
  Sparkles,
  Settings,
  Building2,
  ArrowLeft,
} from 'lucide-react';
import { inferTransactionType } from '../../utils/categories';

export default function InvoicePageHeader({
  invoice,
  business,
  onReset,
  onOpenSettings,
  onLoadSample,
  onBackToDashboard,
}) {
  const handleResetConfirm = () => {
    if (
      window.confirm(
        'Reset this invoice form? All unsaved line items and customer information will be cleared.'
      )
    ) {
      if (onReset) onReset();
    }
  };

  const businessGstin = business?.gstin || '32DIUPP1211B2ZN';
  const businessState = business?.state || 'Kerala';
  const businessStateCode = business?.stateCode || '32';
  const txType = invoice?.transactionType || inferTransactionType(invoice);

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Title & Identity */}
      <div className="flex items-start sm:items-center gap-3.5">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0 mt-0.5 sm:mt-0">
          <Receipt className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              New Tax Invoice
            </h1>
            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-950 text-amber-400 border border-slate-800">
              {invoice?.invoiceNumber || 'TPS/2026-27/---'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {txType}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              GSTIN: <strong className="font-mono text-slate-300">{businessGstin}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              State of Supply: <strong className="text-slate-300">{businessState} ({businessStateCode})</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
        {onLoadSample && (
          <button
            type="button"
            onClick={onLoadSample}
            title="Load comprehensive multi-category demo bill"
            className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Load Sample</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Open invoice settings and store configuration"
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Invoice Settings</span>
          </button>
        )}

        {onReset && (
          <button
            type="button"
            onClick={handleResetConfirm}
            title="Reset form to a clean invoice"
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Form</span>
          </button>
        )}
      </div>
    </div>
  );
}
