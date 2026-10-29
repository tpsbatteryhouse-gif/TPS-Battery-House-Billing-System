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
} from 'lucide-react';
import {
  ITEM_PRESETS,
  PAYMENT_MODES,
  UNITS_LIST,
  GST_RATES,
} from '../utils/defaults';
import { formatNumber } from '../utils/numberToWords';
import { calculateLineItem } from '../utils/gstCalculations';
import { generateId } from '../utils/idGenerator';

export default function InvoiceForm({
  invoice,
  setInvoice,
  onSave,
  onReset,
  onLoadSample,
  isSaved,
}) {
  const [activeTab, setActiveTab] = useState('items'); // 'general', 'items', 'adjustments'

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

  const addItem = (preset = null) => {
    const newItem = preset
      ? {
          id: generateId('item'),
          name: preset.name,
          hsn: preset.hsn,
          serialNo: '',
          warranty: preset.warranty,
          qty: 1,
          unit: preset.unit,
          rate: preset.price,
          isTaxInclusive: preset.isTaxInclusive,
          gstRate: preset.gstRate,
        }
      : {
          id: generateId('item'),
          name: '',
          hsn: '8507',
          serialNo: '',
          warranty: '36 Months',
          qty: 1,
          unit: 'Nos',
          rate: 0,
          isTaxInclusive: true,
          gstRate: 28,
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
            <p className="text-xs text-slate-400">Fill particulars or choose quick presets</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            title="Load the Fuze 1100 Combo & Rajesh K. sample bill"
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
          <span>Scrap Exchange & Discounts</span>
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
            {/* Presets Quick Picker */}
            <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Quick Item Catalogue (Click to Add):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ITEM_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addItem(preset)}
                    className="text-[11px] bg-slate-900/90 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 text-slate-300 border border-slate-700 px-2 py-1 rounded transition-colors text-left flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span className="truncate max-w-[200px]">{preset.name}</span>
                    <span className="text-[10px] text-amber-400/80 font-mono">₹{preset.price.toLocaleString('en-IN')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Items Cards/Table */}
            <div className="space-y-3">
              {invoice.items.map((item, idx) => {
                const previewCalcs = calculateLineItem(item);
                return (
                  <div
                    key={item.id || idx}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 space-y-3 relative group hover:border-slate-600 transition-all shadow-md"
                  >
                    {/* Item Row Header */}
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-700 text-amber-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          Item #{idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
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

                    {/* Item Name & Suggestions */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">
                        Item Description / Product Name *
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        placeholder="e.g. Fuze 1100 Inverter and Battery 150 Ah"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* HSN Code & Warranty & Serial No */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-medium text-slate-400">HSN Code</label>
                          <div className="text-[10px] space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                updateItem(idx, 'hsn', '8507');
                                updateItem(idx, 'gstRate', 28);
                              }}
                              className="text-amber-400/80 hover:text-amber-300 underline"
                            >
                              8507 (Battery)
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() => {
                                updateItem(idx, 'hsn', '8504');
                                updateItem(idx, 'gstRate', 18);
                              }}
                              className="text-amber-400/80 hover:text-amber-300 underline"
                            >
                              8504 (Inverter)
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => updateItem(idx, 'hsn', e.target.value)}
                          placeholder="8507"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Warranty Period</label>
                        <input
                          type="text"
                          value={item.warranty}
                          onChange={(e) => updateItem(idx, 'warranty', e.target.value)}
                          placeholder="e.g. 36 Months Replacement"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Serial No / Batch</label>
                        <input
                          type="text"
                          value={item.serialNo}
                          onChange={(e) => updateItem(idx, 'serialNo', e.target.value)}
                          placeholder="e.g. FZ-1100-8891 / BAT-150"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Qty, Unit, Rate, Tax Inclusive Toggle, GST Rate */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qty}
                          onChange={(e) => updateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white text-center focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          {UNITS_LIST.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-medium text-slate-400">Rate (₹)</label>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateItem(idx, 'rate', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white text-right focus:outline-none focus:border-amber-500"
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
                          {item.isTaxInclusive ? 'Incl. GST (MRP)' : 'Excl. GST + Tax'}
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
                              {r}% GST {r === 28 ? '(Batteries)' : r === 18 ? '(Inverters)' : ''}
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

            {/* Add New Item Button */}
            <button
              type="button"
              onClick={() => addItem()}
              className="w-full py-2.5 border-2 border-dashed border-slate-700 hover:border-amber-500 text-slate-300 hover:text-amber-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all bg-slate-800/20 hover:bg-amber-500/5"
            >
              <Plus className="w-4 h-4" />
              Add Another Line Item
            </button>
          </div>
        )}

        {/* TAB 2: GENERAL & CUSTOMER DETAILS */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Invoice Meta Section */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                Invoice Metadata
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Invoice Number</label>
                  <input
                    type="text"
                    value={invoice.invoiceNumber}
                    onChange={(e) => updateField('invoiceNumber', e.target.value)}
                    placeholder="TPS/2026-27/001"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Invoice Date</label>
                  <input
                    type="date"
                    value={invoice.invoiceDate}
                    onChange={(e) => updateField('invoiceDate', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Payment Mode</label>
                  <select
                    value={invoice.paymentMode}
                    onChange={(e) => updateField('paymentMode', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {PAYMENT_MODES.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
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
                    value={invoice.placeOfSupply}
                    onChange={(e) => updateField('placeOfSupply', e.target.value)}
                    placeholder="Kerala (32)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Reverse Charge Applicable</label>
                  <select
                    value={invoice.reverseCharge}
                    onChange={(e) => updateField('reverseCharge', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="No">No (Standard)</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Section */}
            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Customer / Billed To Particulars
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Customer Name *</label>
                  <input
                    type="text"
                    value={invoice.customer.name}
                    onChange={(e) => updateField('customer.name', e.target.value)}
                    placeholder="e.g. Rajesh K."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Customer Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1.5 text-xs text-slate-500">+91</span>
                    <input
                      type="tel"
                      value={invoice.customer.phone}
                      onChange={(e) => updateField('customer.phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Street / Area Address</label>
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
                    onChange={(e) => updateField('customer.pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="679534"
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

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Customer GSTIN (Optional — Leave blank for B2C Consumer)
                </label>
                <input
                  type="text"
                  value={invoice.customer.gstin}
                  onChange={(e) => updateField('customer.gstin', e.target.value.toUpperCase())}
                  placeholder="32AAAAA0000A1Z5"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white uppercase focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ADJUSTMENTS & SCRAP EXCHANGE */}
        {activeTab === 'adjustments' && (
          <div className="space-y-4">
            {/* Scrap Battery Exchange Box */}
            <div className="bg-slate-800/60 p-4 rounded-xl border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Old Battery Scrap Buyback / Exchange
                    </h3>
                    <p className="text-[11px] text-slate-400">Deduct scrap battery exchange value from bill</p>
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
                      value={invoice.scrapExchange.amount}
                      onChange={(e) => updateField('scrapExchange.amount', Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="2000"
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                    />
                    <div className="text-[10px] text-slate-400">
                      Common scrap rates: 150Ah Tubular ~₹2,000 to ₹2,500; Car 35-45Ah ~₹500 to ₹900.
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
                    value={invoice.additionalDiscount}
                    onChange={(e) => updateField('additionalDiscount', Math.max(0, parseFloat(e.target.value) || 0))}
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
                    value={invoice.roundOffManual === null ? '' : invoice.roundOffManual}
                    onChange={(e) =>
                      updateField(
                        'roundOffManual',
                        e.target.value === '' ? null : parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="Auto rounded"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-medium text-slate-400">Invoice Note / Customer Remark</label>
                <textarea
                  rows="2"
                  value={invoice.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Special instructions or service helpline note"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
