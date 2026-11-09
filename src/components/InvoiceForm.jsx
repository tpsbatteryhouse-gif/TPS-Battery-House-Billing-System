import React, { useState } from 'react';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  TRANSACTION_TYPES,
} from '../utils/categories';
import { calculateInvoiceTotals } from '../utils/gstCalculations';
import { generateId } from '../utils/idGenerator';
import { INVOICE_STATUSES } from '../data/mockData';
import CatalogItemPickerModal from './CatalogItemPickerModal';
import CustomerPickerModal from './CustomerPickerModal';

// Sub-components
import InvoicePageHeader from './invoice/InvoicePageHeader';
import CustomerDetailsSection from './invoice/CustomerDetailsSection';
import InvoiceMetadataSection from './invoice/InvoiceMetadataSection';
import InvoiceItemsSection from './invoice/InvoiceItemsSection';
import InvoiceDeductionsSection from './invoice/InvoiceDeductionsSection';
import InvoiceSummary from './invoice/InvoiceSummary';
import InvoiceTermsSection from './invoice/InvoiceTermsSection';
import InvoiceActionBar from './invoice/InvoiceActionBar';

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
  isSaved = false,
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

  // Remove item
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

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!onSave) return;
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
    setIsSaving(true);
    try {
      const targetStatus = invoice.paymentStatus || INVOICE_STATUSES.PENDING;
      await onSave(targetStatus);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Invoice Page Header */}
      <InvoicePageHeader
        invoice={invoice}
        business={business}
        onReset={onReset}
        onOpenSettings={onOpenSettings}
        onLoadSample={onLoadSample}
        onBackToDashboard={onBackToDashboard}
      />

      {/* 2. Customer Particulars & Invoice Metadata Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Customer Particulars (2 cols on large screen) */}
        <div className="lg:col-span-2">
          <CustomerDetailsSection
            customer={invoice.customer}
            onUpdateField={updateField}
            onSelectCustomer={handleSelectCustomer}
            customers={customers}
            businessStateCode={business?.stateCode || '32'}
            onOpenCustomerPicker={() => setIsCustomerPickerOpen(true)}
          />
        </div>

        {/* Invoice Metadata (1 col on large screen) */}
        <div className="lg:col-span-1">
          <InvoiceMetadataSection
            invoice={invoice}
            onUpdateField={updateField}
          />
        </div>
      </div>

      {/* 3. Multi-Category Line Items Section */}
      <InvoiceItemsSection
        items={invoice.items || []}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onUpdateCategory={changeItemCategory}
        onRemoveItem={removeItem}
        onOpenCatalogPicker={() => setIsCatalogPickerOpen(true)}
        isInterstate={isInterstate}
      />

      {/* 4. Notes, Deductions & Calculation Breakdown Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Deductions, Terms & Staff Notes (7 cols on large desktop) */}
        <div className="lg:col-span-7 space-y-6">
          <InvoiceDeductionsSection
            invoice={invoice}
            onUpdateField={updateField}
          />
          <InvoiceTermsSection
            invoice={invoice}
            onUpdateField={updateField}
          />
        </div>

        {/* Right: Calculation Summary Card (5 cols on large desktop) */}
        <div className="lg:col-span-5">
          <InvoiceSummary
            invoice={invoice}
            totals={totals}
            onUpdateField={updateField}
            isInterstate={isInterstate}
          />
        </div>
      </div>

      {/* 5. Bottom Fixed Action Toolbar */}
      <InvoiceActionBar
        itemsCount={invoice.items?.length || 0}
        taxableValue={totals.totalTaxableValue}
        netPayable={totals.netPayable}
        onSaveDraft={handleSaveDraft}
        onSaveInvoice={handleSaveInvoice}
        onPreview={onPreview}
        onPrint={onPrint}
        isPrinting={isPrinting}
        onDownloadPdf={onDownloadPdf}
        onShareWhatsApp={onShareWhatsApp}
        isSaved={isSaved}
        isPdfGenerating={isPdfGenerating}
        isSaving={isSaving}
      />

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
