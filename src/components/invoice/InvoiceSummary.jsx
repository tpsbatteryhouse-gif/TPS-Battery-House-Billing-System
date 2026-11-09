import React from 'react';
import {
  Receipt,
  CheckCircle2,
  Clock,
  FileEdit,
  CreditCard,
} from 'lucide-react';
import { formatNumber } from '../../utils/numberToWords';
import { PAYMENT_MODES } from '../../utils/defaults';
import { INVOICE_STATUSES } from '../../data/mockData';

export default function InvoiceSummary({
  invoice,
  totals,
  onUpdateField,
  isInterstate = false,
}) {
  const currentStatus = invoice?.paymentStatus || INVOICE_STATUSES.PENDING;
  const currentMode = invoice?.paymentMode || 'Cash';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
          <Receipt className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Tax Invoice Financial Summary
          </h2>
          <p className="text-xs text-slate-400">
            Authoritative computation of gross subtotal, statutory GST, deductions, and net payable
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Payment Status & Payment Mode Configuration */}
        <div className="lg:col-span-5 space-y-4">
          {/* Payment Status Selector */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Payment Status *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: INVOICE_STATUSES.PAID, label: 'Paid', icon: CheckCircle2, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
                { id: INVOICE_STATUSES.PENDING, label: 'Pending', icon: Clock, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
                { id: INVOICE_STATUSES.DRAFT, label: 'Draft', icon: FileEdit, color: 'text-slate-300 border-slate-700 bg-slate-800/80' },
              ].map((s) => {
                const Icon = s.icon;
                const isSelected = currentStatus === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onUpdateField('paymentStatus', s.id)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? `${s.color} font-bold shadow-md ring-1 ring-amber-500/40`
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>Payment Mode</span>
            </label>
            <select
              value={currentMode}
              onChange={(e) => onUpdateField('paymentMode', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none transition-all"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              UPI QR code will generate on invoice preview & print when UPI or Cash is selected.
            </p>
          </div>
        </div>

        {/* Right: Authoritative Financial Calculation Table */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-3 font-mono text-xs">
          {/* Gross Item Subtotal */}
          <div className="flex items-center justify-between text-slate-400 py-1 border-b border-slate-800/60">
            <span className="font-sans">Gross Line Items Subtotal</span>
            <span className="text-slate-200 font-bold whitespace-nowrap">₹{formatNumber(totals.totalGross)}</span>
          </div>

          {/* Item Discounts */}
          {totals.extraDiscount > 0 && (
            <div className="flex items-center justify-between text-amber-400/90 py-1 border-b border-slate-800/60">
              <span className="font-sans">Special Invoice Discount</span>
              <span className="font-bold whitespace-nowrap">-₹{formatNumber(totals.extraDiscount)}</span>
            </div>
          )}

          {/* Scrap Battery Buyback */}
          {totals.scrapDiscount > 0 && (
            <div className="flex items-center justify-between text-amber-400 py-1 border-b border-slate-800/60">
              <span className="font-sans">Old Battery Scrap Buyback Deduction</span>
              <span className="font-bold whitespace-nowrap">-₹{formatNumber(totals.scrapDiscount)}</span>
            </div>
          )}

          {/* Taxable Subtotal */}
          <div className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-800/60">
            <span className="font-sans font-semibold">Total Taxable Subtotal</span>
            <span className="text-white font-bold whitespace-nowrap">₹{formatNumber(totals.totalTaxableValue)}</span>
          </div>

          {/* Tax Breakdown */}
          {isInterstate ? (
            <div className="flex items-center justify-between text-purple-400 py-1 border-b border-slate-800/60">
              <span className="font-sans">Integrated Tax (IGST)</span>
              <span className="font-bold whitespace-nowrap">₹{formatNumber(totals.totalIgst)}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-slate-400 py-1 border-b border-slate-800/60">
                <span className="font-sans">Central Tax (CGST)</span>
                <span className="text-slate-300 font-bold whitespace-nowrap">₹{formatNumber(totals.totalCgst)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 py-1 border-b border-slate-800/60">
                <span className="font-sans">State Tax (SGST)</span>
                <span className="text-slate-300 font-bold whitespace-nowrap">₹{formatNumber(totals.totalSgst)}</span>
              </div>
            </>
          )}

          {/* Total Tax Amount */}
          <div className="flex items-center justify-between text-slate-400 py-1 border-b border-slate-800/60">
            <span className="font-sans">Total GST Amount</span>
            <span className="text-slate-200 font-bold whitespace-nowrap">₹{formatNumber(totals.totalTax)}</span>
          </div>

          {/* Round-off Adjustment */}
          <div className="flex items-center justify-between text-slate-400 py-1 border-b border-slate-800/60">
            <span className="font-sans">Round-Off Adjustment</span>
            <span className="text-slate-300 font-bold whitespace-nowrap">
              {totals.roundOff >= 0 ? `+₹${formatNumber(totals.roundOff)}` : `-₹${formatNumber(Math.abs(totals.roundOff))}`}
            </span>
          </div>

          {/* Final Net Payable Amount (Hero Metric) */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-t-2 border-amber-500/30">
            <span className="font-sans text-sm sm:text-base font-extrabold text-white uppercase tracking-tight">
              Final Net Payable:
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight self-end sm:self-auto whitespace-nowrap">
              ₹{formatNumber(totals.netPayable)}
            </div>
          </div>

          {/* Amount in Words */}
          {totals.amountInWords && (
            <div className="pt-2 text-[11px] font-sans italic text-slate-400 border-t border-slate-800/40 break-words leading-relaxed">
              <strong className="text-slate-300 not-italic">In Words:</strong> {totals.amountInWords}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
