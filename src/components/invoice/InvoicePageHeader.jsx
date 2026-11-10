import React from 'react';
import {
  ArrowLeft,
  Sparkles,
  Settings,
  RotateCcw,
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
        'Reset this bill? All entered items and customer details will be cleared.'
      )
    ) {
      if (onReset) onReset();
    }
  };

  const txType = invoice?.transactionType || inferTransactionType(invoice);
  const typeLabel = txType === 'B2B' ? 'Business customer (B2B)' : 'Regular customer (B2C)';
  const invoiceNumber = invoice?.invoiceNumber || 'TPS/2026-27/---';
  
  // Format display date
  const dateStr = invoice?.invoiceDate;
  const formattedDate = dateStr
    ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Today';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-base font-semibold text-[#A8A294] hover:text-[#F2EFE9] transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F2EFE9] tracking-tight leading-tight">
          New Bill
        </h1>
        <div className="mt-1 text-sm sm:text-base text-[#A8A294] flex flex-wrap items-center gap-2">
          <span>Bill number <strong className="font-mono text-[#F2EFE9]">{invoiceNumber}</strong></span>
          <span>·</span>
          <span>{formattedDate}</span>
          <span>·</span>
          <span className="text-[#FFC857] font-semibold">{typeLabel}</span>
          {business?.gstin && (
            <>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline text-xs text-[#A8A294]/80">
                GSTIN: <span className="font-mono">{business.gstin}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {onLoadSample && (
          <button
            type="button"
            onClick={onLoadSample}
            className="inv-pill text-sm py-2 px-3.5 min-h-[44px]"
            title="Load sample items"
          >
            <Sparkles className="w-4 h-4 text-[#F2A516]" />
            <span className="hidden sm:inline">Load Sample</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inv-pill text-sm py-2 px-3.5 min-h-[44px]"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-[#A8A294]" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}

        {onReset && (
          <button
            type="button"
            onClick={handleResetConfirm}
            className="inv-pill text-sm py-2 px-4 min-h-[44px]"
            title="Clear all fields"
          >
            <RotateCcw className="w-4 h-4 text-[#A8A294]" />
            <span>Clear everything</span>
          </button>
        )}
      </div>
    </div>
  );
}
