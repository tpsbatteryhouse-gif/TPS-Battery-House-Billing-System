import React, { useState, useEffect } from 'react';
import { CheckCircle, Edit3, Download, Printer, Loader2 } from 'lucide-react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AllInvoicesView from './components/AllInvoicesView';
import UserProfileModal from './components/UserProfileModal';
import FloatingActionButton from './components/FloatingActionButton';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import InvoiceHistoryModal from './components/InvoiceHistoryModal';
import BusinessSettingsModal from './components/BusinessSettingsModal';
import ProductCatalogView from './components/ProductCatalogView';
import CustomerManagementView from './components/CustomerManagementView';
import StaffManagementView from './components/StaffManagementView';
import { getSampleInvoiceData, createEmptyInvoice } from './utils/defaults';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  TRANSACTION_TYPES,
  inferTransactionType,
  normalizeInvoiceItem,
} from './utils/categories';
import { calculateInvoiceTotals, validateInvoiceBeforePrint } from './utils/gstCalculations';
import { formatINR } from './utils/numberToWords';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { DEFAULT_BUSINESS_ID } from './context/authConstants';
import { useProductCatalog } from './hooks/useProductCatalog';
import { useCustomers } from './hooks/useCustomers';
import { useInvoices } from './hooks/useInvoices';
import { useBusinessSettings } from './hooks/useBusinessSettings';
import ProtectedRoute from './components/auth/ProtectedRoute';

