import React, { useState, useEffect } from 'react';
import {
  BatteryCharging,
  Printer,
  Download,
  Share2,
  History,
  Settings,
  Sparkles,
  PlusCircle,
  Eye,
  Edit3,
  Columns,
  CheckCircle,
  Loader2,
  FileCheck,
} from 'lucide-react';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import InvoiceHistoryModal from './components/InvoiceHistoryModal';
import BusinessSettingsModal from './components/BusinessSettingsModal';
import { DEFAULT_BUSINESS, getSampleInvoiceData } from './utils/defaults';
import { downloadInvoicePdf } from './utils/pdfExport';
import { calculateInvoiceTotals } from './utils/gstCalculations';
import { formatINR } from './utils/numberToWords';

export default function App() {
  // Business Profile
  const [business, setBusiness] = useState(() => {
    try {
      const saved = localStorage.getItem('tps_business_profile');
      return saved ? JSON.parse(saved) : DEFAULT_BUSINESS;
    } catch {
      return DEFAULT_BUSINESS;
    }
  });

  // Current Invoice State
  const [invoice, setInvoice] = useState(() => {
    try {
      const draft = localStorage.getItem('tps_invoice_draft');
      return draft ? JSON.parse(draft) : getSampleInvoiceData();
    } catch {
      return getSampleInvoiceData();
    }
  });

  // History State
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('tps_invoice_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // View state
  const [mobileView, setMobileView] = useState('both'); // 'form', 'preview', 'both'
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [invoiceCopy, setInvoiceCopy] = useState('Original for Recipient');

  // Auto-save draft on changes
  useEffect(() => {
    try {
      localStorage.setItem('tps_invoice_draft', JSON.stringify(invoice));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  }, [invoice]);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tps_invoice_history', JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }, [history]);

  // Calculate live totals for navbar summary
  const totals = calculateInvoiceTotals(invoice, business.stateCode || '32');

  // Save current bill to history
  const handleSaveInvoice = () => {
    const invoiceToSave = {
      ...invoice,
      id: invoice.id || 'inv-' + Date.now(),
      netPayable: totals.netPayable,
      savedAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.invoiceNumber === invoiceToSave.invoiceNumber
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = invoiceToSave;
        return updated;
      }
      return [invoiceToSave, ...prev];
    });

    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2500);
  };

  // Create fresh invoice with incremented invoice number
  const handleNewInvoice = () => {
    const currentNum = history.length + 1;
    const formattedNum = String(currentNum).padStart(3, '0');
    const newInvNo = `${business.invoicePrefix || 'TPS/2026-27/'}${formattedNum}`;
    const today = new Date().toISOString().split('T')[0];

    setInvoice({
      id: 'inv-' + Date.now(),
      invoiceNumber: newInvNo,
      invoiceDate: today,
      dueDate: today,
      paymentMode: 'Cash',
      paymentStatus: 'Paid',
      placeOfSupply: 'Kerala (32)',
      reverseCharge: 'No',
      customer: {
        name: '',
        phone: '',
        address: '',
        city: 'Thrithala',
        district: 'Palakkad',
        state: 'Kerala',
        stateCode: '32',
        pincode: '679534',
        gstin: '',
      },
      items: [
        {
          id: 'item-1',
          name: '',
          hsn: '8507',
          serialNo: '',
          warranty: '36 Months',
          qty: 1,
          unit: 'Nos',
          rate: 0,
          isTaxInclusive: true,
          gstRate: 28,
        },
      ],
      scrapExchange: {
        enabled: false,
        description: 'Old Battery Scrap Buyback',
        amount: 0,
      },
      additionalDiscount: 0,
      roundOffManual: null,
      notes: 'Thank you for choosing TPS BATTERYS HOUSE.',
    });
  };

  // Reset to sample invoice
  const handleLoadSample = () => {
    setInvoice(getSampleInvoiceData());
  };

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  // PDF Download via jspdf + html2canvas
  const handleDownloadPdf = async () => {
    setIsPdfGenerating(true);
    try {
      await downloadInvoicePdf(
        'invoice-printable',
        invoice.invoiceNumber,
        invoice.customer?.name
      );
    } catch (err) {
      alert('Could not generate PDF. Please try Print Bill -> Save as PDF.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // WhatsApp share bill summary
  const handleShareWhatsApp = () => {
    const phone = (invoice.customer?.phone || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;

    const itemsSummary = invoice.items
      .map((it) => `• ${it.name} (Qty: ${it.qty})`)
      .join('\n');

    let text = `*TPS BATTERYS HOUSE - TAX INVOICE*\n`;
    text += `Invoice No: ${invoice.invoiceNumber}\n`;
    text += `Date: ${invoice.invoiceDate}\n`;
    text += `Customer: ${invoice.customer?.name || 'Customer'}\n\n`;
    text += `*Items:*\n${itemsSummary}\n\n`;
    if (invoice.scrapExchange?.enabled && invoice.scrapExchange?.amount > 0) {
      text += `*Old Battery Scrap Buyback:* -₹${invoice.scrapExchange.amount}\n`;
    }
    text += `*Net Payable Amount:* ${formatINR(totals.netPayable)}\n`;
    text += `Payment Mode: ${invoice.paymentMode}\n\n`;
    text += `GSTIN: ${business.gstin}\n`;
    text += `Padinarangadi, Koottanad Road, Thrithala, Palakkad\n`;
    text += `Contact: ${business.phone}\n`;
    text += `Thank you for your business!`;

    const encoded = encodeURIComponent(text);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  };

  // Load from history
  const handleSelectFromHistory = (item) => {
    setInvoice(item);
    setIsHistoryOpen(false);
  };

  // Delete invoice from history
  const handleDeleteFromHistory = (id) => {
    if (confirm('Delete this invoice from your records?')) {
      setHistory((prev) => prev.filter((i) => (i.id || i.invoiceNumber) !== id));
    }
  };

  // Clear all history
  const handleClearHistory = () => {
    if (confirm('Are you sure you want to delete all saved invoices?')) {
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md no-print">
        <div className="max-w-[1700px] mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Left */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <BatteryCharging className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white uppercase">
                  {business.businessName}
                </span>
                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/30 hidden md:inline-block">
                  GSTIN: {business.gstin}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Padinarangadi, Thrithala, Palakkad • GST Billing & Tax Invoice System
              </p>
            </div>
          </div>

          {/* Center Summary Pill */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Invoice:</span>
              <span className="font-mono font-bold text-white">{invoice.invoiceNumber}</span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Net Payable:</span>
              <span className="font-mono font-extrabold text-amber-400 text-sm">
                {formatINR(totals.netPayable)}
              </span>
            </div>
          </div>

          {/* Action Buttons Right */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View switcher for smaller screens */}
            <div className="flex xl:hidden bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setMobileView('form')}
                className={`p-1.5 rounded flex items-center gap-1 ${
                  mobileView === 'form' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
                title="Edit Details"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden md:inline">Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView('preview')}
                className={`p-1.5 rounded flex items-center gap-1 ${
                  mobileView === 'preview' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
                title="View Invoice"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden md:inline">Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView('both')}
                className={`p-1.5 rounded hidden md:flex items-center gap-1 ${
                  mobileView === 'both' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
                title="Split Screen"
              >
                <Columns className="w-4 h-4" />
                <span>Split</span>
              </button>
            </div>

            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-2.5 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Share invoice summary on WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              title="Print bill immediately"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Print Bill</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10 active:scale-95 disabled:opacity-50"
              title="Generate and download A4 PDF document"
            >
              {isPdfGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* History Toggle */}
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors relative"
              title="Invoice history & records"
            >
              <History className="w-4 h-4" />
              {history.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center">
                  {history.length}
                </span>
              )}
            </button>

            {/* Settings Toggle */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              title="Business profile and Bank settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace: Split Panel */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-5">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left Side: Input Form */}
          <div
            className={`xl:col-span-5 2xl:col-span-5 h-[calc(100vh-6.5rem)] no-print ${
              mobileView === 'preview' ? 'hidden xl:block' : 'block'
            }`}
          >
            <InvoiceForm
              invoice={invoice}
              setInvoice={setInvoice}
              onSave={handleSaveInvoice}
              onReset={handleNewInvoice}
              onLoadSample={handleLoadSample}
              isSaved={isSavedFeedback}
            />
          </div>

          {/* Right Side: Live A4 Invoice Preview */}
          <div
            className={`xl:col-span-7 2xl:col-span-7 flex flex-col items-center ${
              mobileView === 'form' ? 'hidden xl:flex' : 'flex'
            }`}
          >
            {/* Live Preview Controls Banner */}
            <div className="w-full max-w-[800px] mb-3 flex items-center justify-between bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl text-xs text-slate-300 no-print">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold text-white">Live A4 Invoice Preview</span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-slate-400 hidden sm:inline">Statutory GST Layout</span>
              </div>

              {/* Copy Designation Picker */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 hidden md:inline">Designation:</span>
                <select
                  value={invoiceCopy}
                  onChange={(e) => setInvoiceCopy(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-medium focus:outline-none"
                >
                  <option value="Original for Recipient">Original for Recipient</option>
                  <option value="Duplicate for Transporter / Supplier">Duplicate for Supplier</option>
                  <option value="Triplicate for Records">Triplicate for Records</option>
                </select>
              </div>
            </div>

            {/* The Actual Invoice Component */}
            <div className="w-full flex justify-center overflow-x-auto p-1">
              <InvoicePreview
                invoice={invoice}
                business={business}
                invoiceCopy={invoiceCopy}
              />
            </div>
          </div>
        </div>
      </main>

      {/* History Modal */}
      <InvoiceHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectInvoice={handleSelectFromHistory}
        onDeleteInvoice={handleDeleteFromHistory}
        onClearHistory={handleClearHistory}
      />

      {/* Business Settings Modal */}
      <BusinessSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        business={business}
        setBusiness={setBusiness}
      />
    </div>
  );
}
