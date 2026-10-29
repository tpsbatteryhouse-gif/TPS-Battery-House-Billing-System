import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Receipt,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { INVOICE_STATUSES } from '../data/mockData';
import { formatINR } from '../utils/numberToWords';
import { generateId, getIsoTimestamp } from '../utils/idGenerator';

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
    paymentStatus: INVOICE_STATUSES.DRAFT, // Defaulting to Draft per requirements
    paymentMode: 'Cash',
    items: [
      {
        id: 'item-1',
        description: 'Fuze 1100 Inverter + 150 Ah Tubular Battery (Combo Set)',
        qty: 1,
        unitPrice: 22000,
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
  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: generateId('item'),
          description: '',
          qty: 1,
          unitPrice: 0,
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
        hsn: '8507',
        serialNo: '',
        warranty: '36 Months',
        qty: Number(it.qty) || 1,
        unit: 'Nos',
        rate: Number(it.unitPrice) || 0,
        isTaxInclusive: true,
        gstRate: 28,
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
              <h2 className="text-base font-bold text-white">Create New Invoice</h2>
              <p className="text-xs text-slate-400">Quick frontend invoice creation</p>
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

          {/* Client & Meta Grid */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Invoice Number (Auto)</label>
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Payment Status *</label>
                <select
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={INVOICE_STATUSES.DRAFT}>Draft (Default)</option>
                  <option value={INVOICE_STATUSES.PENDING}>Pending</option>
                  <option value={INVOICE_STATUSES.PAID}>Paid</option>
                  <option value={INVOICE_STATUSES.OVERDUE}>Overdue</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Client / Customer Name *</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="e.g. Suresh Kumar"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Contact Phone (Optional)</label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="9846830532"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Invoice Date *</label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Due Date *</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Payment Mode</label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI / QR Code">UPI / QR Code</option>
                  <option value="Bank Transfer (NEFT/RTGS/IMPS)">Bank Transfer</option>
                  <option value="Credit / Post-dated">Credit</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                Line Items ({formData.items.length})
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {formData.items.map((item, idx) => {
                const lineTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                return (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Item #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs">
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
                        placeholder="Product description (e.g. Inverter Battery 150Ah)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-medium">Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qty}
                          onChange={(e) => updateItem(idx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-center focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-medium">Unit Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white text-right focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subtotal & Total Preview */}
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400 font-sans font-medium">Calculated Total Payable:</span>
              <span className="font-extrabold text-amber-400 text-sm">{formatINR(finalTotal)}</span>
            </div>
          </div>

          {/* Local Persistence Notice */}
          <div className="text-[11px] text-slate-500 italic px-1">
            * Invoices created here are saved locally in this browser. To include HSN codes, Kerala CGST/SGST breakdowns, scrap exchange buyback, or to generate printable A4 tax invoices, use the full Tax Bill Generator.
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenInFullGenerator) onOpenInFullGenerator();
            }}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open in Full GST Tax Bill Studio</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-amber-500/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
