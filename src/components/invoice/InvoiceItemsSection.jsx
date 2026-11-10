import React, { useState } from 'react';
import {
  Package,
  Layers,
  Plus,
  AlertTriangle,
} from 'lucide-react';
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
  validationErrors = [],
  itemErrors = {},
}) {
  const [discountOpen, setDiscountOpen] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);

  // Authoritative open state: visibly open if invoice has value or user toggled open
  const showDiscount = Boolean(
    (invoice?.additionalDiscount !== undefined && Number(invoice?.additionalDiscount) > 0) ||
    discountOpen
  );
  const showExchange = Boolean(
    invoice?.scrapExchange?.enabled ||
    (invoice?.scrapExchange?.amount !== undefined && Number(invoice?.scrapExchange?.amount) > 0) ||
    exchangeOpen
  );

  const discountVal = invoice?.additionalDiscount ?? 0;
  const scrapVal = invoice?.scrapExchange?.amount ?? 0;

  const handleToggleDiscount = () => {
    if (showDiscount) {
      setDiscountOpen(false);
      if (onUpdateField) onUpdateField('additionalDiscount', 0);
    } else {
      setDiscountOpen(true);
    }
  };

  const handleDiscountChange = (val) => {
    if (onUpdateField) {
      onUpdateField('additionalDiscount', val);
    }
  };

  const handleToggleExchange = () => {
    if (showExchange) {
      setExchangeOpen(false);
      if (onUpdateField) {
        onUpdateField({
          'scrapExchange.enabled': false,
          'scrapExchange.amount': 0,
        });
      }
    } else {
      setExchangeOpen(true);
      if (onUpdateField) {
        onUpdateField('scrapExchange.enabled', true);
      }
    }
  };

  const handleExchangeAmountChange = (val) => {
    if (onUpdateField) {
      onUpdateField({
        'scrapExchange.amount': val,
        'scrapExchange.enabled': true,
      });
    }
  };

  // Top 5 popular presets for fast chips
  const popularPresets = ITEM_PRESETS.slice(0, 5);

  return (
    <section id="section-invoice-items" className="bg-[#181C22] border border-[#2A3039] rounded-2xl p-6 sm:p-7">
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

      {/* Validation Errors Notice Banner */}
      {validationErrors && validationErrors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-950/80 border-2 border-red-500/80 rounded-2xl p-4 sm:p-5 text-red-200 mb-5 shadow-xl"
        >
          <div className="flex items-center gap-2.5 font-bold text-red-400 text-base mb-1">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>Please resolve the following before printing or saving:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2 text-red-300">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Item Cards List */}
      <div className="space-y-3.5">
        {items.length === 0 ? (
          <div className="border border-dashed border-[#7A7568] bg-[#12161B] rounded-2xl p-8 sm:p-10 text-center">
            <Package className="w-12 h-12 text-[#F2A516] mx-auto mb-3 opacity-90" />
            <h3 className="text-xl sm:text-2xl font-bold text-[#F2EFE9] mb-1.5">
              No items added yet
            </h3>
            <p className="text-sm sm:text-base text-[#A8A294] max-w-md mx-auto mb-6">
              Select a product from the catalog or add a new item to this bill.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {onOpenCatalogPicker && (
                <button
                  type="button"
                  onClick={onOpenCatalogPicker}
                  className="inv-pill on text-base py-2.5 px-6"
                >
                  <Layers className="w-4 h-4 text-[#F2A516]" />
                  <span>Browse Products</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onAddItem(null, PRODUCT_CATEGORIES.BATTERY)}
                className="inv-pill text-base py-2.5 px-6"
              >
                <Plus className="w-4 h-4 text-[#FFC857]" />
                <span>+ Add Item</span>
              </button>
            </div>
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
              isOnlyItem={false}
              isInterstate={isInterstate}
              errors={itemErrors[index]}
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
