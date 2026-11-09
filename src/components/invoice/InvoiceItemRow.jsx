import React from 'react';
import {
  Trash2,
  BatteryCharging,
  Zap,
  Sun,
  Wrench,
  Package,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  MULTI_CATEGORY_UNITS,
} from '../../utils/categories';
import { calculateLineItem } from '../../utils/gstCalculations';
import { formatNumber } from '../../utils/numberToWords';

export default function InvoiceItemRow({
  item,
  index,
  onUpdateItem,
  onUpdateCategory,
  onRemoveItem,
  isOnlyItem,
  isInterstate = false,
  isMobileCard = false,
}) {
  const cat = item.category || PRODUCT_CATEGORIES.BATTERY;
  const catCfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
  const computed = calculateLineItem(item, isInterstate);

  const getCatIcon = (c, className = 'w-3.5 h-3.5') => {
    switch (c) {
      case PRODUCT_CATEGORIES.BATTERY:
        return <BatteryCharging className={className} />;
      case PRODUCT_CATEGORIES.INVERTER:
        return <Zap className={className} />;
      case PRODUCT_CATEGORIES.SOLAR:
        return <Sun className={className} />;
      case PRODUCT_CATEGORIES.SERVICES:
        return <Wrench className={className} />;
      default:
        return <Package className={className} />;
    }
  };

  // --- MOBILE / TABLET CARD LAYOUT ---
  if (isMobileCard) {
    return (
      <div className="bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 space-y-3 shadow-md transition-all">
        {/* Card Header: Sl No, Category Picker & Remove */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center">
              {index + 1}
            </span>
            {/* Category Selector Pill */}
            <div className="flex items-center gap-1">
              <span className={`p-1 rounded text-xs ${catCfg.badgeClass}`}>
                {getCatIcon(cat, 'w-3 h-3')}
              </span>
              <select
                value={cat}
                onChange={(e) => onUpdateCategory(index, e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-semibold text-amber-400 focus:outline-none"
              >
                {Object.values(CATEGORY_CONFIG).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRemoveItem(index)}
            disabled={isOnlyItem}
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent"
            title={isOnlyItem ? 'Invoice must contain at least 1 item' : 'Remove line item'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Product Description */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-slate-400">Item Description / Name *</label>
          <input
            type="text"
            value={item.name || ''}
            onChange={(e) => onUpdateItem(index, 'name', e.target.value)}
            placeholder="e.g. Amaron Current 150Ah Tall Tubular Battery"
            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* HSN & Warranty */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-slate-400">HSN/SAC</label>
            <input
              type="text"
              value={item.hsn || ''}
              onChange={(e) => onUpdateItem(index, 'hsn', e.target.value)}
              placeholder={catCfg.defaultHsn}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-slate-400">Warranty / Serial</label>
            <input
              type="text"
              value={item.warranty || ''}
              onChange={(e) => onUpdateItem(index, 'warranty', e.target.value)}
              placeholder="36 Months"
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Qty, Unit, Unit Price, Tax Mode */}
        <div className="grid grid-cols-12 gap-2 text-xs">
          <div className="col-span-4 space-y-1">
            <label className="text-[10px] font-medium text-slate-400">Quantity</label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={item.qty ?? ''}
              onChange={(e) => onUpdateItem(index, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none"
            />
          </div>
          <div className="col-span-4 space-y-1">
            <label className="text-[10px] font-medium text-slate-400">Unit</label>
            <select
              value={item.unit || catCfg.defaultUnit}
              onChange={(e) => onUpdateItem(index, 'unit', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
            >
              {MULTI_CATEGORY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-4 space-y-1">
            <label className="text-[10px] font-medium text-slate-400">Unit Rate (₹)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={item.rate ?? ''}
              onChange={(e) => onUpdateItem(index, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {/* GST Slab, Mode, Discount */}
        <div className="grid grid-cols-12 gap-2 text-xs items-end">
          <div className="col-span-4 space-y-1">
            <label className="text-[10px] font-medium text-slate-400">GST Slab</label>
            <select
              value={item.gstRate ?? catCfg.defaultGstRate}
              onChange={(e) => onUpdateItem(index, 'gstRate', Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2 py-1.5 text-xs font-mono text-white focus:outline-none"
            >
              {[0, 5, 12, 18, 28].map((r) => (
                <option key={r} value={r}>
                  {r}% GST
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-4 space-y-1">
            <label className="text-[10px] font-medium text-slate-400">Pricing Mode</label>
            <button
              type="button"
              onClick={() => onUpdateItem(index, 'isTaxInclusive', !item.isTaxInclusive)}
              className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition-all ${
                item.isTaxInclusive
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {item.isTaxInclusive ? 'Tax Incl' : 'Tax Excl'}
            </button>
          </div>

          <div className="col-span-4 space-y-1">
            <label className="text-[10px] font-medium text-slate-400">Discount (₹)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={item.discount ?? ''}
              onChange={(e) => onUpdateItem(index, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Card Footer: Taxable & Line Total */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">
            Taxable: <strong className="text-slate-200">₹{formatNumber(computed.taxableValue)}</strong>
          </span>
          <span className="text-sm font-bold text-amber-400">
            Total: ₹{formatNumber(computed.lineTotal)}
          </span>
        </div>
      </div>
    );
  }

  // --- DESKTOP TABLE ROW LAYOUT ---
  return (
    <tr className="hover:bg-slate-950/40 border-b border-slate-800/60 transition-colors group text-xs">
      {/* 1. Sl No */}
      <td className="py-3 px-2 text-center text-slate-500 font-mono font-semibold text-[11px]">
        {index + 1}
      </td>

      {/* 2. Category */}
      <td className="py-3 px-2 w-32 min-w-[128px]">
        <div className="flex items-center gap-1.5">
          <span className={`p-1.5 rounded-lg border ${catCfg.badgeClass}`}>
            {getCatIcon(cat, 'w-3.5 h-3.5')}
          </span>
          <select
            value={cat}
            onChange={(e) => onUpdateCategory(index, e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-400 focus:outline-none"
          >
            {Object.values(CATEGORY_CONFIG).map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortLabel}
              </option>
            ))}
          </select>
        </div>
      </td>

      {/* 3. Description & Specs */}
      <td className="py-3 px-2 min-w-[260px]">
        <div className="space-y-1">
          <input
            type="text"
            value={item.name || ''}
            onChange={(e) => onUpdateItem(index, 'name', e.target.value)}
            placeholder="Item Description / Brand & Model..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={item.warranty || ''}
              onChange={(e) => onUpdateItem(index, 'warranty', e.target.value)}
              placeholder="Warranty (e.g. 36 Months)"
              className="w-1/2 bg-slate-950/60 border border-slate-800/80 rounded px-2 py-0.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none"
            />
            <input
              type="text"
              value={item.serialNo || ''}
              onChange={(e) => onUpdateItem(index, 'serialNo', e.target.value)}
              placeholder="Serial No / Batch (Opt)"
              className="w-1/2 bg-slate-950/60 border border-slate-800/80 rounded px-2 py-0.5 text-[10px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
      </td>

      {/* 4. HSN */}
      <td className="py-3 px-2 w-20">
        <input
          type="text"
          value={item.hsn || ''}
          onChange={(e) => onUpdateItem(index, 'hsn', e.target.value)}
          placeholder={catCfg.defaultHsn}
          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2 py-1 text-xs font-mono text-white text-center focus:outline-none"
        />
      </td>

      {/* 5. Qty & Unit */}
      <td className="py-3 px-2 w-28">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0.001"
            step="any"
            value={item.qty ?? ''}
            onChange={(e) => onUpdateItem(index, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="w-14 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-white text-center focus:outline-none"
          />
          <select
            value={item.unit || catCfg.defaultUnit}
            onChange={(e) => onUpdateItem(index, 'unit', e.target.value)}
            className="w-14 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-1 py-1 text-[11px] text-slate-300 focus:outline-none"
          >
            {MULTI_CATEGORY_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </td>

      {/* 6. Unit Rate */}
      <td className="py-3 px-2 w-28">
        <input
          type="number"
          min="0"
          step="any"
          value={item.rate ?? ''}
          onChange={(e) => onUpdateItem(index, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-400 text-right focus:outline-none"
        />
      </td>

      {/* 7. Tax Mode (Incl/Excl) */}
      <td className="py-3 px-2 w-20 text-center">
        <button
          type="button"
          onClick={() => onUpdateItem(index, 'isTaxInclusive', !item.isTaxInclusive)}
          className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
            item.isTaxInclusive
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
          title={item.isTaxInclusive ? 'Rate includes GST (MRP)' : 'Rate is exclusive of GST (Base)'}
        >
          {item.isTaxInclusive ? 'Incl' : 'Excl'}
        </button>
      </td>

      {/* 8. GST Slab */}
      <td className="py-3 px-2 w-20">
        <select
          value={item.gstRate ?? catCfg.defaultGstRate}
          onChange={(e) => onUpdateItem(index, 'gstRate', Number(e.target.value))}
          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-1.5 py-1 text-xs font-mono text-white text-center focus:outline-none"
        >
          {[0, 5, 12, 18, 28].map((r) => (
            <option key={r} value={r}>
              {r}%
            </option>
          ))}
        </select>
      </td>

      {/* 9. Discount (₹) */}
      <td className="py-3 px-2 w-20">
        <input
          type="number"
          min="0"
          step="any"
          value={item.discount ?? ''}
          onChange={(e) => onUpdateItem(index, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
          placeholder="0"
          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-2 py-1 text-xs font-mono text-slate-300 text-right focus:outline-none"
        />
      </td>

      {/* 10. Taxable Amount */}
      <td className="py-3 px-2 text-right font-mono text-slate-300 w-28 min-w-[100px] whitespace-nowrap">
        ₹{formatNumber(computed.taxableValue)}
      </td>

      {/* 11. Line Total */}
      <td className="py-3 px-2 text-right font-mono font-bold text-white w-28 min-w-[100px] whitespace-nowrap">
        ₹{formatNumber(computed.lineTotal)}
      </td>

      {/* 12. Remove */}
      <td className="py-3 px-2 text-center w-10">
        <button
          type="button"
          onClick={() => onRemoveItem(index)}
          disabled={isOnlyItem}
          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent"
          title={isOnlyItem ? 'Invoice must contain at least 1 item' : 'Remove item'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
