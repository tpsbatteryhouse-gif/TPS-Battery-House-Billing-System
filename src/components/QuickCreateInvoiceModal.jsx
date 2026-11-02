import React, { useState } from 'react';
import {
  X,
  Trash2,
  Save,
  AlertCircle,
  Receipt,
  Sparkles,
  CheckCircle2,
  BatteryCharging,
  Zap,
  Sun,
  Wrench,
  Package,
} from 'lucide-react';
import { INVOICE_STATUSES } from '../data/mockData';
import { formatINR } from '../utils/numberToWords';
import { generateId, getIsoTimestamp } from '../utils/idGenerator';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
} from '../utils/categories';
import { ITEM_PRESETS } from '../utils/defaults';

function getInitialFormState(nextInvoiceNumber) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nextWeekStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    invoiceNumber: nextInvoiceNumber || 'TPS/2026-27/001',
    customerName: '',
    customerPhone: '',
    invoiceDate: todayStr,
    dueDate: nextWeekStr,
    paymentStatus: INVOICE_STATUSES.DRAFT,
    paymentMode: 'Cash',
    items: [
      {
        id: 'item-1',
        category: PRODUCT_CATEGORIES.BATTERY,
        description: 'Exide InvaTubular IT500 150Ah Battery',
        hsn: '8507',
        gstRate: 28,
        qty: 1,
        unit: 'Nos',
        unitPrice: 15500,
        warranty: '36 Months',
      },
    ],
    notes: 'Thank you for choosing TPS BATTERYS HOUSE.',
  };
}

