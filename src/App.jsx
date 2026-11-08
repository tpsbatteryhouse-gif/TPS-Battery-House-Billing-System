import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  Share2,
  Eye,
  Edit3,
  Columns,
  CheckCircle,
  Loader2,
  ArrowLeft,
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
import ProductCatalogView from './components/ProductCatalogView';
import CustomerManagementView from './components/CustomerManagementView';
import StaffManagementView from './components/StaffManagementView';
import { getSampleInvoiceData } from './utils/defaults';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  TRANSACTION_TYPES,
  inferTransactionType,
  normalizeInvoiceItem,
} from './utils/categories';
import { calculateInvoiceTotals } from './utils/gstCalculations';
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
      return draft ? JSON.parse(draft) : getSampleInvoiceData();
    } catch {
      return getSampleInvoiceData();
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
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Editor View Mode: 'edit' (default: full-width editor), 'preview' (dedicated full-width preview), 'split' (optional side-by-side)
  const [editorMode, setEditorMode] = useState('edit');
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
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Calculate totals for active invoice in editor
  const totals = calculateInvoiceTotals(invoice, business.stateCode || '32');

  // Handle Quick Create Save
  const handleSaveQuickInvoice = async (newInvoice) => {
    try {
      const txType = inferTransactionType(newInvoice);
      const normalizedItems = (newInvoice.items || []).map((item) => normalizeInvoiceItem(item));
      const invWithItems = {
        ...newInvoice,
        items: normalizedItems,
      };
      const quickTotals = calculateInvoiceTotals(invWithItems, business.stateCode || '32');

      const invoiceToSave = {
        ...invWithItems,
        id: newInvoice.id || ('inv-' + Date.now()),
        transactionType: txType,
        netPayable: quickTotals.netPayable,
        savedAt: new Date().toISOString(),
      };

      const saved = await saveInvoice(invoiceToSave);
      setInvoices((prev) => [saved, ...prev.filter((i) => i.id !== saved.id && i.invoiceNumber !== saved.invoiceNumber)]);
      showToast(`Invoice ${saved.invoiceNumber} created successfully!`);
    } catch (err) {
      console.error('Failed to save quick invoice:', err);
      showToast(`Error saving invoice: ${err.message}`);
    }
  };

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

  // Handle New Invoice trigger (loads blank template into editor or opens modal)
  const handleStartNewInvoice = () => {
    const newInvNo = getNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];

    const freshInvoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: newInvNo,
      invoiceDate: today,
      dueDate: today,
      transactionType: TRANSACTION_TYPES.B2B,
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
          category: PRODUCT_CATEGORIES.BATTERY,
          subcategory: 'Tubular Battery',
          brand: '',
          model: '',
          specs: {},
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
  const handleSaveInvoiceInEditor = async () => {
    try {
      const stableId = invoice.id || ('inv-' + Date.now());
      const txType = inferTransactionType(invoice);
      const normalizedItems = (invoice.items || []).map((item) => normalizeInvoiceItem(item));

      const invoiceToSave = {
        ...invoice,
        id: stableId,
        transactionType: txType,
        items: normalizedItems,
        scrapExchange: {
          ...invoice.scrapExchange,
          enabled: Boolean(invoice.scrapExchange?.enabled),
          amount: Math.max(0, Number(invoice.scrapExchange?.amount) || 0),
          description: invoice.scrapExchange?.description || 'Old 150Ah Scrap Battery Buyback',
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
    } catch (err) {
      console.error('Failed to save invoice in editor:', err);
      showToast(`Error saving invoice: ${err.message}`);
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

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Download PDF (lazy loads html2canvas and jsPDF on demand)
  const handleDownloadPdf = async () => {
    setIsPdfGenerating(true);
    try {
      const { downloadInvoicePdf } = await import('./utils/pdfExport.js');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Application Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
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
                    <div className="text-xs text-slate-400">
                      Invoice: <span className="font-mono font-bold text-white">{invoice.invoiceNumber}</span>
                    </div>
                    {/* Transaction Classification Badge */}
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {invoice.transactionType || inferTransactionType(invoice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Dedicated Mode Switcher */}
                    <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditorMode('edit');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`px-3 py-1.5 rounded flex items-center gap-1.5 font-medium transition-colors ${
                          editorMode === 'edit'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title="Full-Width Invoice Editor"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editor</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditorMode('preview');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`px-3 py-1.5 rounded flex items-center gap-1.5 font-medium transition-colors ${
                          editorMode === 'preview'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title="Dedicated A4 Invoice Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Invoice</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditorMode('split');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`px-2.5 py-1.5 rounded hidden xl:flex items-center gap-1.5 font-medium transition-colors ${
                          editorMode === 'split'
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title="Side-by-Side Split View"
                      >
                        <Columns className="w-3.5 h-3.5" />
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

                {/* MODE 1: DEDICATED FULL-WIDTH INVOICE EDITOR (DEFAULT) */}
                {editorMode === 'edit' && (
                  <div className="w-full no-print">
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
                    />
                  </div>
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
                      transactionType: isB2B ? TRANSACTION_TYPES.B2B : TRANSACTION_TYPES.B2C,
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

          {/* Quick Create Invoice Modal */}
          {isQuickCreateOpen && (
            <QuickCreateInvoiceModal
              key={`quick-modal-${getNextInvoiceNumber()}`}
              isOpen={isQuickCreateOpen}
              onClose={() => setIsQuickCreateOpen(false)}
              onSaveInvoice={handleSaveQuickInvoice}
              onOpenInFullGenerator={(formData) => {
                if (formData) {
                  const txType = formData.transactionType || (formData.customerGstin?.trim() ? TRANSACTION_TYPES.B2B : TRANSACTION_TYPES.B2C);
                  const items = (formData.items || []).map((it) =>
                    normalizeInvoiceItem({
                      id: it.id || ('item-' + Date.now()),
                      name: it.description || '',
                      category: it.category || PRODUCT_CATEGORIES.BATTERY,
                      hsn: it.hsn || (CATEGORY_CONFIG[it.category]?.defaultHsn || '8507'),
                      qty: Number(it.qty) || 1,
                      unit: it.unit || 'Nos',
                      rate: Number(it.unitPrice) || 0,
                      isTaxInclusive: true,
                      gstRate: Number(it.gstRate) || (CATEGORY_CONFIG[it.category]?.defaultGstRate || 28),
                    })
                  );

                  setInvoice((prev) => ({
                    ...prev,
                    invoiceNumber: formData.invoiceNumber || prev.invoiceNumber,
                    invoiceDate: formData.invoiceDate || prev.invoiceDate,
                    dueDate: formData.dueDate || prev.dueDate,
                    transactionType: txType,
                    customer: {
                      ...prev.customer,
                      name: formData.customerName || prev.customer?.name || '',
                      phone: formData.customerPhone || prev.customer?.phone || '',
                      gstin: formData.customerGstin || prev.customer?.gstin || '',
                    },
                    items: items.length > 0 ? items : prev.items,
                  }));
                }
                setActiveView('editor');
              }}
              nextInvoiceNumber={getNextInvoiceNumber()}
              customers={customers}
            />
          )}

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
