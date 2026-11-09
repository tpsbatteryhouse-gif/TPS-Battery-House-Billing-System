import React, { useState } from 'react';
import {
  PRODUCT_CATEGORIES,
} from '../../utils/categories';
import { ITEM_PRESETS } from '../../utils/defaults';
import InvoiceItemRow from './InvoiceItemRow';

export default function InvoiceItemsSection({
  items = [],
  onAddItem,
  onUpdateItem,
  onUpdateCategory,
  onRemoveItem,
  onOpenCatalogPicker,
  isInterstate = false,
  invoice,
  onUpdateField,
}) {
  const [showDiscount, setShowDiscount] = useState(() => Boolean(invoice?.additionalDiscount && invoice.additionalDiscount > 0));
  const [showExchange, setShowExchange] = useState(() => Boolean(invoice?.scrapExchange?.enabled || (invoice?.scrapExchange?.amount && invoice.scrapExchange.amount > 0)));

  // Sync state if invoice props update externally
  const discountVal = invoice?.additionalDiscount || 0;
  const scrapVal = invoice?.scrapExchange?.amount || 0;

  const handleToggleDiscount = () => {
    if (showDiscount) {
      if (onUpdateField) onUpdateField('additionalDiscount', 0);
      setShowDiscount(false);
    } else {
      setShowDiscount(true);
    }
  };

  const handleDiscountChange = (val) => {
    const num = parseFloat(val);
    if (onUpdateField) {
      onUpdateField('additionalDiscount', isNaN(num) ? 0 : num);
    }
  };

  const handleToggleExchange = () => {
    if (showExchange) {
      if (onUpdateField) {
        onUpdateField('scrapExchange.enabled', false);
        onUpdateField('scrapExchange.amount', 0);
      }
      setShowExchange(false);
    } else {
      if (onUpdateField) {
        onUpdateField('scrapExchange.enabled', true);
      }
      setShowExchange(true);
    }
  };

  const handleExchangeAmountChange = (val) => {
    const num = parseFloat(val);
    if (onUpdateField) {
      onUpdateField('scrapExchange.amount', isNaN(num) ? 0 : num);
      if (!invoice?.scrapExchange?.enabled) {
        onUpdateField('scrapExchange.enabled', true);
      }
    }
  };

  // Top 5 popular presets for fast chips
  const popularPresets = ITEM_PRESETS.slice(0, 5);

  return (
    <section className="bg-[#181C22] border border-[#2A3039] rounded-2xl p-6 sm:p-7">
      {/* 2 — Section Heading */}
      <div className="flex items-center gap-3.5 mb-5 sm:mb-6">
        <div className="inv-step">2</div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F2EFE9] leading-tight m-0">
            What are they buying?
          </h2>
          <div className="text-sm sm:text-base text-[#A8A294]">
            Prices already include GST. We work out the tax for you.
          </div>
        </div>
      </div>

      {/* Item Cards List */}
      <div className="space-y-3.5">
        {items.length === 0 ? (
          <div className="border-2 border-dashed border-[#7A7568] rounded-xl p-7 text-center text-[#A8A294]">
            No items yet. Tap an item below to add it.
          </div>
        ) : (
          items.map((item, index) => (
            <InvoiceItemRow
              key={item.id || index}
              item={item}
              index={index}
              onUpdateItem={onUpdateItem}
              onUpdateCategory={onUpdateCategory}
              onRemoveItem={onRemoveItem}
              isOnlyItem={items.length <= 1}
              isInterstate={isInterstate}
            />
          ))
        )}
      </div>

      {/* Tap to Add Quick Presets */}
      <div className="mt-6">
        <div className="text-sm sm:text-base font-semibold text-[#F2EFE9] mb-2.5">
          Tap to add an item
        </div>
        <div className="flex flex-wrap gap-2.5">
          {popularPresets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onAddItem(preset)}
              className="inv-chip"
            >
              <span className="text-[#FFC857] font-bold">+</span>
              <span>{preset.name}</span>
              <span className="text-[#A8A294] font-mono text-xs">
                · ₹{preset.price.toLocaleString('en-IN')}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onAddItem(null, PRODUCT_CATEGORIES.BATTERY)}
            className="inv-chip"
          >
            <span className="text-[#FFC857] font-bold">+</span>
            <span>Battery</span>
          </button>
          <button
            type="button"
            onClick={() => onAddItem(null, PRODUCT_CATEGORIES.INVERTER)}
            className="inv-chip"
          >
            <span className="text-[#FFC857] font-bold">+</span>
            <span>Inverter</span>
          </button>
          <button
            type="button"
            onClick={() => onAddItem(null, PRODUCT_CATEGORIES.SOLAR)}
            className="inv-chip"
          >
            <span className="text-[#FFC857] font-bold">+</span>
            <span>Solar</span>
          </button>
          <button
            type="button"
            onClick={() => onAddItem(null, PRODUCT_CATEGORIES.SERVICES)}
            className="inv-chip"
          >
            <span className="text-[#FFC857] font-bold">+</span>
            <span>Installation Service</span>
          </button>
        </div>

        {onOpenCatalogPicker && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onOpenCatalogPicker}
              className="inv-link"
            >
              See all items
            </button>
          </div>
        )}
      </div>

      {/* Discounts & Old Battery Scrap Exchange */}
      <div className="mt-5 pt-5 border-t border-[#2A3039] space-y-3">
        {/* Discount Toggle & Field */}
        {showDiscount ? (
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <label htmlFor="f-disc" className="text-base sm:text-lg font-semibold text-[#F2EFE9] flex-1 min-w-[200px]">
              Discount to give (₹)
            </label>
            <input
              id="f-disc"
              type="number"
              inputMode="decimal"
              step="any"
              value={discountVal === 0 ? '' : discountVal}
              onChange={(e) => handleDiscountChange(e.target.value)}
              placeholder="0"
              className="inv-fld w-36 sm:w-44 font-mono font-bold"
            />
            <button
              type="button"
              onClick={handleToggleDiscount}
              className="inv-link text-[#FF8A80]"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={handleToggleDiscount}
              className="inv-link"
            >
              + Give a discount
            </button>
          </div>
        )}

        {/* Old Battery Scrap Exchange Toggle & Field */}
        {showExchange ? (
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <label htmlFor="f-exch" className="text-base sm:text-lg font-semibold text-[#F2EFE9] flex-1 min-w-[200px]">
              Old battery value (₹)
            </label>
            <input
              id="f-exch"
              type="number"
              inputMode="decimal"
              step="any"
              value={scrapVal === 0 ? '' : scrapVal}
              onChange={(e) => handleExchangeAmountChange(e.target.value)}
              placeholder="0"
              className="inv-fld w-36 sm:w-44 font-mono font-bold"
            />
            <button
              type="button"
              onClick={handleToggleExchange}
              className="inv-link text-[#FF8A80]"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={handleToggleExchange}
              className="inv-link"
            >
              + Customer is giving an old battery
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