function AppContent({ business, setBusiness, onSaveBusinessSettings, settingsSyncStatus }) {
  const { permissions, signOutUser } = useAuth();
  // Navigation View: 'dashboard' | 'invoices' | 'editor'
  const [activeView, setActiveView] = useState('dashboard');

  // Centralized Invoices Dataset with Firestore Realtime Sync, Atomic Sequence Allocation & Offline Cache
  const {
    invoices,
    setInvoices,
    loading: invoicesLoading,
    error: invoicesError,
    syncStatus: invoicesSyncStatus,
    saveInvoice,
    changeInvoiceStatus,
    removeInvoice,
    refreshInvoices,
    peekNextInvoiceNumber,
  } = useInvoices(DEFAULT_BUSINESS_ID, business);

  // Current Active Invoice for Generator / Live Editor
  const [invoice, setInvoice] = useState(() => {
    try {
      const draft = localStorage.getItem('tps_invoice_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        // Clean out legacy single unnamed placeholder item if found in stored draft
        if (
          Array.isArray(parsed.items) &&
          parsed.items.length === 1 &&
          !parsed.items[0].name &&
          Number(parsed.items[0].rate || 0) === 0
        ) {
          parsed.items = [];
        }
        return parsed;
      }
      return createEmptyInvoice('TPS/2026-27/---');
    } catch {
      return createEmptyInvoice('TPS/2026-27/---');
    }
  });

  // Centralized Product Catalog Dataset with Firestore Realtime Sync & Offline Cache
  const {
    catalog,
    setCatalog,
    loading: catalogLoading,
    error: catalogError,
    syncStatus: catalogSyncStatus,
    saveProduct,
    removeProduct,
    refreshCatalog,
  } = useProductCatalog(DEFAULT_BUSINESS_ID);

  // Centralized Customer Directory Dataset with Firestore Realtime Sync & Offline Cache
  const {
    customers,
    loading: customersLoading,
    error: customersError,
    syncStatus: customersSyncStatus,
    saveCustomer,
    removeCustomer,
    refreshCustomers,
  } = useCustomers(DEFAULT_BUSINESS_ID);

  // UI Modal & Control States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');

  // Editor View Mode: 'edit' (default: full-width editor), 'preview' (dedicated full-width preview), 'split' (optional side-by-side)
  const [editorMode, setEditorMode] = useState('edit');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
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

  // Persist Product Catalog
  useEffect(() => {
    try {
      localStorage.setItem('tps_product_catalog', JSON.stringify(catalog));
    } catch (e) {
      console.error('Failed to save catalog to storage:', e);
    }
  }, [catalog]);

  // Compute Next Sequential Invoice Number for display without collisions
  const getNextInvoiceNumber = (date) => {
    return peekNextInvoiceNumber(business?.invoicePrefix, date || invoice?.invoiceDate);
  };

  // Toast feedback helper
  const showToast = (msg, type = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage('');
      setToastType('info');
    }, 3500);
  };

  // Calculate totals for active invoice in editor
  const totals = calculateInvoiceTotals(invoice, business.stateCode || '32');

  // Handle Opening an Invoice from Dashboard / List into Full Generator
  const handleOpenInvoiceInEditor = (inv) => {
    // Preserve all historical fields; ensure transactionType is set cleanly without rewriting amounts
    const openedInvoice = {
      ...inv,
      transactionType: inferTransactionType(inv),
      items: (inv.items || []).map((item) => normalizeInvoiceItem(item)),
    };
    setInvoice(openedInvoice);
    setEditorMode('edit');
    setActiveView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Adding a Catalog Product to Active Draft Invoice
  const handleAddProductToActiveBill = (product) => {
    const cat = product.category || PRODUCT_CATEGORIES.BATTERY;
    const catCfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
    const newItem = {
      id: 'item-' + Date.now(),
      name: product.name,
      category: cat,
      subcategory: product.subcategory || '',
      brand: product.brand || '',
      model: product.model || '',
      specs: { ...(product.specs || {}) },
      hsn: product.hsn || catCfg.defaultHsn,
      serialNo: '',
      warranty: product.warranty || '36 Months',
      qty: 1,
      unit: product.unit || catCfg.defaultUnit || 'Nos',
      rate: Number(product.sellingPrice) || 0,
      isTaxInclusive: product.isTaxInclusive !== undefined ? product.isTaxInclusive : true,
      gstRate: Number(product.gstRate) || catCfg.defaultGstRate || 28,
    };

    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    showToast(`Added "${product.name}" to bill!`);
  };

  // Handle New Invoice trigger (loads clean blank template with zero items into editor)
  const handleStartNewInvoice = () => {
    const newInvNo = getNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];

    const freshInvoice = createEmptyInvoice(newInvNo, today);

    setInvoice(freshInvoice);
    setActiveView('editor');
    setEditorMode('edit');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Safe In-place Reset with confirmation
  const handleResetInvoice = () => {
    if (
      window.confirm(
        'Reset this invoice form? All unsaved line items and customer information will be cleared.'
      )
    ) {
      handleStartNewInvoice();
    }
  };

  // Handle Saving bill from within the Full GST Billing Studio
  const handleSaveInvoiceInEditor = async (statusOverride = null) => {
    // Validate customer particulars before saving
    const customerName = (invoice?.customer?.name || '').trim();
    if (!customerName) {
      showToast('Please enter customer name before saving.', 'error');
      return false;
    }

    // Validate invoice form state before saving
    const validation = validateInvoiceBeforePrint(invoice);
    if (!validation.isValid) {
      showToast(validation.errorSummary || 'Please add at least one product or service before saving.', 'error');
      return false;
    }

    try {
      const stableId = invoice.id || ('inv-' + Date.now());
      const txType = inferTransactionType(invoice);
      const normalizedItems = (invoice.items || []).map((item) => normalizeInvoiceItem(item));
      const paymentStatus = (typeof statusOverride === 'string' && statusOverride) || invoice.paymentStatus || 'Pending';

      const invoiceToSave = {
        ...invoice,
        id: stableId,
        paymentStatus,
        transactionType: txType,
        items: normalizedItems,
        scrapExchange: {
          ...invoice.scrapExchange,
          enabled: Boolean(invoice.scrapExchange?.enabled),
          amount: Math.max(0, Number(invoice.scrapExchange?.amount) || 0),
          description: invoice.scrapExchange?.description !== undefined ? invoice.scrapExchange.description : 'Old 150Ah Scrap Battery Buyback',
        },
        additionalDiscount: Math.max(0, Number(invoice.additionalDiscount) || 0),
        netPayable: totals.netPayable,
        savedAt: new Date().toISOString(),
      };

      const saved = await saveInvoice(invoiceToSave);

      // Keep active editor state exactly in sync with saved record
      setInvoice(saved);

      // Update invoices array (match by stable ID first, then invoiceNumber)
      setInvoices((prev) => {
        const existingIdx = prev.findIndex(
          (i) => (i.id && i.id === saved.id) || i.invoiceNumber === saved.invoiceNumber
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });

      setIsSavedFeedback(true);
      showToast(`Invoice ${saved.invoiceNumber} saved!`);
      setTimeout(() => setIsSavedFeedback(false), 2500);
      return saved;
    } catch (err) {
      console.error('Failed to save invoice in editor:', {
        code: err?.code,
        message: err?.message,
        operation: 'handleSaveInvoiceInEditor',
      });
      const errorCode = err?.code;
      let displayMessage = err?.message || 'Unknown persistence failure.';
      if (errorCode === 'permission-denied') {
        displayMessage = 'Permission denied: Please ensure you are an active staff member and that the financial year counter has been initialized by an administrator.';
      }
      showToast(`Error saving invoice: ${displayMessage}`, 'error');
      return false;
    }
  };

  // Delete Invoice from dataset (Admin only)
  const handleDeleteInvoice = async (idOrNumber) => {
    if (permissions && !permissions.canDeleteInvoice) {
      alert('Access Denied: Only store administrators are authorized to delete invoices.');
      return;
    }
    if (confirm('Are you sure you want to permanently delete this invoice record?')) {
      try {
        const target = invoices.find((i) => i.id === idOrNumber || i.invoiceNumber === idOrNumber);
        if (target && target.id) {
          await removeInvoice(target.id);
        }
        setInvoices((prev) =>
          prev.filter((i) => i.id !== idOrNumber && i.invoiceNumber !== idOrNumber)
        );
        showToast('Invoice deleted.');
      } catch (err) {
        console.error('Failed to delete invoice:', err);
        alert(`Delete failed: ${err.message}`);
      }
    }
  };

  // Reset to sample test data (Rajesh K. Fuze combo)
  const handleLoadSample = () => {
    setInvoice(getSampleInvoiceData());
    showToast('Loaded sample Fuze 1100 Combo bill');
  };

  // Direct & Vector Print Workflow
  const handlePrint = async () => {
    if (isPrinting) return;

    // Validate invoice form state before printing
    const validation = validateInvoiceBeforePrint(invoice);
    if (!validation.isValid) {
      showToast(validation.errorSummary || 'Please add at least one product or service before printing.', 'error');
      return false;
    }

    setIsPrinting(true);
    try {
      const invoiceToPrint = {
        ...invoice,
        netPayable: totals.netPayable,
      };
      setInvoice(invoiceToPrint);

      const { printInvoicePdf } = await import('./utils/pdfExport.js');
      await printInvoicePdf(invoiceToPrint, business, invoiceCopy);
    } catch (err) {
      console.warn('Dedicated vector print error, falling back to direct window.print():', err);
      // Even in fallback, never print if validation failed
      const reValidation = validateInvoiceBeforePrint(invoice);
      if (reValidation.isValid) {
        window.print();
      } else {
        showToast(reValidation.errorSummary, 'error');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  // Download PDF (lazy loads html2canvas and jsPDF on demand)
  const handleDownloadPdf = async () => {
    // Validate invoice form state before downloading PDF
    const validation = validateInvoiceBeforePrint(invoice);
    if (!validation.isValid) {
      showToast(validation.errorSummary || 'Please add at least one product or service before downloading PDF.', 'error');
      return false;
    }

    setIsPdfGenerating(true);
    try {
      const { downloadInvoicePdf } = await import('./utils/pdfExport.js');
      const invoiceToExport = {
        ...invoice,
        netPayable: totals.netPayable,
      };
      await downloadInvoicePdf(
        'invoice-printable',
        invoice.invoiceNumber,
        invoice.customer?.name,
        { invoice: invoiceToExport, business, invoiceCopy }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 border ${
            toastType === 'error'
              ? 'bg-red-600 text-white border-red-400'
              : 'bg-amber-500 text-slate-950 border-amber-400'
          }`}
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Application Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onNewInvoice={handleStartNewInvoice}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onSignOut={signOutUser}
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
                onChangeStatus={changeInvoiceStatus}
                syncStatus={invoicesSyncStatus}
                syncError={invoicesError}
                onRefresh={refreshInvoices}
                loading={invoicesLoading}
              />
            )}

            {/* VIEW 3: FULL GST TAX BILL GENERATOR & DEDICATED PREVIEW */}
            {activeView === 'editor' && (
              <div className="space-y-4">
                {/* MODE 1: DEDICATED FULL-WIDTH INVOICE EDITOR (DEFAULT) */}
                {editorMode === 'edit' && (
                  <>
                    <div className="w-full no-print">
                      <InvoiceForm
                        invoice={invoice}
                        setInvoice={setInvoice}
                        catalog={catalog}
                        customers={customers}
                        business={business}
                        onSave={handleSaveInvoiceInEditor}
                        onReset={handleResetInvoice}
                        onLoadSample={handleLoadSample}
                        onBackToDashboard={() => setActiveView('dashboard')}
                        isSaved={isSavedFeedback}
                        onPreview={() => {
                          setInvoice((prev) => ({ ...prev, netPayable: totals.netPayable }));
                          setEditorMode('preview');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onPrint={handlePrint}
                        isPrinting={isPrinting}
                        onDownloadPdf={handleDownloadPdf}
                        isPdfGenerating={isPdfGenerating}
                        onShareWhatsApp={handleShareWhatsApp}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                      />
                    </div>

                    {/* DEDICATED INVOICE PRINT CONTAINER: Always present in DOM for print mode */}
                    <div className="hidden print:block print:w-full print:m-0 print:p-0 print-only">
                      <InvoicePreview
                        invoice={{ ...invoice, netPayable: totals.netPayable }}
                        business={business}
                        invoiceCopy={invoiceCopy}
                      />
                    </div>
                  </>
                )}

                {/* MODE 2: DEDICATED FULL-WIDTH INVOICE PREVIEW */}
                {editorMode === 'preview' && (
                  <div className="space-y-4">
                    {/* Return to Editor Notice & Controls */}
                    <div className="bg-slate-900 border border-slate-800 p-3 sm:px-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 no-print">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditorMode('edit');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Invoice</span>
                        </button>
                        <div className="text-xs text-slate-300">
                          Previewing Invoice <span className="font-mono font-bold text-amber-400">{invoice.invoiceNumber}</span>
                          <span className="hidden md:inline text-slate-400"> • Current Form State (Unsaved edits reflected)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 hidden sm:inline">Designation:</span>
                          <select
                            value={invoiceCopy}
                            onChange={(e) => setInvoiceCopy(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-400 font-medium focus:outline-none"
                          >
                            <option value="Original for Recipient">Original for Recipient</option>
                            <option value="Duplicate for Supplier">Duplicate for Supplier</option>
                            <option value="Triplicate for Records">Triplicate for Records</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={handlePrint}
                          disabled={isPrinting}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50"
                        >
                          {isPrinting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              <span>Preparing Print...</span>
                            </>
                          ) : (
                            <>
                              <Printer className="w-3.5 h-3.5 text-amber-400" />
                              <span>Print Bill</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveInvoiceInEditor}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md ${
                            isSavedFeedback
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {isSavedFeedback ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <span>Save Bill</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Centered A4 Invoice */}
                    <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 overflow-x-auto">
                      <InvoicePreview
                        invoice={invoice}
                        business={business}
                        invoiceCopy={invoiceCopy}
                      />
                    </div>

                    {/* Bottom Return Banner */}
                    <div className="flex items-center justify-center gap-3 py-4 no-print">
                      <button
                        type="button"
                        onClick={() => {
                          setEditorMode('edit');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors shadow-sm"
                      >
                        <Edit3 className="w-4 h-4 text-amber-400" />
                        <span>Return to Invoice Editor</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePrint}
                        disabled={isPrinting}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isPrinting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span>Preparing Print...</span>
                          </>
                        ) : (
                          <>
                            <Printer className="w-4 h-4 text-amber-400" />
                            <span>Print A4 Bill</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={isPdfGenerating}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download A4 PDF</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* MODE 3: OPTIONAL SIDE-BY-SIDE SPLIT VIEW */}
                {editorMode === 'split' && (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    {/* Left: Input Form */}
                    <div className="xl:col-span-6 2xl:col-span-6 no-print">
                      <InvoiceForm
                        invoice={invoice}
                        setInvoice={setInvoice}
                        catalog={catalog}
                        customers={customers}
                        business={business}
                        onSave={handleSaveInvoiceInEditor}
                        onReset={handleStartNewInvoice}
                        onLoadSample={handleLoadSample}
                        isSaved={isSavedFeedback}
                        onPreview={() => {
                          setEditorMode('preview');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onPrint={handlePrint}
                        onDownloadPdf={handleDownloadPdf}
                        isPdfGenerating={isPdfGenerating}
                        onShareWhatsApp={handleShareWhatsApp}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                      />
                    </div>

                    {/* Right: Live A4 Invoice Preview */}
                    <div className="xl:col-span-6 2xl:col-span-6 flex flex-col items-center">
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
                )}
              </div>
            )}

            {/* VIEW 4: PRODUCT & SERVICE CATALOG MANAGEMENT */}
            {activeView === 'catalog' && (
              <ProductCatalogView
                catalog={catalog}
                setCatalog={setCatalog}
                onSaveProduct={saveProduct}
                onDeleteProduct={removeProduct}
                syncStatus={catalogSyncStatus}
                syncError={catalogError}
                onRefresh={refreshCatalog}
                loading={catalogLoading}
                onAddToInvoice={(prod) => {
                  handleAddProductToActiveBill(prod);
                  setActiveView('editor');
                }}
                onNavigateToEditor={() => setActiveView('editor')}
              />
            )}

            {/* VIEW 5: CUSTOMER & BUYER DIRECTORY MANAGEMENT */}
            {activeView === 'customers' && (
              <CustomerManagementView
                customers={customers}
                onSaveCustomer={saveCustomer}
                onDeleteCustomer={removeCustomer}
                syncStatus={customersSyncStatus}
                syncError={customersError}
                onRefresh={refreshCustomers}
                loading={customersLoading}
                onSelectCustomerForBill={(cust) => {
                  setInvoice((prev) => {
                    const isB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);
                    return {
                      ...prev,
                      transactionType: isB2B ? TRANSACTION_TYPES.B2B : (prev.transactionType || TRANSACTION_TYPES.B2C),
                      customer: {
                        ...prev.customer,
                        name: cust.name || '',
                        phone: cust.phone || '',
                        address: cust.address || '',
                        shippingAddress: cust.shippingAddress || prev.customer?.shippingAddress || '',
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
                  setActiveView('editor');
                }}
              />
            )}

            {/* VIEW 6: STAFF ADMINISTRATION & RBAC */}
            {activeView === 'staff' && (
              <StaffManagementView business={business} />
            )}
          </main>

          {/* F. Floating Action Button for Quick Invoice Creation */}
          <FloatingActionButton
            visible={activeView !== 'editor'}
            onClick={handleStartNewInvoice}
          />

          {/* User Profile Modal */}
          <UserProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            onSignOut={signOutUser}
          />

          {/* Store & Bank Settings Modal */}
          <BusinessSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            business={business}
            setBusiness={setBusiness}
            onSave={onSaveBusinessSettings}
            syncStatus={settingsSyncStatus}
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
    </div>
  );
}

function AppWithSettings() {
  const {
    settings: business,
    setSettings: setBusiness,
    updateSettings,
    syncStatus: settingsSyncStatus,
  } = useBusinessSettings(DEFAULT_BUSINESS_ID);

  return (
    <ProtectedRoute business={business}>
      <AppContent
        business={business}
        setBusiness={setBusiness}
        onSaveBusinessSettings={updateSettings}
        settingsSyncStatus={settingsSyncStatus}
      />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppWithSettings />
    </AuthProvider>
  );
}
