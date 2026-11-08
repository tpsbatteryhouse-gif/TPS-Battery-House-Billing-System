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
  Users,
  Package,
  ArrowRightLeft,
  BatteryCharging,
  Zap,
  Sun,
  Wrench,
  Layers,
  Info,
  Building2,
  Eye,
  Printer,
  Download,
  Loader2,
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
import { calculateLineItem, calculateInvoiceTotals } from '../utils/gstCalculations';
import { generateId } from '../utils/idGenerator';
import CatalogItemPickerModal from './CatalogItemPickerModal';
import CustomerPickerModal from './CustomerPickerModal';

export default function InvoiceForm({
  invoice,
  setInvoice,
  catalog = [],
  customers = [],
  business,
  onSave,
  onReset,
  onLoadSample,
  isSaved,
  onPreview,
  onPrint,
  onDownloadPdf,
  isPdfGenerating = false,
}) {
  const [activeTab, setActiveTab] = useState('items'); // 'items', 'general', 'adjustments'
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [presetCategoryFilter, setPresetCategoryFilter] = useState('all');

  const handleSelectCustomer = (cust) => {
    if (!cust) return;
    setInvoice((prev) => {
      const isB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);
      const newTxType = isB2B ? TRANSACTION_TYPES.B2B : TRANSACTION_TYPES.B2C;
      return {
        ...prev,
        transactionType: newTxType,
        customer: {
          ...prev.customer,
          name: cust.name || '',
          phone: cust.phone || '',
          address: cust.address || '',
          shippingAddress: cust.shippingAddress || '',
          city: cust.city || 'Thrithala',
          district: cust.district || 'Palakkad',
          state: cust.state || 'Kerala',
          stateCode: cust.stateCode || '32',
          pincode: cust.pincode || '679552',
          gstin: cust.gstin || '',
          pan: cust.pan || (cust.gstin && cust.gstin.length >= 12 ? cust.gstin.slice(2, 12) : ''),
        },
      };
    });
  };

  const totals = calculateInvoiceTotals(invoice, business?.stateCode || '32');

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
        discount: 0,
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
      discount: 0,
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
        warranty: newCategory === PRODUCT_CATEGORIES.SERVICES ? 'Installation Warranty' : '36 Months',
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col w-full text-slate-200">
      {/* Top Header & Primary Action Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Invoice Details & Billing Workspace</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                {invoice.invoiceNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400">Multi-Category GST Billing: Battery • Inverter • Solar • Services</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onLoadSample}
            title="Load the comprehensive multi-category sample bill"
            className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Load Sample</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            title="Clear and create a fresh new invoice"
            className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Bill</span>
          </button>

          {/* Dedicated Preview Invoice Action */}
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              title="Preview A4 Tax Invoice document"
              className="px-3 sm:px-3.5 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg flex items-center gap-1.5 transition-all shadow-md"
            >
              <Eye className="w-4 h-4 text-slate-950" />
              <span>Preview Invoice</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            className={`px-3.5 sm:px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
              isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
            }`}
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Bill</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Form Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 pt-2 text-xs font-medium">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`px-4 sm:px-5 py-2.5 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'items'
                ? 'border-amber-500 text-amber-400 font-bold bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Line Items ({invoice.items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-4 sm:px-5 py-2.5 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'general'
                ? 'border-amber-500 text-amber-400 font-bold bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Customer & Meta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('adjustments')}
            className={`px-4 sm:px-5 py-2.5 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'adjustments'
                ? 'border-amber-500 text-amber-400 font-bold bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Scrap & Discounts</span>
            {invoice.scrapExchange?.enabled && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Quick Financial Overview Pill in Tab Header */}
        <div className="hidden md:flex items-center gap-3 py-1.5 text-xs font-mono">
          <span className="text-slate-400">
            Taxable: <strong className="text-slate-200 font-bold">₹{formatNumber(totals.totalTaxableValue)}</strong>
          </span>
          <span className="text-slate-400">
            Total GST: <strong className="text-slate-200 font-bold">₹{formatNumber(totals.totalTax)}</strong>
          </span>
          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg font-bold">
            Bill Amount: ₹{formatNumber(totals.netPayable)}
          </span>
        </div>
      </div>

      {/* Main Tab Content (Spacious Full-Width Container, Natural Page Scrolling) */}
      <div className="p-4 sm:p-6 lg:p-7 space-y-6 flex-1">
        {/* TAB 1: LINE ITEMS */}
        {activeTab === 'items' && (
          <div className="space-y-6">
            {/* Catalog & Quick Presets Bar */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Quick Item Catalogue & Presets:
                </span>

                <button
                  type="button"
                  onClick={() => setIsCatalogPickerOpen(true)}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Browse Full Catalog</span>
                </button>
              </div>

              {/* Category Filter for Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => setPresetCategoryFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    presetCategoryFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  All Categories
                </button>
                {Object.values(CATEGORY_CONFIG).map((cfg) => (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => setPresetCategoryFilter(cfg.id)}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      presetCategoryFilter === cfg.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {getCategoryIcon(cfg.id, 'w-3.5 h-3.5')}
                    <span>{cfg.label}</span>
                  </button>
                ))}
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {ITEM_PRESETS.filter((p) =>
                  presetCategoryFilter === 'all' ? true : p.category === presetCategoryFilter
                ).map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addItem(preset)}
                    className="text-xs bg-slate-900/90 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors text-left flex items-center gap-2"
                  >
                    <span className="text-amber-400 font-bold">+</span>
                    <span className="font-medium truncate max-w-[260px]">{preset.name}</span>
                    <span className="text-[11px] text-amber-400 font-mono">
                      ₹{preset.price.toLocaleString('en-IN')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Full-Width Items Cards */}
            <div className="space-y-5">
              {invoice.items.map((item, idx) => {
                const previewCalcs = calculateLineItem(item);
                const currentCat = item.category || PRODUCT_CATEGORIES.BATTERY;
                const catCfg = CATEGORY_CONFIG[currentCat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];

                return (
                  <div
                    key={item.id || idx}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-4 relative group hover:border-slate-600 transition-all shadow-lg"
                  >
                    {/* Item Row Header: Category Selector Pills + Total + Remove */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-700 text-amber-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>

                        {/* Category Selector Pills */}
                        <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
                          {Object.values(CATEGORY_CONFIG).map((cfg) => {
                            const isSelected = currentCat === cfg.id;
                            return (
                              <button
                                key={cfg.id}
                                type="button"
                                onClick={() => changeItemCategory(idx, cfg.id)}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                  isSelected
                                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {getCategoryIcon(cfg.id, 'w-3.5 h-3.5')}
                                <span>{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Category Default HSN indicator */}
                        <span className="hidden sm:inline text-xs text-slate-400 font-mono">
                          Default HSN: <strong className="text-slate-300">{catCfg.defaultHsn}</strong> ({catCfg.defaultGstRate}%)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                          Total: ₹{formatNumber(previewCalcs.lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Group 1: Product Identification (12-Column Responsive Desktop Grid) */}
                    <div className="grid grid-cols-12 gap-3 sm:gap-4">
                      {/* Product Name / Description (Wide) */}
                      <div className="col-span-12 lg:col-span-6 space-y-1">
                        <label className="text-xs font-medium text-slate-300">
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Brand */}
                      <div className="col-span-6 sm:col-span-4 lg:col-span-2 space-y-1">
                        <label className="text-xs font-medium text-slate-300">Brand / Make</label>
                        <input
                          type="text"
                          value={item.brand || ''}
                          onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                          placeholder={
                            currentCat === PRODUCT_CATEGORIES.BATTERY
                              ? 'Exide / Amaron'
                              : currentCat === PRODUCT_CATEGORIES.INVERTER
                              ? 'Luminous / Microtek'
                              : currentCat === PRODUCT_CATEGORIES.SOLAR
                              ? 'Tata / Adani'
                              : 'TPS Service'
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Model */}
                      <div className="col-span-6 sm:col-span-4 lg:col-span-2 space-y-1">
                        <label className="text-xs font-medium text-slate-300">Model / Series</label>
                        <input
                          type="text"
                          value={item.model || ''}
                          onChange={(e) => updateItem(idx, 'model', e.target.value)}
                          placeholder="e.g. IT500 / Neo 1050"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* HSN / SAC */}
                      <div className="col-span-12 sm:col-span-4 lg:col-span-2 space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-medium text-slate-300">HSN / SAC *</label>
                          <span className="text-[10px] text-amber-400 font-mono">{catCfg.defaultHsn}</span>
                        </div>
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => updateItem(idx, 'hsn', e.target.value)}
                          placeholder={catCfg.defaultHsn}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Group 2: Category-Specific Specifications (Spacious Multi-Column Grid) */}
                    <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2.5">
                      <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{catCfg.label} Technical Specifications & Warranty</span>
                      </div>

                      {/* BATTERY FIELDS (5 Columns on Desktop) */}
                      {currentCat === PRODUCT_CATEGORIES.BATTERY && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Capacity (Ah)</label>
                            <input
                              type="text"
                              value={item.specs?.capacity || ''}
                              onChange={(e) => updateItemSpec(idx, 'capacity', e.target.value)}
                              placeholder="e.g. 150Ah"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Voltage</label>
                            <input
                              type="text"
                              value={item.specs?.voltage || ''}
                              onChange={(e) => updateItemSpec(idx, 'voltage', e.target.value)}
                              placeholder="e.g. 12V"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Technology</label>
                            <select
                              value={item.specs?.batteryType || 'Tall Tubular'}
                              onChange={(e) => updateItemSpec(idx, 'batteryType', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            >
                              <option value="Tall Tubular">Tall Tubular</option>
                              <option value="Short Tubular">Short Tubular</option>
                              <option value="Flat Plate">Flat Plate</option>
                              <option value="SMF / VRLA">SMF / VRLA</option>
                              <option value="Lithium (LiFePO4)">Lithium (LiFePO4)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Warranty</label>
                            <input
                              type="text"
                              value={item.warranty}
                              onChange={(e) => updateItem(idx, 'warranty', e.target.value)}
                              placeholder="e.g. 36+24 Months"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label className="text-[11px] text-slate-400">Serial No / Batch</label>
                            <input
                              type="text"
                              value={item.serialNo || ''}
                              onChange={(e) => updateItem(idx, 'serialNo', e.target.value)}
                              placeholder="e.g. BAT-2026-9021"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* INVERTER FIELDS (5 Columns on Desktop) */}
                      {currentCat === PRODUCT_CATEGORIES.INVERTER && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Rating (VA)</label>
                            <input
                              type="text"
                              value={item.specs?.capacityVa || ''}
                              onChange={(e) => updateItemSpec(idx, 'capacityVa', e.target.value)}
                              placeholder="e.g. 1100VA"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Power (Watts)</label>
                            <input
                              type="text"
                              value={item.specs?.powerWatts || ''}
                              onChange={(e) => updateItemSpec(idx, 'powerWatts', e.target.value)}
                              placeholder="e.g. 900W"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Waveform</label>
                            <select
                              value={item.specs?.waveform || 'Pure Sine Wave'}
                              onChange={(e) => updateItemSpec(idx, 'waveform', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            >
                              <option value="Pure Sine Wave">Pure Sine Wave</option>
                              <option value="Square Wave">Square Wave</option>
                              <option value="Modified Sine">Modified Sine</option>
                              <option value="Hybrid Dual">Hybrid Dual</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Warranty</label>
                            <input
                              type="text"
                              value={item.warranty}
                              onChange={(e) => updateItem(idx, 'warranty', e.target.value)}
                              placeholder="e.g. 24 Months"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label className="text-[11px] text-slate-400">Serial No / Batch</label>
                            <input
                              type="text"
                              value={item.serialNo || ''}
                              onChange={(e) => updateItem(idx, 'serialNo', e.target.value)}
                              placeholder="e.g. INV-2026-441"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* SOLAR FIELDS (5 Columns on Desktop) */}
                      {currentCat === PRODUCT_CATEGORIES.SOLAR && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Capacity (Wp)</label>
                            <input
                              type="text"
                              value={item.specs?.ratedCapacityWp || ''}
                              onChange={(e) => updateItemSpec(idx, 'ratedCapacityWp', e.target.value)}
                              placeholder="e.g. 550Wp"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Panel Tech</label>
                            <select
                              value={item.specs?.panelTechnology || 'Mono PERC'}
                              onChange={(e) => updateItemSpec(idx, 'panelTechnology', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            >
                              <option value="Mono PERC">Mono PERC</option>
                              <option value="Bifacial Mono">Bifacial Mono</option>
                              <option value="TopCon N-Type">TopCon N-Type</option>
                              <option value="Polycrystalline">Polycrystalline</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">System (kW)</label>
                            <input
                              type="text"
                              value={item.specs?.systemCapacityKw || ''}
                              onChange={(e) => updateItemSpec(idx, 'systemCapacityKw', e.target.value)}
                              placeholder="e.g. 3kW"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Warranty</label>
                            <input
                              type="text"
                              value={item.warranty}
                              onChange={(e) => updateItem(idx, 'warranty', e.target.value)}
                              placeholder="e.g. 25 Years Performance"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label className="text-[11px] text-slate-400">Serial No / Batch</label>
                            <input
                              type="text"
                              value={item.serialNo || ''}
                              onChange={(e) => updateItem(idx, 'serialNo', e.target.value)}
                              placeholder="e.g. SOL-2026-102"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* SERVICES FIELDS (3 Columns on Desktop) */}
                      {currentCat === PRODUCT_CATEGORIES.SERVICES && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[11px] text-slate-400">Service Category / Scope</label>
                            <input
                              type="text"
                              value={item.specs?.serviceScope || ''}
                              onChange={(e) => updateItemSpec(idx, 'serviceScope', e.target.value)}
                              placeholder="e.g. Rooftop Mounting, DC Cabling & Inverter Connection"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Technician / Job Ref</label>
                            <input
                              type="text"
                              value={item.serialNo || ''}
                              onChange={(e) => updateItem(idx, 'serialNo', e.target.value)}
                              placeholder="e.g. JOB-SRV-042"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400">Service Workmanship Warranty</label>
                            <input
                              type="text"
                              value={item.warranty || ''}
                              onChange={(e) => updateItem(idx, 'warranty', e.target.value)}
                              placeholder="e.g. 1 Year Workmanship Warranty"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Group 3: Pricing, Quantity, Discount & Tax (6-Column Responsive Desktop Grid) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Quantity</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.qty ?? ''}
                          onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white text-center focus:outline-none focus:border-amber-500 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                        >
                          {MULTI_CATEGORY_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Rate / Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate ?? ''}
                          onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white text-right focus:outline-none focus:border-amber-500 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Item Discount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.discount ?? ''}
                          placeholder="0.00"
                          onChange={(e) => updateItem(idx, 'discount', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white text-right focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Pricing Mode</label>
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'isTaxInclusive', !item.isTaxInclusive)}
                          className={`w-full py-2 px-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center transition-colors ${
                            item.isTaxInclusive
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          {item.isTaxInclusive ? 'Incl. (MRP)' : 'Excl. + Tax'}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">GST Rate (%)</label>
                        <select
                          value={item.gstRate}
                          onChange={(e) => updateItem(idx, 'gstRate', Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500 font-bold"
                        >
                          {GST_RATES.map((r) => (
                            <option key={r} value={r}>
                              {r}% GST {r === 28 ? '(Battery)' : r === 18 ? '(Inverter/Srv)' : r === 12 ? '(Solar)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Group 4: Live Calculated Breakdown Strip */}
                    <div className="bg-slate-950/70 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 border border-slate-800 gap-2">
                      <div>
                        Taxable Value: <strong className="text-slate-200">₹{formatNumber(previewCalcs.taxableValue)}</strong>
                      </div>
                      <div>
                        CGST ({previewCalcs.cgstRate}%): <strong className="text-slate-200">₹{formatNumber(previewCalcs.cgstAmount)}</strong>
                      </div>
                      <div>
                        SGST ({previewCalcs.sgstRate}%): <strong className="text-slate-200">₹{formatNumber(previewCalcs.sgstAmount)}</strong>
                      </div>
                      <div>
                        Total Tax: <strong className="text-slate-200">₹{formatNumber(previewCalcs.totalGstAmount)}</strong>
                      </div>
                      <div className="font-bold text-amber-400 text-sm">
                        Line Gross: ₹{formatNumber(previewCalcs.lineTotal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Spacious Add New Item Buttons (Per Category) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {Object.values(CATEGORY_CONFIG).map((cfg) => (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => addItem(null, cfg.id)}
                  className="py-3 px-4 border border-dashed border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-slate-800/30 hover:bg-amber-500/10 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add {cfg.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL & CUSTOMER DETAILS */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Panel 1: Transaction Type Classification */}
            {(() => {
              const currentTxType = invoice.transactionType || inferTransactionType(invoice);
              const gstinVal = (invoice.customer?.gstin || '').trim();
              const isGstinFormatValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal);

              return (
                <div className="bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-blue-500/40 space-y-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span>Transaction Type Classification</span>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 font-mono font-bold border border-blue-500/20">
                      Active: {currentTxType}
                    </span>
                  </div>

                  {/* 5 Transaction Type Cards in Responsive Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Object.values(TRANSACTION_TYPES).map((typeKey) => {
                      const cfg = TRANSACTION_TYPE_CONFIG[typeKey];
                      const isSelected = currentTxType === typeKey;
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => updateField('transactionType', typeKey)}
                          className={`p-3 rounded-xl text-left text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20 ring-2 ring-blue-300'
                              : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between text-sm">
                            <span>{typeKey}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-200" />}
                          </div>
                          <div className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {typeKey === 'B2B' ? 'Business / GST' : typeKey === 'B2C' ? 'Retail Consumer' : cfg.shortLabel}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Statutory Info Banner */}
                  <div className="text-xs p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-white">
                        {TRANSACTION_TYPE_CONFIG[currentTxType]?.label}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {TRANSACTION_TYPE_CONFIG[currentTxType]?.description}
                      </div>
                      {currentTxType === 'B2B' && !gstinVal && (
                        <div className="text-[11px] text-amber-400 font-medium pt-0.5">
                          Notice: B2B billing requires a valid Buyer GSTIN to enable statutory Input Tax Credit (ITC). If the customer has no GSTIN, switch to B2C.
                        </div>
                      )}
                      {currentTxType === 'B2B' && gstinVal && !isGstinFormatValid && (
                        <div className="text-[11px] text-amber-400 font-medium pt-0.5">
                          Note: Standard Indian GSTIN is 15 alphanumeric characters (e.g. 32AABCU9603R1ZM). Please verify format.
                        </div>
                      )}
                      {(currentTxType === 'SEZ' || currentTxType === 'EXPORT' || currentTxType === 'DEEMED_EXPORT') && (
                        <div className="text-[11px] text-purple-300 font-medium pt-0.5">
                          Statutory requirement: Ensure prescribed declarations, export documentation, or SEZ authorized officer endorsements are retained on record.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Panel 2: Invoice Metadata & Statutory References (Spacious 4-Column Responsive Grid) */}
            <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/60 space-y-4 shadow-lg">
              <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <span>Invoice Identification & Status</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Invoice Number *</label>
                  <input
                    type="text"
                    value={invoice.invoiceNumber}
                    onChange={(e) => updateField('invoiceNumber', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Invoice Date *</label>
                  <input
                    type="date"
                    value={invoice.invoiceDate}
                    onChange={(e) => updateField('invoiceDate', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Due Date</label>
                  <input
                    type="date"
                    value={invoice.dueDate}
                    onChange={(e) => updateField('dueDate', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Payment Status</label>
                  <select
                    value={invoice.paymentStatus}
                    onChange={(e) => updateField('paymentStatus', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Paid">Paid (Completed)</option>
                    <option value="Pending">Pending</option>
                    <option value="Draft">Draft</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Payment Mode</label>
                  <select
                    value={invoice.paymentMode}
                    onChange={(e) => updateField('paymentMode', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Place of Supply</label>
                  <input
                    type="text"
                    value={invoice.placeOfSupply || ''}
                    onChange={(e) => updateField('placeOfSupply', e.target.value)}
                    placeholder="Kerala (32)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Reverse Charge</label>
                  <select
                    value={invoice.reverseCharge || 'No'}
                    onChange={(e) => updateField('reverseCharge', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="No">No (Standard)</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Purchase Order (PO) No</label>
                  <input
                    type="text"
                    value={invoice.poNumber || ''}
                    onChange={(e) => updateField('poNumber', e.target.value)}
                    placeholder="e.g. PO-2026-891"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">E-Way Bill No (Optional)</label>
                  <input
                    type="text"
                    value={invoice.ewayBillNo || ''}
                    onChange={(e) => updateField('ewayBillNo', e.target.value)}
                    placeholder="e.g. 2725843108"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <label className="text-xs font-medium text-slate-300">IRN Reference No (Optional)</label>
                  <input
                    type="text"
                    value={invoice.irn || ''}
                    onChange={(e) => updateField('irn', e.target.value)}
                    placeholder="e.g. 7a74303e39eb..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Panel 3: Buyer / Customer Particulars (Spacious Grid) */}
            {(() => {
              const currentTxType = invoice.transactionType || inferTransactionType(invoice);
              const isB2B = currentTxType === TRANSACTION_TYPES.B2B || currentTxType === TRANSACTION_TYPES.SEZ || currentTxType === TRANSACTION_TYPES.DEEMED_EXPORT;
              const gstinVal = (invoice.customer?.gstin || '').trim();
              const isGstinFormatValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstinVal);

              return (
                <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/60 space-y-4 shadow-lg">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{isB2B ? 'Buyer / Billed-To Business Particulars' : 'Customer / Billed-To Particulars'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCustomerPickerOpen(true)}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Search and select from customer directory"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Pick Customer</span>
                      </button>
                      <span className="text-xs font-sans font-semibold text-slate-400">
                        {isB2B ? 'B2B Registered Entity' : 'B2C Retail Buyer'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-3.5">
                    {/* Name */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        {isB2B ? 'Buyer Business / Entity Name *' : 'Customer Name *'}
                      </label>
                      <input
                        type="text"
                        value={invoice.customer.name}
                        onChange={(e) => updateField('customer.name', e.target.value)}
                        placeholder={isB2B ? 'e.g. Urjaamithra Enterprises / Rajesh K.' : 'e.g. Rajesh K.'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Phone */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <label className="text-xs font-medium text-slate-300">
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Billing Address */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <label className="text-xs font-medium text-slate-300">Billing Street / Area Address</label>
                      <input
                        type="text"
                        value={invoice.customer.address}
                        onChange={(e) => updateField('customer.address', e.target.value)}
                        placeholder="Building / House / Street Name"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Shipping Address */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <label className="text-xs font-medium text-slate-300">Shipping / Delivery Address (Optional)</label>
                      <input
                        type="text"
                        value={invoice.customer.shippingAddress || ''}
                        onChange={(e) => updateField('customer.shippingAddress', e.target.value)}
                        placeholder="Leave blank if identical to billing address"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* City, District, PIN, State Code */}
                    <div className="col-span-6 sm:col-span-3 space-y-1">
                      <label className="text-xs font-medium text-slate-300">City / Town</label>
                      <input
                        type="text"
                        value={invoice.customer.city}
                        onChange={(e) => updateField('customer.city', e.target.value)}
                        placeholder="Thrithala"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="col-span-6 sm:col-span-3 space-y-1">
                      <label className="text-xs font-medium text-slate-300">District</label>
                      <input
                        type="text"
                        value={invoice.customer.district}
                        onChange={(e) => updateField('customer.district', e.target.value)}
                        placeholder="Palakkad"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="col-span-6 sm:col-span-3 space-y-1">
                      <label className="text-xs font-medium text-slate-300">PIN Code</label>
                      <input
                        type="text"
                        value={invoice.customer.pincode}
                        onChange={(e) =>
                          updateField('customer.pincode', e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="679552"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="col-span-6 sm:col-span-3 space-y-1">
                      <label className="text-xs font-medium text-slate-300">State Code</label>
                      <input
                        type="text"
                        value={invoice.customer.stateCode}
                        onChange={(e) => updateField('customer.stateCode', e.target.value)}
                        placeholder="32"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* GSTIN & PAN */}
                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-medium text-slate-300">
                          {isB2B ? 'Buyer GSTIN (Required for ITC) *' : 'Customer GSTIN (If Registered)'}
                        </label>
                        {gstinVal && (
                          <span className={`text-[10px] font-medium ${isGstinFormatValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isGstinFormatValid ? '✓ Valid 15-char format' : '⚠ Check format'}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={invoice.customer.gstin || ''}
                        onChange={(e) => updateField('customer.gstin', e.target.value.toUpperCase())}
                        placeholder="e.g. 32AABCU9603R1ZM"
                        className={`w-full bg-slate-900 border rounded-lg px-3.5 py-2 text-xs sm:text-sm font-mono uppercase focus:outline-none ${
                          isB2B && !gstinVal
                            ? 'border-amber-500/50 text-white placeholder-amber-400/40'
                            : 'border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
                        }`}
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-6 space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        Customer PAN No (Optional)
                      </label>
                      <input
                        type="text"
                        value={invoice.customer.pan || ''}
                        onChange={(e) => updateField('customer.pan', e.target.value.toUpperCase())}
                        placeholder="e.g. ABCDE1234F"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-mono text-white uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Panel 4: Terms & Conditions / Invoice Notes */}
            <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/60 space-y-2.5 shadow-lg">
              <label className="text-xs font-medium text-slate-300">Invoice Terms & Notes</label>
              <textarea
                rows={3}
                value={invoice.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Goods once sold will not be taken back without original bill."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}

        {/* TAB 3: SCRAP EXCHANGE & ADJUSTMENTS */}
        {activeTab === 'adjustments' && (
          <div className="space-y-6">
            {/* Panel 1: Scrap Buyback Section (Battery Exclusive) */}
            <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/60 space-y-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Old Battery Scrap Buyback / Exchange</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 lowercase">
                        battery exclusive
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
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
                  <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Eligibility Hint */}
              <div className="text-xs p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-slate-300">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {hasBatteryItem
                    ? 'Eligible: Current bill includes battery products suitable for exchange deduction.'
                    : 'Note: Scrap buyback is battery-specific and disabled for non-battery items, but can be enabled if the customer trades in an old battery.'}
                </span>
              </div>

              {invoice.scrapExchange?.enabled && (
                <div className="pt-3 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Scrap Description / Model
                    </label>
                    <input
                      type="text"
                      value={invoice.scrapExchange.description}
                      onChange={(e) => updateField('scrapExchange.description', e.target.value)}
                      placeholder="e.g. Old 150Ah Scrap Battery Buyback"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Scrap Deduction Amount (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={invoice.scrapExchange.amount ?? ''}
                      onChange={(e) => updateField('scrapExchange.amount', e.target.value)}
                      placeholder="2000"
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3.5 py-2 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                    />
                    <div className="text-[11px] text-slate-400">
                      Standard scrap rates: 150Ah Tubular ~₹2,000 to ₹2,500; Car 35-45Ah ~₹500 to ₹900.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Panel 2: Additional Discounts & Manual Round-off */}
            <div className="bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-700/60 space-y-4 shadow-lg">
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                <span>Additional Invoice-Level Discounts & Rounding</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Special Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={invoice.additionalDiscount ?? ''}
                    onChange={(e) => updateField('additionalDiscount', e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-slate-300">Manual Round-off Adjustment</label>
                    <button
                      type="button"
                      onClick={() => updateField('roundOffManual', null)}
                      className="text-xs text-amber-400 hover:underline"
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Panel 3: Live Financial Summary Breakdown Card */}
            <div className="bg-slate-800/70 p-4 sm:p-5 rounded-2xl border border-slate-700/70 space-y-3.5 shadow-lg">
              <h3 className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <span>Comprehensive Financial Computation Summary</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Total Items</div>
                  <div className="text-base font-bold text-white mt-1">{invoice.items.length}</div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Gross Subtotal</div>
                  <div className="text-base font-bold text-slate-200 mt-1">₹{formatNumber(totals.totalGross)}</div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Taxable Value</div>
                  <div className="text-base font-bold text-slate-200 mt-1">₹{formatNumber(totals.totalTaxableValue)}</div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Total GST Amount</div>
                  <div className="text-base font-bold text-slate-200 mt-1">₹{formatNumber(totals.totalTax)}</div>
                </div>

                {totals.scrapDiscount > 0 && (
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-amber-400">
                    <div className="text-slate-400 text-[11px]">Scrap Trade-in</div>
                    <div className="text-base font-bold mt-1">-₹{formatNumber(totals.scrapDiscount)}</div>
                  </div>
                )}

                {totals.extraDiscount > 0 && (
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-amber-400">
                    <div className="text-slate-400 text-[11px]">Special Discount</div>
                    <div className="text-base font-bold mt-1">-₹{formatNumber(totals.extraDiscount)}</div>
                  </div>
                )}

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Round-Off Adjustment</div>
                  <div className="text-base font-bold text-slate-200 mt-1">
                    {totals.roundOff >= 0 ? `+₹${formatNumber(totals.roundOff)}` : `-₹${formatNumber(Math.abs(totals.roundOff))}`}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400 col-span-2 sm:col-span-1">
                  <div className="text-amber-300 text-[11px] font-bold">Net Bill Payable</div>
                  <div className="text-lg font-bold mt-1">₹{formatNumber(totals.netPayable)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action & Total Bar */}
      <div className="sticky bottom-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 sm:px-6 rounded-b-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-mono">
          <span className="text-slate-400">
            Items: <strong className="text-white">{invoice.items.length}</strong>
          </span>
          <span className="text-slate-400 hidden sm:inline">
            Taxable: <strong className="text-slate-200">₹{formatNumber(totals.totalTaxableValue)}</strong>
          </span>
          <span className="text-slate-400 hidden sm:inline">
            GST: <strong className="text-slate-200">₹{formatNumber(totals.totalTax)}</strong>
          </span>
          <span className="text-xs sm:text-sm font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/30">
            Bill Amount: ₹{formatNumber(totals.netPayable)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              title="Print A4 bill"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Print</span>
            </button>
          )}

          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isPdfGenerating}
              className="px-3 sm:px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
              title="Download A4 PDF"
            >
              {isPdfGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </>
              )}
            </button>
          )}

          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg flex items-center gap-1.5 transition-all shadow-md"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Invoice</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
              isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
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

      {/* Catalog Item Picker Modal */}
      <CatalogItemPickerModal
        isOpen={isCatalogPickerOpen}
        onClose={() => setIsCatalogPickerOpen(false)}
        catalog={catalog}
        onSelectItem={handlePickFromCatalog}
      />

      {/* Customer Picker Modal */}
      <CustomerPickerModal
        isOpen={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        customers={customers}
        onSelectCustomer={handleSelectCustomer}
      />
    </div>
  );
}
