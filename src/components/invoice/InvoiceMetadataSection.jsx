import React from 'react';
import {
  Calendar,
  Clock,
  FileSpreadsheet,
  Truck,
  Hash,
} from 'lucide-react';

export default function InvoiceMetadataSection({
  invoice,
  onUpdateField,
}) {
  const handleQuickTerms = (days) => {
    const baseDateStr = invoice?.invoiceDate || new Date().toISOString().split('T')[0];
    const baseDate = new Date(baseDateStr);
    if (!isNaN(baseDate.getTime())) {
      baseDate.setDate(baseDate.getDate() + days);
      const dueDateStr = baseDate.toISOString().split('T')[0];
      onUpdateField('dueDate', dueDateStr);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Invoice Metadata & Terms
          </h2>
          <p className="text-xs text-slate-400">
            Invoice issue date, payment due terms, and transport references
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-12 gap-3 sm:gap-4 text-xs">
        {/* Invoice Date */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-1">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Invoice Date *</span>
          </label>
          <input
            type="date"
            value={invoice?.invoiceDate || ''}
            onChange={(e) => onUpdateField('invoiceDate', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition-all"
          />
        </div>

        {/* Due Date & Quick Terms */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Payment Due Date</span>
            </label>
            {/* Quick Terms Chips */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleQuickTerms(0)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Due on receipt"
              >
                Immediate
              </button>
              <button
                type="button"
                onClick={() => handleQuickTerms(15)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Due in 15 days"
              >
                15 Days
              </button>
              <button
                type="button"
                onClick={() => handleQuickTerms(30)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Due in 30 days"
              >
                30 Days
              </button>
            </div>
          </div>
          <input
            type="date"
            value={invoice?.dueDate || ''}
            onChange={(e) => onUpdateField('dueDate', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition-all"
          />
        </div>

        {/* Reverse Charge */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-1">
          <label className="text-[11px] font-medium text-slate-300">
            Reverse Charge Applicable
          </label>
          <select
            value={invoice?.reverseCharge || 'No'}
            onChange={(e) => onUpdateField('reverseCharge', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all"
          >
            <option value="No">No (Standard - Forward Charge)</option>
            <option value="Yes">Yes (Reverse Charge Mechanism)</option>
          </select>
        </div>

        {/* PO Number */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-1">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span>Buyer PO / Work Order No (Optional)</span>
          </label>
          <input
            type="text"
            value={invoice?.poNumber || ''}
            onChange={(e) => onUpdateField('poNumber', e.target.value)}
            placeholder="e.g. PO-2026-891"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* E-Way Bill Number */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-1">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-slate-400" />
            <span>E-Way Bill Number (Optional)</span>
          </label>
          <input
            type="text"
            value={invoice?.ewayBillNo || ''}
            onChange={(e) => onUpdateField('ewayBillNo', e.target.value)}
            placeholder="e.g. 272584310891"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* IRN Reference Number */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-1">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>IRN / E-Invoice Hash (Optional)</span>
          </label>
          <input
            type="text"
            value={invoice?.irn || ''}
            onChange={(e) => onUpdateField('irn', e.target.value)}
            placeholder="e.g. 7a74303e39eb..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>
      </div>
    </div>
  );
}