export default function QuickCreateInvoiceModal({
  isOpen,
  onClose,
  onSaveInvoice,
  onOpenInFullGenerator,
  nextInvoiceNumber,
}) {
  const [formData, setFormData] = useState(() => getInitialFormState(nextInvoiceNumber));
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // Add line item
  const addItem = (category = PRODUCT_CATEGORIES.BATTERY) => {
    const catCfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: generateId('item'),
          category,
          description: '',
          hsn: catCfg.defaultHsn,
          gstRate: catCfg.defaultGstRate,
          qty: 1,
          unit: catCfg.defaultUnit,
          unitPrice: 0,
          warranty: category === PRODUCT_CATEGORIES.SERVICES ? 'Service Warranty' : '36 Months',
        },
      ],
    }));
  };

  // Add preset
  const addPreset = (preset) => {
    const cat = preset.category || PRODUCT_CATEGORIES.BATTERY;
    const catCfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: generateId('item'),
          category: cat,
          description: preset.name,
          hsn: preset.hsn || catCfg.defaultHsn,
          gstRate: preset.gstRate || catCfg.defaultGstRate,
          qty: 1,
          unit: preset.unit || catCfg.defaultUnit,
          unitPrice: preset.price || 0,
          warranty: preset.warranty || '36 Months',
        },
      ],
    }));
  };

  // Remove line item
  const removeItem = (idx) => {
    if (formData.items.length <= 1) {
      setValidationError('At least one line item is required.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  // Update line item
  const updateItem = (idx, field, value) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  // Change category of line item
  const changeItemCategory = (idx, newCategory) => {
    const catCfg = CATEGORY_CONFIG[newCategory] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
    setFormData((prev) => {
      const items = [...prev.items];
      items[idx] = {
        ...items[idx],
        category: newCategory,
        hsn: catCfg.defaultHsn,
        gstRate: catCfg.defaultGstRate,
        unit: catCfg.defaultUnit,
      };
      return { ...prev, items };
    });
  };

  // Calculate totals
  const subtotal = formData.items.reduce((sum, item) => {
    const qty = Math.max(0, Number(item.qty) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return sum + qty * price;
  }, 0);

  const finalTotal = subtotal;

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    // Validations
    if (!formData.customerName.trim()) {
      setValidationError('Please enter the client / customer name.');
      return;
    }
    if (!formData.invoiceDate || isNaN(new Date(formData.invoiceDate).getTime())) {
      setValidationError('Please select a valid invoice date.');
      return;
    }
    if (!formData.dueDate || isNaN(new Date(formData.dueDate).getTime())) {
      setValidationError('Please select a valid due date.');
      return;
    }
    if (new Date(formData.dueDate) < new Date(formData.invoiceDate)) {
      setValidationError('Due date cannot be earlier than invoice date.');
      return;
    }
    if (formData.items.some((it) => !it.description.trim())) {
      setValidationError('Please fill in descriptions for all line items.');
      return;
    }
    if (formData.items.some((it) => (Number(it.qty) || 0) <= 0)) {
      setValidationError('Item quantities must be greater than zero.');
      return;
    }
    if (formData.items.some((it) => (Number(it.unitPrice) || 0) < 0)) {
      setValidationError('Unit prices cannot be negative.');
      return;
    }

    // Build invoice record matching project structure
    const newInvoice = {
      id: generateId('inv'),
      invoiceNumber: formData.invoiceNumber || nextInvoiceNumber,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      paymentMode: formData.paymentMode,
      paymentStatus: formData.paymentStatus,
      placeOfSupply: 'Kerala (32)',
      reverseCharge: 'No',
      customer: {
        name: formData.customerName.trim(),
        phone: formData.customerPhone.trim(),
        address: 'Padinarangadi, Koottanad',
        city: 'Thrithala',
        district: 'Palakkad',
        state: 'Kerala',
        stateCode: '32',
        pincode: '679552',
        gstin: '',
      },
      items: formData.items.map((it, idx) => ({
        id: it.id || `item-${idx + 1}`,
        name: it.description,
        category: it.category || PRODUCT_CATEGORIES.BATTERY,
        specs: {},
        hsn: it.hsn || (CATEGORY_CONFIG[it.category]?.defaultHsn || '8507'),
        serialNo: '',
        warranty: it.warranty || '36 Months',
        qty: Number(it.qty) || 1,
        unit: it.unit || 'Nos',
        rate: Number(it.unitPrice) || 0,
        isTaxInclusive: true,
        gstRate: Number(it.gstRate) || (CATEGORY_CONFIG[it.category]?.defaultGstRate || 28),
      })),
      scrapExchange: {
        enabled: false,
        description: '',
        amount: 0,
      },
      additionalDiscount: 0,
      roundOffManual: null,
      netPayable: finalTotal,
      notes: formData.notes,
      createdAt: getIsoTimestamp(),
    };

    setSuccessMessage('Invoice successfully created!');
    setTimeout(() => {
      onSaveInvoice(newInvoice);
      onClose();
    }, 600);
  };

  const getCatIcon = (cat, className = 'w-3 h-3') => {
    switch (cat) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Quick Create Multi-Category Invoice</h2>
              <p className="text-xs text-slate-400">Battery • Inverter • Solar • Services</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Feedback messages */}
          {validationError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{validationError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Customer & Invoice Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-slate-400 font-medium">Customer / Client Name *</label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="e.g. Rajesh K. or Koottanad Agro"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Invoice Number</label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Dates & Payment Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Invoice Date</label>
              <input
                type="date"
                required
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Due Date</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Payment Status</label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-medium focus:outline-none focus:border-amber-500"
              >
                <option value={INVOICE_STATUSES.DRAFT}>Draft</option>
                <option value={INVOICE_STATUSES.PENDING}>Pending</option>
                <option value={INVOICE_STATUSES.PAID}>Paid</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-medium">Payment Mode</label>
              <select
                value={formData.paymentMode}
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="Cash">Cash</option>
                <option value="UPI / QR Code">UPI / QR</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
          </div>

          {/* Quick Preset Chips */}
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Quick Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ITEM_PRESETS.slice(0, 5).map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => addPreset(p)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-[10px] flex items-center gap-1 transition-colors"
                >
                  <span>+</span>
                  <span className="truncate max-w-[140px]">{p.name}</span>
                  <span className="text-amber-400/80 font-mono">₹{p.price}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                Line Items ({formData.items.length})
              </h3>
              <div className="flex items-center gap-1">
                {Object.values(CATEGORY_CONFIG).map((cfg) => (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => addItem(cfg.id)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md text-[10px] font-semibold flex items-center gap-1"
                  >
                    {getCatIcon(cfg.id, 'w-3 h-3')}
                    <span>{cfg.shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {formData.items.map((item, idx) => {
                const lineTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                const currentCat = item.category || PRODUCT_CATEGORIES.BATTERY;
                const catCfg = CATEGORY_CONFIG[currentCat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];

                return (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          #{idx + 1}
                        </span>
                        <select
                          value={currentCat}
                          onChange={(e) => changeItemCategory(idx, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] font-semibold text-amber-400"
                        >
                          {Object.values(CATEGORY_CONFIG).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs">
                          {formatINR(lineTotal)}
                        </span>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder={`Description for ${catCfg.label} (e.g. ${
                          currentCat === PRODUCT_CATEGORIES.BATTERY
                            ? '150Ah Tubular Battery'
                            : currentCat === PRODUCT_CATEGORIES.INVERTER
                            ? '1100VA Sine Wave Inverter'
                            : currentCat === PRODUCT_CATEGORIES.SOLAR
                            ? '550W Mono PERC Solar Panel'
                            : 'Installation & Cabling Service'
                        })`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] text-slate-400">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] text-slate-400">Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(idx, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-right"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] text-slate-400">HSN</label>
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => updateItem(idx, 'hsn', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[10px] text-slate-400">GST %</label>
                        <select
                          value={item.gstRate}
                          onChange={(e) => updateItem(idx, 'gstRate', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-1 py-1 text-xs text-white font-mono"
                        >
                          <option value={28}>28%</option>
                          <option value={18}>18%</option>
                          <option value={12}>12%</option>
                          <option value={5}>5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand Total Preview */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Net Estimated Total:</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {formatINR(finalTotal)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2.5">
            {onOpenInFullGenerator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInFullGenerator();
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
              >
                Open in Full Tax Bill Studio →
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>Save Invoice</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
