import React, { useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  TRANSACTION_TYPES,
} from '../utils/categories';
import { calculateInvoiceTotals, validateInvoiceBeforePrint } from '../utils/gstCalculations';
import { generateId } from '../utils/idGenerator';
import { INVOICE_STATUSES } from '../data/mockData';
import CatalogItemPickerModal from './CatalogItemPickerModal';
import CustomerPickerModal from './CustomerPickerModal';

// Sub-components matching Simple New Bill – New Bill.html architecture
import InvoicePageHeader from './invoice/InvoicePageHeader';
import CustomerDetailsSection from './invoice/CustomerDetailsSection';
import InvoiceItemsSection from './invoice/InvoiceItemsSection';
import InvoicePaymentSection from './invoice/InvoicePaymentSection';
import InvoiceMetadataSection from './invoice/InvoiceMetadataSection';
import InvoiceSummary from './invoice/InvoiceSummary';

export default function InvoiceForm({
  invoice,
  setInvoice,
  catalog = [],
  customers = [],
  business,
  onSave,
  onReset,
  onLoadSample,
  onBackToDashboard,
  _isSaved = false,
  onPreview,
  onPrint,
  onDownloadPdf,
  onShareWhatsApp,
  onOpenSettings,
  isPdfGenerating = false,
  isPrinting = false,
}) {
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [itemErrors, setItemErrors] = useState({});

  // Authoritative GST and Totals computation
  const totals = calculateInvoiceTotals(invoice, business?.stateCode || '32');
  const isInterstate = totals.isInterstate;

  // Safe nested state updater
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

  // Transaction type toggle handler
  const handleSetTransactionType = (type) => {
    setInvoice((prev) => ({
      ...prev,
      transactionType: type,
    }));
  };

  // Customer selection callback
  const handleSelectCustomer = (cust) => {
    if (!cust) return;
    setInvoice((prev) => {
      const gstin = (cust.gstin || '').trim();
      const isB2B = Boolean(gstin && gstin.length >= 10);
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
          gstin: gstin,
          pan: cust.pan || (gstin.length >= 12 ? gstin.slice(2, 12) : ''),
        },
      };
    });
  };

  // Add line item
  const addItem = (preset = null, categoryOverride = null) => {
    if (preset) {
      const cat = preset.category || PRODUCT_CATEGORIES.BATTERY;
      const catCfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];

      const newItem = {
        id: generateId('item'),
        name: preset.name || '',
        category: cat,
        subcategory: preset.subcategory || catCfg.subcategories[0] || '',
        brand: preset.brand || '',
        model: preset.model || '',
        specs: { ...(preset.specs || {}) },
        hsn: preset.hsn || catCfg.defaultHsn,
        serialNo: '',
        warranty: preset.warranty || (cat === PRODUCT_CATEGORIES.SERVICES ? 'Installation Warranty' : '36 Months'),
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
      unit: catCfg.defaultUnit || 'Nos',
      rate: 0,
      isTaxInclusive: true,
      gstRate: catCfg.defaultGstRate || 28,
      discount: 0,
    };

    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  // Update line item field
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

  // Change line item category
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

  // Remove item (allows removing down to 0 items to return to clean empty state)
  const removeItem = (index) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    setValidationErrors([]);
    setItemErrors({});
  };

  // Run authoritative pre-print and pre-save validation
  const runValidation = () => {
    const res = validateInvoiceBeforePrint(invoice);
    if (!res.isValid) {
      setValidationErrors(res.errors);
      setItemErrors(res.itemErrors);
      const el = document.getElementById('section-invoice-items');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return false;
    }
    setValidationErrors([]);
    setItemErrors({});
    return true;
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!onSave) return;
    if (!invoice?.items || invoice.items.length === 0) {
      setValidationErrors(['Please add at least one product or service before saving as draft.']);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(INVOICE_STATUSES.DRAFT);
    } finally {
      setIsSaving(false);
    }
  };

  // Save Final / Issue Bill
  const handleSaveInvoice = async () => {
    if (!onSave) return;
    if (!runValidation()) return;
    setIsSaving(true);
    try {
      const targetStatus = invoice.paymentStatus || INVOICE_STATUSES.PENDING;
      await onSave(targetStatus);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintValidated = () => {
    if (!runValidation()) return;
    if (onPrint) onPrint();
  };

  const handleDownloadPdfValidated = () => {
    if (!runValidation()) return;
    if (onDownloadPdf) onDownloadPdf();
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 pb-24 text-[#F2EFE9] font-sans">
      {/* Page Header: Title, Back link, Date, Sample, Settings, Clear */}
      <InvoicePageHeader
        invoice={invoice}
        business={business}
        onReset={onReset}
        onOpenSettings={onOpenSettings}
        onLoadSample={onLoadSample}
        onBackToDashboard={onBackToDashboard}
      />

      {/* Main Two-Column Layout matching Simple New Bill – New Bill.html */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Steps 1, 2, 3 and Extra details */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
          {/* Step 1: Who is buying? */}
          <CustomerDetailsSection
            customer={invoice.customer}
            onUpdateField={updateField}
            onSelectCustomer={handleSelectCustomer}
            customers={customers}
            businessStateCode={business?.stateCode || '32'}
            onOpenCustomerPicker={() => setIsCustomerPickerOpen(true)}
            transactionType={invoice.transactionType}
            onSetTransactionType={handleSetTransactionType}
          />

          {/* Step 2: What are they buying? */}
          <InvoiceItemsSection
            items={invoice.items || []}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onUpdateCategory={changeItemCategory}
            onRemoveItem={removeItem}
            onOpenCatalogPicker={() => setIsCatalogPickerOpen(true)}
            isInterstate={isInterstate}
            invoice={invoice}
            onUpdateField={updateField}
            validationErrors={validationErrors}
            itemErrors={itemErrors}
          />

          {/* Step 3: How is the customer paying? */}
          <InvoicePaymentSection
            invoice={invoice}
            onUpdateField={updateField}
          />

          {/* Extra details (not needed for most bills) */}
          <InvoiceMetadataSection
            invoice={invoice}
            onUpdateField={updateField}
          />
        </div>

        {/* Right Side: Sticky Bill Total Sidebar */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-6">
          <InvoiceSummary
            invoice={invoice}
            totals={totals}
            isInterstate={isInterstate}
            onSaveInvoice={handleSaveInvoice}
            onSaveDraft={handleSaveDraft}
            onPreview={onPreview}
            onPrint={handlePrintValidated}
            onDownloadPdf={handleDownloadPdfValidated}
            onShareWhatsApp={onShareWhatsApp}
            isPrinting={isPrinting}
            isPdfGenerating={isPdfGenerating}
            isSaving={isSaving}
          />
        </div>
      </div>

      {/* Catalog Item Picker Modal */}
      <CatalogItemPickerModal
        isOpen={isCatalogPickerOpen}
        onClose={() => setIsCatalogPickerOpen(false)}
        catalog={catalog}
        onSelectItem={(item) => addItem(item)}
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
