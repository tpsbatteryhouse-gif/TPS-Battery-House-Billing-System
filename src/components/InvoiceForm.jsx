import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  Save,
  Percent,
  CheckCircle2,
  Receipt,
  User,
  Package,
  ArrowRightLeft,
  BatteryCharging,
  Zap,
  Sun,
  Wrench,
  Layers,
  Info,
  Building2,
} from 'lucide-react';
import {
  ITEM_PRESETS,
  PAYMENT_MODES,
  GST_RATES,
} from '../utils/defaults';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  MULTI_CATEGORY_UNITS,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_CONFIG,
  inferTransactionType,
} from '../utils/categories';
import { formatNumber } from '../utils/numberToWords';
import { calculateLineItem } from '../utils/gstCalculations';
import { generateId } from '../utils/idGenerator';
import CatalogItemPickerModal from './CatalogItemPickerModal';

export default function InvoiceForm({
  invoice,
  setInvoice,
  catalog = [],
  onSave,
  onReset,
  onLoadSample,
  isSaved,
}) {
  const [activeTab, setActiveTab] = useState('items'); // 'general', 'items', 'adjustments'
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [presetCategoryFilter, setPresetCategoryFilter] = useState('all');

  const updateField = (path, value) => {
    setInvoice((prev) => {
      const copy = { ...prev };
      const keys = path.split('.');
      let current = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  const addItem = (preset = null, categoryOverride = null) => {
    if (preset) {
      const cat = preset.category || PRODUCT_CATEGORIES.BATTERY;
      const catCfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];

      const newItem = {
        id: generateId('item'),
        name: preset.name,
        category: cat,
        subcategory: preset.subcategory || catCfg.subcategories[0] || '',
        brand: preset.brand || '',
        model: preset.model || '',
        specs: { ...(preset.specs || {}) },
        hsn: preset.hsn || catCfg.defaultHsn,
        serialNo: '',
        warranty: preset.warranty || '36 Months',
        qty: 1,
        unit: preset.unit || catCfg.defaultUnit || 'Nos',
        rate: preset.price || preset.sellingPrice || 0,
        isTaxInclusive: preset.isTaxInclusive !== undefined ? preset.isTaxInclusive : true,
        gstRate: preset.gstRate || catCfg.defaultGstRate || 28,
      };

      setInvoice((prev) => ({
        ...prev,
        items: [...prev.items, newItem],
      }));
      return;
    }

    const defaultCat = categoryOverride || PRODUCT_CATEGORIES.BATTERY;
    const catCfg = CATEGORY_CONFIG[defaultCat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];

    const newItem = {
      id: generateId('item'),
      name: '',
      category: defaultCat,
      subcategory: catCfg.subcategories[0] || '',
      brand: '',
      model: '',
      specs: {},
      hsn: catCfg.defaultHsn,
      serialNo: '',
      warranty: defaultCat === PRODUCT_CATEGORIES.SERVICES ? 'Installation Warranty' : '36 Months',
      qty: 1,
      unit: catCfg.defaultUnit,
      rate: 0,
      isTaxInclusive: true,
      gstRate: catCfg.defaultGstRate,
    };

    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const updateItem = (index, field, value) => {
    setInvoice((prev) => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        [field]: value,
      };
      return { ...prev, items };
    });
  };

  const updateItemSpec = (index, specField, value) => {
    setInvoice((prev) => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        specs: {
          ...(items[index].specs || {}),
          [specField]: value,
        },
      };
      return { ...prev, items };
    });
  };

  const changeItemCategory = (index, newCategory) => {
    const catCfg = CATEGORY_CONFIG[newCategory] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
    setInvoice((prev) => {
      const items = [...prev.items];
      const cur = items[index];
      items[index] = {
        ...cur,
        category: newCategory,
        subcategory: catCfg.subcategories[0] || '',
        hsn: catCfg.defaultHsn,
        gstRate: catCfg.defaultGstRate,
        unit: catCfg.defaultUnit,
        specs: {},
      };
      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    if (invoice.items.length <= 1) {
      alert('Invoice must have at least one line item.');
      return;
    }
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handlePickFromCatalog = (product) => {
    addItem(product);
  };

  const hasBatteryItem = (invoice.items || []).some(
    (item) => (item.category || PRODUCT_CATEGORIES.BATTERY) === PRODUCT_CATEGORIES.BATTERY
  );

  const getCategoryIcon = (category, className = 'w-3.5 h-3.5') => {
    switch (category) {
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-full text-slate-200">
      {/* Top Header & Quick Action Buttons */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Invoice Details & Billing</h2>
            <p className="text-xs text-slate-400">Multi-Category: Battery • Inverter • Solar • Services</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            title="Load the comprehensive multi-category sample bill"
            className="px-2.5 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Load Sample</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            title="Clear and create a fresh new invoice"
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Bill</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
              isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
            }`}
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Bill</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Form Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 pt-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'items'
              ? 'border-amber-500 text-amber-400 font-bold bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Line Items ({invoice.items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'general'
              ? 'border-amber-500 text-amber-400 font-bold bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Customer & Meta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('adjustments')}
          className={`px-4 py-2 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'adjustments'
              ? 'border-amber-500 text-amber-400 font-bold bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Scrap & Discounts</span>
          {invoice.scrapExchange?.enabled && (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="p-4 overflow-y-auto flex-1 space-y-5">
        {/* TAB 1: LINE ITEMS */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            {/* Catalog & Quick Presets Picker */}
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Quick Item Catalogue & Presets:
                </span>

                <button
                  type="button"
                  onClick={() => setIsCatalogPickerOpen(true)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Browse Full Catalog</span>
                </button>
              </div>

              {/* Category Filter for Presets */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                <button
                  type="button"
                  onClick={() => setPresetCategoryFilter('all')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    presetCategoryFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                {Object.values(CATEGORY_CONFIG).map((cfg) => (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => setPresetCategoryFilter(cfg.id)}
                    className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                      presetCategoryFilter === cfg.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {getCategoryIcon(cfg.id, 'w-3 h-3')}
                    <span>{cfg.label}</span>
                  </button>
                ))}
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {ITEM_PRESETS.filter((p) =>
                  presetCategoryFilter === 'all' ? true : p.category === presetCategoryFilter
                ).map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addItem(preset)}
                    className="text-[11px] bg-slate-900/90 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 text-slate-300 border border-slate-700 px-2 py-1 rounded transition-colors text-left flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span className="truncate max-w-[200px]">{preset.name}</span>
                    <span className="text-[10px] text-amber-400/80 font-mono">
                      ₹{preset.price.toLocaleString('en-IN')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Items Cards */}
            <div className="space-y-4">
              {invoice.items.map((item, idx) => {
                const previewCalcs = calculateLineItem(item);
                const currentCat = item.category || PRODUCT_CATEGORIES.BATTERY;
                const catCfg = CATEGORY_CONFIG[currentCat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];

                return (
                  <div
                    key={item.id || idx}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-3.5 relative group hover:border-slate-600 transition-all shadow-md"
                  >
                    {/* Item Row Header: Category Selector Pills + Total + Remove */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-700 text-amber-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>

                        {/* Category Selector Pills */}
                        <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                          {Object.values(CATEGORY_CONFIG).map((cfg) => {
                            const isSelected = currentCat === cfg.id;
                            return (
                              <button
                                key={cfg.id}
                                type="button"
                                onClick={() => changeItemCategory(idx, cfg.id)}
                                className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                                  isSelected
                                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {getCategoryIcon(cfg.id, 'w-3 h-3')}
                                <span>{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          Total: ₹{formatNumber(previewCalcs.lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Item Name / Description */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">
                        {currentCat === PRODUCT_CATEGORIES.SERVICES
                          ? 'Service Title / Work Description *'
                          : 'Product Description / Model Name *'}
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        placeholder={
                          currentCat === PRODUCT_CATEGORIES.BATTERY
                            ? 'e.g. Exide InvaTubular IT500 150Ah Battery'
                            : currentCat === PRODUCT_CATEGORIES.INVERTER
                            ? 'e.g. Luminous EcoVolt Neo 1050 Sine Wave Inverter'
                            : currentCat === PRODUCT_CATEGORIES.SOLAR
                            ? 'e.g. Tata Power Solar 550W Mono PERC Panel'
                            : 'e.g. Complete Solar Inverter & Battery Installation'
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Category-Specific Dynamic Specifications */}
                    <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-2">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{catCfg.label} Specifications</span>
                      </div>

                      {/* BATTERY FIELDS */}
                      {currentCat === PRODUCT_CATEGORIES.BATTERY && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Capacity</label>
                            <input
                              type="text"
                              value={item.specs?.capacity || ''}
                              onChange={(e) => updateItemSpec(idx, 'capacity', e.target.value)}
                              placeholder="e.g. 150Ah"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Voltage</label>
                            <input
                              type="text"
                              value={item.specs?.voltage || ''}
                              onChange={(e) => updateItemSpec(idx, 'voltage', e.target.value)}
                              placeholder="e.g. 12V"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Technology</label>
                            <select
                              value={item.specs?.batteryType || 'Tall Tubular'}
                              onChange={(e) => updateItemSpec(idx, 'batteryType', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="Tall Tubular">Tall Tubular</option>
                              <option value="Short Tubular">Short Tubular</option>
                              <option value="Flat Plate">Flat Plate</option>
                              <option value="SMF / VRLA">SMF / VRLA</option>
                              <option value="Lithium (LiFePO4)">Lithium (LiFePO4)</option>
                            </select>
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Brand</label>
                            <input
                              type="text"
                              value={item.brand || ''}
                              onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                              placeholder="e.g. Exide, Amaron"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* INVERTER FIELDS */}
                      {currentCat === PRODUCT_CATEGORIES.INVERTER && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Rating (VA)</label>
                            <input
                              type="text"
                              value={item.specs?.capacityVa || ''}
                              onChange={(e) => updateItemSpec(idx, 'capacityVa', e.target.value)}
                              placeholder="e.g. 1100VA"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Power (Watts)</label>
                            <input
                              type="text"
                              value={item.specs?.powerWatts || ''}
                              onChange={(e) => updateItemSpec(idx, 'powerWatts', e.target.value)}
                              placeholder="e.g. 900W"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Waveform</label>
                            <select
                              value={item.specs?.waveform || 'Pure Sine Wave'}
                              onChange={(e) => updateItemSpec(idx, 'waveform', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="Pure Sine Wave">Pure Sine Wave</option>
                              <option value="Square Wave">Square Wave</option>
                              <option value="Modified Sine">Modified Sine</option>
                              <option value="Hybrid Dual">Hybrid Dual</option>
                            </select>
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Brand</label>
                            <input
                              type="text"
                              value={item.brand || ''}
                              onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                              placeholder="e.g. Luminous, Microtek"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* SOLAR FIELDS */}
                      {currentCat === PRODUCT_CATEGORIES.SOLAR && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Capacity (Wp)</label>
                            <input
                              type="text"
                              value={item.specs?.ratedCapacityWp || ''}
                              onChange={(e) => updateItemSpec(idx, 'ratedCapacityWp', e.target.value)}
                              placeholder="e.g. 550Wp"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Technology</label>
                            <select
                              value={item.specs?.panelTechnology || 'Mono PERC'}
                              onChange={(e) => updateItemSpec(idx, 'panelTechnology', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="Mono PERC">Mono PERC</option>
                              <option value="Bifacial Mono">Bifacial Mono</option>
                              <option value="TopCon N-Type">TopCon N-Type</option>
                              <option value="Polycrystalline">Polycrystalline</option>
                            </select>
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">System Capacity</label>
                            <input
                              type="text"
                              value={item.specs?.systemCapacityKw || ''}
                              onChange={(e) => updateItemSpec(idx, 'systemCapacityKw', e.target.value)}
                              placeholder="e.g. 3kW"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Brand</label>
                            <input
                              type="text"
                              value={item.brand || ''}
                              onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                              placeholder="e.g. Tata, Adani, Loom"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* SERVICES FIELDS */}
                      {currentCat === PRODUCT_CATEGORIES.SERVICES && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Service Category / Scope</label>
                            <input
                              type="text"
                              value={item.specs?.serviceScope || ''}
                              onChange={(e) => updateItemSpec(idx, 'serviceScope', e.target.value)}
                              placeholder="e.g. Rooftop Mounting, DC Cabling & Inverter Connection"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[10px] text-slate-400">Service Work Warranty</label>
                            <input
                              type="text"
                              value={item.warranty || ''}
                              onChange={(e) => updateItem(idx, 'warranty', e.target.value)}
                              placeholder="e.g. 1 Year Workmanship Warranty"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* HSN Code & Warranty & Serial No (if physical) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-medium text-slate-400">HSN / SAC</label>
                          <span className="text-[10px] text-amber-400/80 font-mono">
                            {catCfg.label}: {catCfg.defaultHsn}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => updateItem(idx, 'hsn', e.target.value)}
                          placeholder={catCfg.defaultHsn}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Warranty */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Warranty</label>
                        <input
                          type="text"
                          value={item.warranty}
                          onChange={(e) => updateItem(idx, 'warranty', e.target.value)}
                          placeholder="e.g. 36 Months / 10 Years"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Serial Number (Only for physical products) */}
                      {currentCat !== PRODUCT_CATEGORIES.SERVICES ? (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-400">Serial No / Batch</label>
                          <input
                            type="text"
                            value={item.serialNo || ''}
                            onChange={(e) => updateItem(idx, 'serialNo', e.target.value)}
                            placeholder="e.g. BAT-2026-9021"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-400">Technician / Job Ref</label>
                          <input
                            type="text"
                            value={item.serialNo || ''}
                            onChange={(e) => updateItem(idx, 'serialNo', e.target.value)}
                            placeholder="e.g. JOB-SRV-042"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Qty, Unit, Rate, Discount, Tax Inclusive Toggle, GST Rate */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Qty</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.qty ?? ''}
                          onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          {MULTI_CATEGORY_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="text-[11px] font-medium text-slate-400">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate ?? ''}
                          onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-right focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Item Dis (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.discount ?? ''}
                          placeholder="0.00"
                          onChange={(e) => updateItem(idx, 'discount', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-right focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Pricing Mode</label>
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'isTaxInclusive', !item.isTaxInclusive)}
                          className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center transition-colors ${
                            item.isTaxInclusive
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {item.isTaxInclusive ? 'Incl. (MRP)' : 'Excl. + Tax'}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">GST Rate (%)</label>
                        <select
                          value={item.gstRate}
                          onChange={(e) => updateItem(idx, 'gstRate', Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                        >
                          {GST_RATES.map((r) => (
                            <option key={r} value={r}>
                              {r}% GST {r === 28 ? '(Battery)' : r === 18 ? '(Inverter/Srv)' : r === 12 ? '(Solar)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Calculated row breakdown pill */}
                    <div className="bg-slate-950/60 rounded-lg px-3 py-1.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 border border-slate-800">
                      <div>
                        Taxable: <span className="text-slate-200">₹{formatNumber(previewCalcs.taxableValue)}</span>
                      </div>
                      <div>
                        CGST ({previewCalcs.cgstRate}%): <span className="text-slate-200">₹{formatNumber(previewCalcs.cgstAmount)}</span>
                      </div>
                      <div>
                        SGST ({previewCalcs.sgstRate}%): <span className="text-slate-200">₹{formatNumber(previewCalcs.sgstAmount)}</span>
                      </div>
                      <div className="font-bold text-amber-400">
                        Line Gross: ₹{formatNumber(previewCalcs.lineTotal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Item Buttons (Per Category) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {Object.values(CATEGORY_CONFIG).map((cfg) => (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => addItem(null, cfg.id)}
                  className="py-2.5 px-3 border border-dashed border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-slate-800/30 hover:bg-amber-500/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add {cfg.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL & CUSTOMER DETAILS */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Dedicated Transaction Type Selector */}
            {(() => {
              const currentTxType = invoice.transactionType || inferTransactionType(invoice);
              const gstinVal = (invoice.customer?.gstin || '').trim();
              const isGstinFormatValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal);

              return (
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-blue-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      <span>Transaction Type Classification</span>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono font-bold border border-blue-500/20">
                      Active: {currentTxType}
                    </span>
                  </div>

                  {/* 5 Transaction Type Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {Object.values(TRANSACTION_TYPES).map((typeKey) => {
                      const cfg = TRANSACTION_TYPE_CONFIG[typeKey];
                      const isSelected = currentTxType === typeKey;
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => updateField('transactionType', typeKey)}
                          className={`p-2 rounded-lg text-left text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20 ring-1 ring-blue-300'
                              : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>{typeKey}</span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" />}
                          </div>
                          <div className={`text-[9.5px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {typeKey === 'B2B' ? 'Business / GST' : typeKey === 'B2C' ? 'Retail Consumer' : cfg.shortLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Statutory Info Banner */}
                  <div className="text-[11px] p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-semibold text-white">
                        {TRANSACTION_TYPE_CONFIG[currentTxType]?.label}
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        {TRANSACTION_TYPE_CONFIG[currentTxType]?.description}
                      </div>
                      {currentTxType === 'B2B' && !gstinVal && (
                        <div className="text-[10.5px] text-amber-400 font-medium pt-0.5">
                          Notice: B2B billing requires a valid Buyer GSTIN to enable statutory Input Tax Credit (ITC). If the customer has no GSTIN, switch to B2C.
                        </div>
                      )}
                      {currentTxType === 'B2B' && gstinVal && !isGstinFormatValid && (
                        <div className="text-[10.5px] text-amber-400 font-medium pt-0.5">
                          Note: Standard Indian GSTIN is 15 alphanumeric characters (e.g. 32AABCU9603R1ZM). Please verify format.
                        </div>
                      )}
                      {(currentTxType === 'SEZ' || currentTxType === 'EXPORT' || currentTxType === 'DEEMED_EXPORT') && (
                        <div className="text-[10.5px] text-purple-300 font-medium pt-0.5">
                          Statutory requirement: Ensure prescribed declarations, export documentation, or SEZ authorized officer endorsements are retained on record.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Invoice Meta Section */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Invoice Identification & Status
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Invoice Number *</label>
                  <input
                    type="text"
                    value={invoice.invoiceNumber}
                    onChange={(e) => updateField('invoiceNumber', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Invoice Date *</label>
                  <input
                    type="date"
                    value={invoice.invoiceDate}
                    onChange={(e) => updateField('invoiceDate', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Due Date</label>
                  <input
                    type="date"
                    value={invoice.dueDate}
                    onChange={(e) => updateField('dueDate', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Payment Status</label>
                  <select
                    value={invoice.paymentStatus}
                    onChange={(e) => updateField('paymentStatus', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Paid">Paid (Completed)</option>
                    <option value="Pending">Pending</option>
                    <option value="Draft">Draft</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Payment Mode</label>
                  <select
                    value={invoice.paymentMode}
                    onChange={(e) => updateField('paymentMode', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Place of Supply</label>
                  <input
                    type="text"
                    value={invoice.placeOfSupply || ''}
                    onChange={(e) => updateField('placeOfSupply', e.target.value)}
                    placeholder="Kerala (32)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Reverse Charge Applicable</label>
                  <select
                    value={invoice.reverseCharge || 'No'}
                    onChange={(e) => updateField('reverseCharge', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="No">No (Standard)</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>

              {/* Optional Statutory & Transport References (E-Way Bill, IRN, PO) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/80">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">E-Way Bill No (Optional)</label>
                  <input
                    type="text"
                    value={invoice.ewayBillNo || ''}
                    onChange={(e) => updateField('ewayBillNo', e.target.value)}
                    placeholder="e.g. 2725843108"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Purchase Order (PO) No</label>
                  <input
                    type="text"
                    value={invoice.poNumber || ''}
                    onChange={(e) => updateField('poNumber', e.target.value)}
                    placeholder="e.g. PO-2026-891"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">IRN Reference No (Optional)</label>
                  <input
                    type="text"
                    value={invoice.irn || ''}
                    onChange={(e) => updateField('irn', e.target.value)}
                    placeholder="e.g. 7a74303e39eb..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Customer Section */}
            {(() => {
              const currentTxType = invoice.transactionType || inferTransactionType(invoice);
              const isB2B = currentTxType === TRANSACTION_TYPES.B2B || currentTxType === TRANSACTION_TYPES.SEZ || currentTxType === TRANSACTION_TYPES.DEEMED_EXPORT;
              const gstinVal = (invoice.customer?.gstin || '').trim();
              const isGstinFormatValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal);

              return (
                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>{isB2B ? 'Buyer / Billed-To Business Particulars' : 'Customer / Billed-To Particulars'}</span>
                    </div>
                    <span className="text-[10px] font-sans font-semibold text-slate-400">
                      {isB2B ? 'B2B Registered Entity' : 'B2C Retail Buyer'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">
                        {isB2B ? 'Buyer Business / Entity Name *' : 'Customer Name *'}
                      </label>
                      <input
                        type="text"
                        value={invoice.customer.name}
                        onChange={(e) => updateField('customer.name', e.target.value)}
                        placeholder={isB2B ? 'e.g. Urjaamithra Enterprises / Rajesh K.' : 'e.g. Rajesh K.'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">
                        {isB2B ? 'Contact / Phone Number' : 'Customer Phone Number'}
                      </label>
                      <input
                        type="tel"
                        value={invoice.customer.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d+ -]/g, '');
                          updateField('customer.phone', val);
                        }}
                        placeholder="e.g. +91 9846830532"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400">Billing Street / Area Address</label>
                    <input
                      type="text"
                      value={invoice.customer.address}
                      onChange={(e) => updateField('customer.address', e.target.value)}
                      placeholder="Building / House / Street Name"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">City / Town</label>
                      <input
                        type="text"
                        value={invoice.customer.city}
                        onChange={(e) => updateField('customer.city', e.target.value)}
                        placeholder="Thrithala"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">District</label>
                      <input
                        type="text"
                        value={invoice.customer.district}
                        onChange={(e) => updateField('customer.district', e.target.value)}
                        placeholder="Palakkad"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">PIN Code</label>
                      <input
                        type="text"
                        value={invoice.customer.pincode}
                        onChange={(e) =>
                          updateField('customer.pincode', e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="679552"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">State Code</label>
                      <input
                        type="text"
                        value={invoice.customer.stateCode}
                        onChange={(e) => updateField('customer.stateCode', e.target.value)}
                        placeholder="32"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* GSTIN & PAN Section */}
                  {isB2B ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-medium text-slate-400">
                            Buyer GSTIN (Required for B2B ITC) *
                          </label>
                          {gstinVal && (
                            <span className={`text-[10px] font-medium ${isGstinFormatValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {isGstinFormatValid ? '✓ Valid format' : '⚠ Check 15-digit format'}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={invoice.customer.gstin || ''}
                          onChange={(e) => updateField('customer.gstin', e.target.value.toUpperCase())}
                          placeholder="e.g. 32AABCU9603R1ZM"
                          className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-xs font-mono uppercase focus:outline-none ${
                            !gstinVal
                              ? 'border-amber-500/50 text-white placeholder-amber-400/40'
                              : 'border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">
                          Customer PAN No (Optional)
                        </label>
                        <input
                          type="text"
                          value={invoice.customer.pan || ''}
                          onChange={(e) => updateField('customer.pan', e.target.value.toUpperCase())}
                          placeholder="e.g. ABCDE1234F"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-medium text-slate-400">
                        Customer PAN No (Optional)
                      </label>
                      <input
                        type="text"
                        value={invoice.customer.pan || ''}
                        onChange={(e) => updateField('customer.pan', e.target.value.toUpperCase())}
                        placeholder="e.g. ABCDE1234F (Optional for retail B2C consumer)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-medium text-slate-400">
                      Shipping / Delivery Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={invoice.customer.shippingAddress || ''}
                      onChange={(e) => updateField('customer.shippingAddress', e.target.value)}
                      placeholder="Leave blank if identical to billing address"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Terms & Notes */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-2">
              <label className="text-[11px] font-medium text-slate-400">Invoice Terms & Notes</label>
              <textarea
                rows={2}
                value={invoice.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Goods once sold will not be taken back without original bill."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}

        {/* TAB 3: SCRAP EXCHANGE & ADJUSTMENTS */}
        {activeTab === 'adjustments' && (
          <div className="space-y-4">
            {/* Scrap Buyback Section (Battery Exclusive) */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Old Battery Scrap Buyback / Exchange</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 lowercase">
                        battery exclusive
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Deduct scrap battery exchange trade-in value from invoice total
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invoice.scrapExchange?.enabled || false}
                    onChange={(e) => updateField('scrapExchange.enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Eligibility Hint */}
              <div className="text-[11px] p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2 text-slate-400">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {hasBatteryItem
                    ? 'Eligible: Current bill includes battery products suitable for exchange deduction.'
                    : 'Note: Scrap buyback is battery-specific and disabled for non-battery items, but can be enabled if the customer trades in an old battery.'}
                </span>
              </div>

              {invoice.scrapExchange?.enabled && (
                <div className="pt-2 border-t border-slate-700/60 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400">
                      Scrap Description / Model
                    </label>
                    <input
                      type="text"
                      value={invoice.scrapExchange.description}
                      onChange={(e) => updateField('scrapExchange.description', e.target.value)}
                      placeholder="e.g. Old 150Ah Scrap Battery Buyback"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400">
                      Scrap Deduction Amount (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={invoice.scrapExchange.amount ?? ''}
                      onChange={(e) => updateField('scrapExchange.amount', e.target.value)}
                      placeholder="2000"
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                    />
                    <div className="text-[10px] text-slate-400">
                      Standard scrap rates: 150Ah Tubular ~₹2,000 to ₹2,500; Car 35-45Ah ~₹500 to ₹900.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Discounts & Manual Round-off */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                Additional Discounts & Rounding
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Special Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={invoice.additionalDiscount ?? ''}
                    onChange={(e) => updateField('additionalDiscount', e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-medium text-slate-400">Manual Round-off</label>
                    <button
                      type="button"
                      onClick={() => updateField('roundOffManual', null)}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Reset to Auto
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={invoice.roundOffManual ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField('roundOffManual', val === '' ? null : parseFloat(val));
                    }}
                    placeholder="Auto (Nearest ₹1)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Catalog Item Picker Modal */}
      <CatalogItemPickerModal
        isOpen={isCatalogPickerOpen}
        onClose={() => setIsCatalogPickerOpen(false)}
        catalog={catalog}
        onSelectItem={handlePickFromCatalog}
      />
    </div>
  );
}
