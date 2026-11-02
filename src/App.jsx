import React, { useState, useEffect } from 'react';
import {
  BatteryCharging,
  Printer,
  Download,
  Share2,
  Eye,
  Edit3,
  Columns,
  CheckCircle,
  Loader2,
  ArrowLeft,
  LogIn,
  Info,
} from 'lucide-react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AllInvoicesView from './components/AllInvoicesView';
import QuickCreateInvoiceModal from './components/QuickCreateInvoiceModal';
import UserProfileModal from './components/UserProfileModal';
import FloatingActionButton from './components/FloatingActionButton';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import InvoiceHistoryModal from './components/InvoiceHistoryModal';
import BusinessSettingsModal from './components/BusinessSettingsModal';
import { DEFAULT_BUSINESS, getSampleInvoiceData } from './utils/defaults';
import { INITIAL_MOCK_INVOICES, MOCK_USER } from './data/mockData';
import { downloadInvoicePdf } from './utils/pdfExport';
import { calculateInvoiceTotals } from './utils/gstCalculations';
import { formatINR } from './utils/numberToWords';

export default function App() {
  // Navigation View: 'dashboard' | 'invoices' | 'editor'
  const [activeView, setActiveView] = useState('dashboard');

  // Business Profile
  const [business, setBusiness] = useState(() => {
    try {
      const saved = localStorage.getItem('tps_business_profile');
      return saved ? JSON.parse(saved) : DEFAULT_BUSINESS;
    } catch {
      return DEFAULT_BUSINESS;
    }
  });

  // Complete Invoices Dataset (Mock & User Created)
  const [invoices, setInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem('tps_invoice_records');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return INITIAL_MOCK_INVOICES;
    } catch {
      return INITIAL_MOCK_INVOICES;
    }
  });

  // Current Active Invoice for Generator / Live Editor
  const [invoice, setInvoice] = useState(() => {
    try {
      const draft = localStorage.getItem('tps_invoice_draft');
      return draft ? JSON.parse(draft) : getSampleInvoiceData();
    } catch {
      return getSampleInvoiceData();
    }
  });

  // UI Modal & Control States
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Editor View specific controls
  const [mobileView, setMobileView] = useState('both'); // 'form', 'preview', 'both'
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [invoiceCopy, setInvoiceCopy] = useState('Original for Recipient');

  // Persist Invoices Dataset to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tps_invoice_records', JSON.stringify(invoices));
    } catch (e) {
      console.error('Failed to save invoices to storage:', e);
    }
  }, [invoices]);

  // Persist Current Draft
  useEffect(() => {
    try {
      localStorage.setItem('tps_invoice_draft', JSON.stringify(invoice));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  }, [invoice]);

  // Compute Next Sequential Invoice Number without collisions
  const getNextInvoiceNumber = () => {
    const prefix = business.invoicePrefix || 'TPS/2026-27/';
    let maxSeq = 0;

    invoices.forEach((inv) => {
      const invNum = inv.invoiceNumber || '';
      if (invNum.startsWith(prefix)) {
        const numPart = invNum.slice(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      } else {
        const match = invNum.match(/(\d+)$/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > maxSeq) {
            maxSeq = parsed;
          }
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const formatted = String(nextSeq).padStart(3, '0');
    return `${prefix}${formatted}`;
  };

  // Toast feedback helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Calculate totals for active invoice in editor
  const totals = calculateInvoiceTotals(invoice, business.stateCode || '32');

  // Handle Quick Create Save
  const handleSaveQuickInvoice = (newInvoice) => {
    setInvoices((prev) => [newInvoice, ...prev]);
    showToast(`Invoice ${newInvoice.invoiceNumber} created successfully!`);
  };

  // Handle Opening an Invoice from Dashboard / List into Full Generator
  const handleOpenInvoiceInEditor = (inv) => {
    setInvoice(inv);
    setActiveView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle New Invoice trigger (loads blank template into editor or opens modal)
  const handleStartNewInvoice = () => {
    const newInvNo = getNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];

    const freshInvoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: newInvNo,
      invoiceDate: today,
      dueDate: today,
      paymentMode: 'Cash',
      paymentStatus: 'Draft',
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
        pincode: '679552',
        gstin: '',
      },
      items: [
        {
          id: 'item-1',
          name: '',
          hsn: '8507',
          serialNo: '',
          warranty: '36 Months Replacement',
          qty: 1,
          unit: 'Nos',
          rate: 0,
          isTaxInclusive: true,
          gstRate: 28,
        },
      ],
      scrapExchange: {
        enabled: false,
        description: 'Old 150Ah Scrap Battery Buyback',
        amount: 0,
      },
      additionalDiscount: 0,
      roundOffManual: null,
      netPayable: 0,
      notes: 'Thank you for choosing TPS BATTERYS HOUSE.',
      createdAt: new Date().toISOString(),
    };

    setInvoice(freshInvoice);
    setIsQuickCreateOpen(true);
  };

  // Handle Saving bill from within the Full GST Billing Studio
  const handleSaveInvoiceInEditor = () => {
    const invoiceToSave = {
      ...invoice,
      id: invoice.id || 'inv-' + Date.now(),
      netPayable: totals.netPayable,
      savedAt: new Date().toISOString(),
    };

    // Update invoices array
    setInvoices((prev) => {
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
    showToast(`Invoice ${invoiceToSave.invoiceNumber} saved!`);
    setTimeout(() => setIsSavedFeedback(false), 2500);
  };

  // Delete Invoice from dataset
  const handleDeleteInvoice = (idOrNumber) => {
    if (confirm('Are you sure you want to delete this invoice record?')) {
      setInvoices((prev) =>
        prev.filter((i) => i.id !== idOrNumber && i.invoiceNumber !== idOrNumber)
      );
      showToast('Invoice deleted.');
    }
  };

  // Reset to sample test data (Rajesh K. Fuze combo)
  const handleLoadSample = () => {
    setInvoice(getSampleInvoiceData());
    showToast('Loaded sample Fuze 1100 Combo bill');
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    setIsPdfGenerating(true);
    try {
      await downloadInvoicePdf(
        'invoice-printable',
        invoice.invoiceNumber,
        invoice.customer?.name,
        { invoice, business, invoiceCopy }
      );
      showToast('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Could not generate PDF directly. Please use Print Bill -> Save as PDF.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // WhatsApp Share
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
    text += `Thank you for choosing TPS BATTERYS HOUSE!`;

    const encoded = encodeURIComponent(text);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  };

  // Simulated Sign Out
  const handleSignOutSimulation = () => {
    setIsLoggedOut(true);
  };

  // Simulated Re-login
  const handleSignInSimulation = () => {
    setIsLoggedOut(false);
    showToast(`Welcome back, ${MOCK_USER.name}!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Simulated Sign Out Screen (when user clicks sign out) */}
      {isLoggedOut ? (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto font-black shadow-lg shadow-amber-500/20">
              <BatteryCharging className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-white">
                {business.businessName}
              </h2>
              <p className="text-xs text-amber-400 font-mono">
                Padinarangadi, Thrithala, Palakkad (GSTIN: {business.gstin})
              </p>
              <p className="text-xs text-slate-400 pt-2">
                Simulated frontend session ended. Click below to re-enter demo dashboard as Administrator.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs text-left flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Frontend Mock Notice: Authentication is client-side mock data without an external backend.
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignInSimulation}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In as Alex Johnson (Demo)</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Main Application Header */}
          <Header
            activeView={activeView}
            setActiveView={setActiveView}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onSignOut={handleSignOutSimulation}
            business={business}
            totalInvoicesCount={invoices.length}
          />

          {/* Main Body View Switching */}
          <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-5 lg:p-6 pb-24 sm:pb-20">
            {/* VIEW 1: HOME DASHBOARD */}
            {activeView === 'dashboard' && (
              <Dashboard
                invoices={invoices}
                onNewInvoice={handleStartNewInvoice}
                onOpenInvoice={handleOpenInvoiceInEditor}
                onViewAllInvoices={() => setActiveView('invoices')}
              />
            )}

            {/* VIEW 2: ALL INVOICES LIST VIEW */}
            {activeView === 'invoices' && (
              <AllInvoicesView
                invoices={invoices}
                onBackToDashboard={() => setActiveView('dashboard')}
                onNewInvoice={handleStartNewInvoice}
                onOpenInvoice={handleOpenInvoiceInEditor}
                onDeleteInvoice={handleDeleteInvoice}
              />
            )}

            {/* VIEW 3: FULL GST TAX BILL GENERATOR & LIVE PREVIEW */}
            {activeView === 'editor' && (
              <div className="space-y-4">
                {/* Editor Sub-Header: Back to Dashboard & Bill Actions */}
                <div className="bg-slate-900 border border-slate-800 p-3 sm:px-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 no-print">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveView('dashboard')}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Dashboard</span>
                    </button>
                    <div className="hidden sm:block text-xs text-slate-400">
                      Invoice: <span className="font-mono font-bold text-white">{invoice.invoiceNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Switcher for smaller devices */}
                    <div className="flex xl:hidden bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => setMobileView('form')}
                        className={`p-1.5 rounded flex items-center gap-1 ${
                          mobileView === 'form' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                        }`}
                        title="Form Only"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span className="hidden sm:inline">Form</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileView('preview')}
                        className={`p-1.5 rounded flex items-center gap-1 ${
                          mobileView === 'preview' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                        }`}
                        title="Invoice Only"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">Invoice</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileView('both')}
                        className={`p-1.5 rounded hidden sm:flex items-center gap-1 ${
                          mobileView === 'both' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                        }`}
                        title="Split Screen"
                      >
                        <Columns className="w-4 h-4" />
                        <span>Split</span>
                      </button>
                    </div>

                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="px-2.5 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 transition-colors"
                      title="Share bill on WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    {/* Print */}
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Print A4 bill"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Print</span>
                    </button>

                    {/* PDF Download */}
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={isPdfGenerating}
                      className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                    >
                      {isPdfGenerating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Split Workspace */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                  {/* Left: Input Form */}
                  <div
                    className={`xl:col-span-5 2xl:col-span-5 h-[calc(100vh-10rem)] no-print ${
                      mobileView === 'preview' ? 'hidden xl:block' : 'block'
                    }`}
                  >
                    <InvoiceForm
                      invoice={invoice}
                      setInvoice={setInvoice}
                      onSave={handleSaveInvoiceInEditor}
                      onReset={handleStartNewInvoice}
                      onLoadSample={handleLoadSample}
                      isSaved={isSavedFeedback}
                    />
                  </div>

                  {/* Right: Live A4 Invoice Preview */}
                  <div
                    className={`xl:col-span-7 2xl:col-span-7 flex flex-col items-center ${
                      mobileView === 'form' ? 'hidden xl:flex' : 'flex'
                    }`}
                  >
                    {/* Copy Designation Bar */}
                    <div className="w-full max-w-[800px] mb-3 flex items-center justify-between bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl text-xs text-slate-300 no-print">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="font-semibold text-white">Live Kerala GST Tax Invoice Preview</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 hidden sm:inline">Designation:</span>
                        <select
                          value={invoiceCopy}
                          onChange={(e) => setInvoiceCopy(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-medium focus:outline-none"
                        >
                          <option value="Original for Recipient">Original for Recipient</option>
                          <option value="Duplicate for Supplier">Duplicate for Supplier</option>
                          <option value="Triplicate for Records">Triplicate for Records</option>
                        </select>
                      </div>
                    </div>

                    <div className="w-full flex justify-center overflow-x-auto p-1">
                      <InvoicePreview
                        invoice={invoice}
                        business={business}
                        invoiceCopy={invoiceCopy}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* F. Floating Action Button for Quick Invoice Creation */}
          <FloatingActionButton
            visible={activeView !== 'editor'}
            onClick={handleStartNewInvoice}
          />

          {/* Quick Create Invoice Modal */}
          {isQuickCreateOpen && (
            <QuickCreateInvoiceModal
              key={`quick-modal-${getNextInvoiceNumber()}`}
              isOpen={isQuickCreateOpen}
              onClose={() => setIsQuickCreateOpen(false)}
              onSaveInvoice={handleSaveQuickInvoice}
              onOpenInFullGenerator={() => {
                setActiveView('editor');
              }}
              nextInvoiceNumber={getNextInvoiceNumber()}
            />
          )}

          {/* User Profile Modal */}
          <UserProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            onSignOut={handleSignOutSimulation}
          />

          {/* Store & Bank Settings Modal */}
          <BusinessSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            business={business}
            setBusiness={setBusiness}
          />

          {/* Invoice History Drawer */}
          <InvoiceHistoryModal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            history={invoices}
            onSelectInvoice={handleOpenInvoiceInEditor}
            onDeleteInvoice={handleDeleteInvoice}
            onClearHistory={() => setInvoices([])}
          />
        </>
      )}
    </div>
  );
}
