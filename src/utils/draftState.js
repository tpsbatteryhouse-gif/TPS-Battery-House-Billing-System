/**
 * TPS Battery House — Draft State & Dirty Tracking Utilities
 *
 * Provides deterministic hashing/snapshots of invoice form state to:
 * - Detect whether a draft has unsaved changes (dirty vs clean)
 * - Prevent redundant Firestore writes when clicking "Save for later"
 * - Validate meaningful data existence before staging empty drafts
 * - Guard against accidentally demoting issued invoices back to Draft
 */

import { normalizeInvoiceItem } from './categories.js';

/**
 * Checks whether an invoice contains meaningful customer or product details.
 * Prevents saving empty or blank draft documents.
 */
export function hasMeaningfulInvoiceData(invoice) {
  if (!invoice || typeof invoice !== 'object') return false;

  const hasCustomerInfo = Boolean(
    (invoice.customer?.name && invoice.customer.name.trim().length > 0) ||
    (invoice.customer?.phone && invoice.customer.phone.trim().length > 0) ||
    (invoice.customer?.address && invoice.customer.address.trim().length > 0) ||
    (invoice.customer?.gstin && invoice.customer.gstin.trim().length > 0)
  );

  const hasLineItems = Array.isArray(invoice.items) && invoice.items.some((item) => {
    const hasName = Boolean(item?.name && item.name.trim().length > 0);
    const hasRate = Number(item?.rate) > 0 || Number(item?.sellingPrice) > 0;
    return hasName || hasRate;
  });

  return hasCustomerInfo || hasLineItems;
}

/**
 * Checks whether the invoice was already issued in an official statutory state.
 * Accurately distinguishes between:
 * - Fresh unpersisted invoice templates (e.g. 'TPS/2026-27/---')
 * - Draft invoices ('DRAFT-...' or paymentStatus === 'Draft')
 * - Officially issued invoices (e.g. 'TPS/2026-27/010' with status 'Pending', 'Paid', etc.)
 */
export function isIssuedInvoice(invoice) {
  if (!invoice || typeof invoice !== 'object') return false;
  if (invoice.paymentStatus === 'Draft') return false;
  if (typeof invoice.invoiceNumber === 'string') {
    if (invoice.invoiceNumber.startsWith('DRAFT')) return false;
    if (invoice.invoiceNumber.includes('---')) return false;
  }
  if (typeof invoice.id === 'string' && invoice.id.startsWith('inv_draft_')) return false;
  const status = invoice.paymentStatus;
  return ['Pending', 'Paid', 'Cancelled', 'Overdue'].includes(status);
}

/**
 * Produces a normalized, deterministic snapshot of user-editable invoice fields.
 * Strips internal timestamps and ephemeral UI flags.
 */
export function createDraftSnapshot(invoice) {
  if (!invoice || typeof invoice !== 'object') return null;

  const customer = {
    name: (invoice.customer?.name || '').trim(),
    phone: (invoice.customer?.phone || '').trim(),
    address: (invoice.customer?.address || '').trim(),
    shippingAddress: (invoice.customer?.shippingAddress || '').trim(),
    city: (invoice.customer?.city || '').trim(),
    district: (invoice.customer?.district || '').trim(),
    state: (invoice.customer?.state || '').trim(),
    stateCode: (invoice.customer?.stateCode || '').trim(),
    pincode: (invoice.customer?.pincode || '').trim(),
    gstin: (invoice.customer?.gstin || '').trim().toUpperCase(),
    pan: (invoice.customer?.pan || '').trim().toUpperCase(),
  };

  const items = (Array.isArray(invoice.items) ? invoice.items : []).map((item) => {
    const norm = normalizeInvoiceItem(item);
    return {
      name: norm.name || '',
      category: norm.category || '',
      subcategory: norm.subcategory || '',
      brand: norm.brand || '',
      model: norm.model || '',
      hsn: norm.hsn || '',
      qty: Number(norm.qty) || 0,
      unit: norm.unit || 'Nos',
      rate: Number(norm.rate) || 0,
      isTaxInclusive: norm.isTaxInclusive !== false,
      gstRate: Number(norm.gstRate) || 0,
      discount: Number(norm.discount) || 0,
    };
  });

  return {
    customer,
    items,
    transactionType: invoice.transactionType || 'B2C',
    invoiceDate: invoice.invoiceDate || '',
    dueDate: invoice.dueDate || '',
    paymentStatus: invoice.paymentStatus || 'Paid',
    paymentMode: invoice.paymentMode || 'Cash',
    placeOfSupply: invoice.placeOfSupply || '',
    reverseCharge: Boolean(invoice.reverseCharge),
    poNumber: invoice.poNumber || '',
    ewayBillNo: invoice.ewayBillNo || '',
    irn: invoice.irn || '',
    scrapExchange: {
      enabled: Boolean(invoice.scrapExchange?.enabled),
      amount: Number(invoice.scrapExchange?.amount) || 0,
      description: invoice.scrapExchange?.description || '',
    },
    additionalDiscount: Number(invoice.additionalDiscount) || 0,
    roundOffManual: invoice.roundOffManual !== null && invoice.roundOffManual !== undefined ? Number(invoice.roundOffManual) : null,
    notes: (invoice.notes || '').trim(),
  };
}

/**
 * Compares current invoice form state against the last persisted snapshot.
 * Returns true if user has modified any editable fields.
 */
export function isDraftModified(currentInvoice, lastSavedSnapshot) {
  if (!lastSavedSnapshot) {
    // If no previous snapshot exists, check if there is meaningful data to save
    return hasMeaningfulInvoiceData(currentInvoice);
  }

  const currentSnapshot = createDraftSnapshot(currentInvoice);
  return JSON.stringify(currentSnapshot) !== JSON.stringify(lastSavedSnapshot);
}
