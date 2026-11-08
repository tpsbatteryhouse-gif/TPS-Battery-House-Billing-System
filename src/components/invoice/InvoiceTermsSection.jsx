import React from 'react';
import {
  FileText,
  Lock,
  Info,
} from 'lucide-react';

export default function InvoiceTermsSection({
  invoice,
  onUpdateField,
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 text-xs">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Terms & Conditions and Internal Notes
          </h2>
          <p className="text-xs text-slate-400">
            Customer-facing terms of supply and private internal staff notations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Terms & Conditions */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Customer-Facing Terms & Conditions</span>
          </label>
          <textarea
            rows={3}
            value={invoice?.notes || ''}
            onChange={(e) => onUpdateField('notes', e.target.value)}
            placeholder="1. Goods once sold will not be taken back without original warranty card. 2. Subject to Palakkad jurisdiction."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
          <span className="text-[10px] text-slate-500">
            Printed at the bottom of the A4 Tax Invoice document.
          </span>
        </div>

        {/* Private Internal Staff Notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Private Staff / Delivery Notes (Internal Only)</span>
          </label>
          <textarea
            rows={3}
            value={invoice?.staffNotes || ''}
            onChange={(e) => onUpdateField('staffNotes', e.target.value)}
            placeholder="e.g. Technician Raju to install inverter combo tomorrow morning. Battery scrap collected on site."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Info className="w-3 h-3 text-amber-500/70" />
            <span>Internal only. NEVER printed on customer bills or shared via WhatsApp.</span>
          </span>
        </div>
      </div>

      {/* GST Compliance Tip Callout */}
      <div className="p-3.5 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start space-x-3">
        <span className="text-emerald-400 text-base sm:text-lg leading-none">💡</span>
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-emerald-400 font-bold">GST Compliance Tip:</strong> Ensure customer's state code (32) matches the supply destination. Scrap buyback credit has been auto-deducted before computing taxable value.
        </div>
      </div>
    </div>
  );
}

