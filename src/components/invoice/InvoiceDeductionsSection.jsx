import React from 'react';
import {
  ArrowRightLeft,
  Percent,
  Info,
  Scale,
} from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../../utils/categories';

export default function InvoiceDeductionsSection({
  invoice,
  onUpdateField,
}) {
  const hasBatteryItem = (invoice.items || []).some(
    (item) => (item.category || PRODUCT_CATEGORIES.BATTERY) === PRODUCT_CATEGORIES.BATTERY
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
          <ArrowRightLeft className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Scrap Exchange & Invoice Deductions
          </h2>
          <p className="text-xs text-slate-400">
            Old battery buyback deductions, invoice-level discounts, and manual round-off adjustments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Scrap Buyback / Trade-In Panel */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase text-xs tracking-wider">
                Old Battery Scrap Buyback
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                Eco-Exchange
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={invoice?.scrapExchange?.enabled || false}
                onChange={(e) => onUpdateField('scrapExchange.enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="text-[11px] p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2 text-slate-400">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              {hasBatteryItem
                ? 'Eligible: Current bill includes battery storage suitable for scrap exchange credit.'
                : 'Scrap trade-in is available when the customer returns an old core battery.'}
            </span>
          </div>

          {invoice?.scrapExchange?.enabled && (
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Scrap Battery Model / Description
                </label>
                <input
                  type="text"
                  value={invoice?.scrapExchange?.description || ''}
                  onChange={(e) => onUpdateField('scrapExchange.description', e.target.value)}
                  placeholder="e.g. Old 150Ah Scrap Battery Buyback"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Buyback Deduction Amount (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={invoice?.scrapExchange?.amount ?? ''}
                  onChange={(e) => onUpdateField('scrapExchange.amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  placeholder="2000"
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">
                  Typical scrap rates: 150Ah Tubular ~₹2,000–₹2,500; Auto 35Ah ~₹500–₹900.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Additional Invoice-Level Discount & Manual Rounding */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white uppercase text-xs tracking-wider">
              Discounts & Round-Off
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">
                Special Additional Invoice Discount (₹)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={invoice?.additionalDiscount ?? ''}
                onChange={(e) => onUpdateField('additionalDiscount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
              />
              <span className="text-[10px] text-slate-500">
                Applies across invoice footer after item line totals.
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>Manual Round-off Adjustment (₹)</span>
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateField('roundOffManual', null)}
                  className="text-[10px] text-amber-400 hover:underline"
                >
                  Reset to Auto
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                value={invoice?.roundOffManual ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateField('roundOffManual', val === '' ? null : parseFloat(val));
                }}
                placeholder="Auto (Nearest ₹1)"
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
              />
              <span className="text-[10px] text-slate-500">
                Default auto rounds net payable to nearest rupee.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

