import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
} from '../../utils/categories';
import { calculateLineItem } from '../../utils/gstCalculations';
import { formatNumber } from '../../utils/numberToWords';

const GST_SLABS = [0, 5, 12, 18, 28];

export default function InvoiceItemRow({
  item,
  index,
  onUpdateItem,
  onUpdateCategory,
  onRemoveItem,
  _isOnlyItem = false,
  isInterstate = false,
  errors = [],
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute live line item financial values
  const lineCalcs = calculateLineItem(item, isInterstate);

  const handleQtyChange = (delta) => {
    const currentQty = Number(item.qty) || 1;
    const newQty = Math.max(1, currentQty + delta);
    onUpdateItem(index, 'qty', newQty);
  };

  const handlePriceChange = (val) => {
    const num = parseFloat(val);
    onUpdateItem(index, 'rate', isNaN(num) ? 0 : num);
  };

  // Build descriptive subtitle from warranty and specs
  const subtitleParts = [];
  if (item.warranty) subtitleParts.push(item.warranty);
  if (item.serialNo) subtitleParts.push(`SN: ${item.serialNo}`);
  if (item.subcategory) subtitleParts.push(item.subcategory);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : (item.category ? `${item.category.toUpperCase()} · GST ${item.gstRate || 18}%` : '');

  const categoryCfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
  const hasErrors = errors && errors.length > 0;

  return (
    <div
      className={`bg-[#12161B] border rounded-xl p-4 sm:p-5 transition-all ${
        hasErrors
          ? 'border-red-500/80 ring-1 ring-red-500/40 bg-red-950/20'
          : 'border-[#2A3039]'
      }`}
    >
      {/* Primary Item Row matching HTML reference */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        {/* Item Title & Specs Note */}
        <div className="flex-1 min-w-[240px]">
          {item.name ? (
            <div className="text-base sm:text-lg font-bold text-[#F2EFE9] leading-tight">
              {item.name}
            </div>
          ) : (
            <input
              type="text"
              value={item.name || ''}
              onChange={(e) => onUpdateItem(index, 'name', e.target.value)}
              placeholder="Product or service name *"
              className="inv-fld h-10 sm:h-11 text-base font-bold mb-1"
            />
          )}
          {subtitle && (
            <div className="text-xs sm:text-sm text-[#A8A294] mt-0.5">
              {subtitle}
            </div>
          )}
          {hasErrors && (
            <div className="text-xs text-red-400 font-semibold mt-1.5 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{errors.join(' • ')}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-xs text-[#A8A294] hover:text-[#FFC857] inline-flex items-center gap-1 mt-1 font-medium"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isExpanded ? 'Hide details' : 'Edit details & GST'}</span>
          </button>
        </div>

        {/* Stepper Controls: [−] [qty] [+] */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleQtyChange(-1)}
            disabled={Number(item.qty) <= 1}
            aria-label="One less"
            className="inv-pill w-11 h-11 min-h-[44px] p-0 text-2xl font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            −
          </button>
          <div
            className="min-w-[40px] text-center text-xl sm:text-2xl font-bold text-[#F2EFE9]"
            aria-live="polite"
          >
            {item.qty || 1}
          </div>
          <button
            type="button"
            onClick={() => handleQtyChange(1)}
            aria-label="One more"
            className="inv-pill w-11 h-11 min-h-[44px] p-0 text-2xl font-bold"
          >
            +
          </button>
        </div>

        {/* Price Input: Price each ₹ */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor={`item-price-${index}`} className="text-xs sm:text-sm text-[#A8A294] whitespace-nowrap">
            Price each ₹
          </label>
          <input
            id={`item-price-${index}`}
            type="number"
            inputMode="decimal"
            step="any"
            value={item.rate === 0 ? '' : item.rate}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="0"
            className="inv-fld w-28 sm:w-32 h-11 sm:h-12 text-base sm:text-lg font-bold font-mono px-3"
          />
        </div>

        {/* Line Total */}
        <div className="min-w-[100px] text-right text-lg sm:text-xl font-bold font-mono text-[#F2EFE9] shrink-0">
          ₹{formatNumber(lineCalcs.total)}
        </div>

        {/* Remove Link Button */}
        <button
          type="button"
          onClick={() => onRemoveItem(index)}
          className="inv-link text-sm sm:text-base text-[#FF8A80] hover:text-[#ff6b60] shrink-0"
        >
          Remove
        </button>
      </div>

      {/* Expandable Advanced Item Settings (GST slab, HSN, Tax Mode, Warranty, Serial No) */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[#2A3039] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Item Name / Description Override */}
          <div className="sm:col-span-2">
            <label className="text-[11px] text-[#A8A294] block mb-1">
              Item Description
            </label>
            <input
              type="text"
              value={item.name || ''}
              onChange={(e) => onUpdateItem(index, 'name', e.target.value)}
              className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-3 py-2 text-xs text-[#F2EFE9]"
              placeholder="Brand, model, capacity..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] text-[#A8A294] block mb-1">
              Category
            </label>
            <select
              value={item.category || PRODUCT_CATEGORIES.BATTERY}
              onChange={(e) => onUpdateCategory(index, e.target.value)}
              className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-2 text-xs text-[#F2EFE9]"
            >
              {Object.values(CATEGORY_CONFIG).map((cfg) => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          {/* HSN/SAC */}
          <div>
            <label className="text-[11px] text-[#A8A294] block mb-1">
              HSN / SAC
            </label>
            <input
              type="text"
              value={item.hsn || ''}
              onChange={(e) => onUpdateItem(index, 'hsn', e.target.value)}
              className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-2 text-xs font-mono text-[#F2EFE9]"
            />
          </div>

          {/* GST Slab */}
          <div>
            <label className="text-[11px] text-[#A8A294] block mb-1">
              GST Slab
            </label>
            <select
              value={item.gstRate ?? categoryCfg.defaultGstRate}
              onChange={(e) => onUpdateItem(index, 'gstRate', Number(e.target.value))}
              className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-2 text-xs text-[#F2EFE9]"
            >
              {GST_SLABS.map((slab) => (
                <option key={slab} value={slab}>
                  {slab}% GST
                </option>
              ))}
            </select>
          </div>

          {/* Tax Mode (Incl / Excl) */}
          <div>
            <label className="text-[11px] text-[#A8A294] block mb-1">
              Tax Mode
            </label>
            <select
              value={item.isTaxInclusive !== false ? 'inclusive' : 'exclusive'}
              onChange={(e) => onUpdateItem(index, 'isTaxInclusive', e.target.value === 'inclusive')}
              className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-2 text-xs text-[#F2EFE9]"
            >
              <option value="inclusive">GST Included in Price</option>
              <option value="exclusive">Price + GST Extra</option>
            </select>
          </div>

          {/* Warranty */}
          <div>
            <label className="text-[11px] text-[#A8A294] block mb-1">
              Warranty
            </label>
            <input
              type="text"
              value={item.warranty || ''}
              onChange={(e) => onUpdateItem(index, 'warranty', e.target.value)}
              className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-2 text-xs text-[#F2EFE9]"
              placeholder="e.g. 36 Months"
            />
          </div>

          {/* Serial Number */}
          <div>
            <label className="text-[11px] text-[#A8A294] block mb-1">
              Serial / Batch Number
            </label>
            <input
              type="text"
              value={item.serialNo || ''}
              onChange={(e) => onUpdateItem(index, 'serialNo', e.target.value)}
              className="w-full bg-[#0F1216] border border-[#7A7568] rounded-lg px-2.5 py-2 text-xs font-mono text-[#F2EFE9]"
              placeholder="Optional barcode / SN"
            />
          </div>
        </div>
      )}
    </div>
  );
}
