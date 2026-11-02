import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  X,
  Plus,
  BatteryCharging,
  Zap,
  Sun,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  formatItemSpecifications,
} from '../utils/categories';
import { formatNumber } from '../utils/numberToWords';

export default function CatalogItemPickerModal({
  isOpen,
  onClose,
  catalog = [],
  onSelectItem,
}) {
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return catalog.filter((item) => {
      if (selectedCat !== 'all' && item.category !== selectedCat) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const specs = formatItemSpecifications(item).toLowerCase();
        const match =
          (item.name || '').toLowerCase().includes(q) ||
          (item.brand || '').toLowerCase().includes(q) ||
          (item.model || '').toLowerCase().includes(q) ||
          (item.hsn || '').toLowerCase().includes(q) ||
          specs.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [catalog, selectedCat, searchQuery]);

  if (!isOpen) return null;

  const getCatIcon = (cat) => {
    switch (cat) {
      case PRODUCT_CATEGORIES.BATTERY:
        return <BatteryCharging className="w-3.5 h-3.5" />;
      case PRODUCT_CATEGORIES.INVERTER:
        return <Zap className="w-3.5 h-3.5" />;
      case PRODUCT_CATEGORIES.SOLAR:
        return <Sun className="w-3.5 h-3.5" />;
      case PRODUCT_CATEGORIES.SERVICES:
        return <Wrench className="w-3.5 h-3.5" />;
      default:
        return <Package className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Select Product from Catalog</h2>
              <p className="text-xs text-slate-400">Quickly add battery, inverter, solar, or service items</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCat('all')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 shrink-0 ${
                selectedCat === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>All ({catalog.length})</span>
            </button>
            {Object.values(CATEGORY_CONFIG).map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                onClick={() => setSelectedCat(cfg.id)}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 shrink-0 ${
                  selectedCat === cfg.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {getCatIcon(cfg.id)}
                <span>{cfg.label}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, brand, model, rating (150Ah, 1100VA, 550W), HSN..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Catalog List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-800/50">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching products found in the catalog.
            </div>
          ) : (
            filteredItems.map((prod) => {
              const catCfg = CATEGORY_CONFIG[prod.category] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
              const specs = formatItemSpecifications(prod);

              return (
                <div
                  key={prod.id}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 hover:bg-slate-800/30 p-2 rounded-xl transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${catCfg.badgeClass}`}>
                        {catCfg.label}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        {prod.brand}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">{prod.name}</div>
                    {specs && <div className="text-[11px] text-slate-400 truncate">{specs}</div>}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>HSN: {prod.hsn}</span>
                      <span>•</span>
                      <span>GST: {prod.gstRate}%</span>
                      {prod.warranty && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-slate-400">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            {prod.warranty}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div>
                      <div className="text-xs font-mono font-bold text-amber-400">
                        ₹{formatNumber(prod.sellingPrice)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {prod.isTaxInclusive ? 'Incl. GST' : '+ GST'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectItem(prod);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Select</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
