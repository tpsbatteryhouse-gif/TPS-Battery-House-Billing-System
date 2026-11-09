import React, { useState } from 'react';
import {
  Package,
  Plus,
  Layers,
  Sparkles,
  BatteryCharging,
  Zap,
  Sun,
  Wrench,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
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
}) {
  const [presetCategoryFilter, setPresetCategoryFilter] = useState('all');

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

  const filteredPresets = ITEM_PRESETS.filter((p) =>
    presetCategoryFilter === 'all' ? true : p.category === presetCategoryFilter
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Invoice Line Items</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold border border-slate-700">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Batteries, Inverters, Solar Panels, and Installation Services
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenCatalogPicker && (
            <button
              type="button"
              onClick={onOpenCatalogPicker}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Browse Catalog</span>
            </button>
          )}

          {/* Quick Add Custom Item Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAddItem(null, PRODUCT_CATEGORIES.BATTERY)}
              className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Add Battery Item"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Battery</span>
            </button>
            <button
              type="button"
              onClick={() => onAddItem(null, PRODUCT_CATEGORIES.INVERTER)}
              className="px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Add Inverter Item"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Inverter</span>
            </button>
            <button
              type="button"
              onClick={() => onAddItem(null, PRODUCT_CATEGORIES.SOLAR)}
              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Add Solar Item"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Solar</span>
            </button>
            <button
              type="button"
              onClick={() => onAddItem(null, PRODUCT_CATEGORIES.SERVICES)}
              className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Add Service Item"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Service</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Catalog Presets Bar */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Fast-Add Catalog Presets:</span>
          </span>

          {/* Category Filter Chips for Presets */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setPresetCategoryFilter('all')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                presetCategoryFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All
            </button>
            {Object.values(CATEGORY_CONFIG).map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                onClick={() => setPresetCategoryFilter(cfg.id)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 ${
                  presetCategoryFilter === cfg.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {getCatIcon(cfg.id, 'w-2.5 h-2.5')}
                <span>{cfg.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preset Chips */}
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
          {filteredPresets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onAddItem(preset)}
              className="text-[11px] bg-slate-900 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 truncate max-w-[280px]"
            >
              <span className="text-amber-400 font-bold">+</span>
              <span className="truncate">{preset.name}</span>
              <span className="font-mono text-[10px] text-amber-400 shrink-0">
                ₹{preset.price.toLocaleString('en-IN')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* DESKTOP TABLE VIEW (>= 1024px) */}
      <div className="hidden lg:block overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs min-w-[1060px]">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
              <th className="py-2.5 px-2 text-center w-8">#</th>
              <th className="py-2.5 px-2 w-32">Category</th>
              <th className="py-2.5 px-2 min-w-[260px]">Item Description & Specs</th>
              <th className="py-2.5 px-2 text-center w-20">HSN/SAC</th>
              <th className="py-2.5 px-2 text-center w-28">Qty & Unit</th>
              <th className="py-2.5 px-2 text-right w-28">Unit Price (₹)</th>
              <th className="py-2.5 px-2 text-center w-20">Tax Mode</th>
              <th className="py-2.5 px-2 text-center w-20">GST %</th>
              <th className="py-2.5 px-2 text-right w-20">Disc (₹)</th>
              <th className="py-2.5 px-2 text-right w-28">Taxable (₹)</th>
              <th className="py-2.5 px-2 text-right w-28">Total (₹)</th>
              <th className="py-2.5 px-2 text-center w-10">Act</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {items.map((item, index) => (
              <InvoiceItemRow
                key={item.id || index}
                item={item}
                index={index}
                onUpdateItem={onUpdateItem}
                onUpdateCategory={onUpdateCategory}
                onRemoveItem={onRemoveItem}
                isOnlyItem={items.length <= 1}
                isInterstate={isInterstate}
                isMobileCard={false}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE / TABLET CARD VIEW (< 1024px) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
        {items.map((item, index) => (
          <InvoiceItemRow
            key={item.id || index}
            item={item}
            index={index}
            onUpdateItem={onUpdateItem}
            onUpdateCategory={onUpdateCategory}
            onRemoveItem={onRemoveItem}
            isOnlyItem={items.length <= 1}
            isInterstate={isInterstate}
            isMobileCard={true}
          />
        ))}
      </div>
    </div>
  );
}

