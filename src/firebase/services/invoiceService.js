/**
 * TPS Battery House — Cloud Firestore Invoice Service
 *
 * Scoped collection: businesses/{businessId}/invoices/{invoiceId}
 * Counter document:  businesses/{businessId}/counters/invoices
 *
 * Enforces strict schema compliance with firestore.rules (isValidInvoice).
 * Guarantees atomic sequential invoice numbering under concurrent multi-user load.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { inferTransactionType, normalizeInvoiceItem } from '../../utils/categories.js';
import { validateInvoiceFinancials, verifyInvoiceFinancialConsistency } from '../../utils/gstCalculations.js';
import { createBusinessSnapshot, DEFAULT_BUSINESS_SETTINGS } from './businessSettingsService.js';

// Pre-calculated set of allowed keys matching firestore.rules
const ALLOWED_INVOICE_KEYS = new Set([
  'id',
  'invoiceNumber',
  'transactionType',
  'invoiceDate',
  'dueDate',
  'paymentStatus',
  'paymentMode',
  'placeOfSupply',
  'reverseCharge',
  'poNumber',
  'ewayBillNo',
  'irn',
  'customer',
  'items',
  'scrapExchange',
  'additionalDiscount',
  'roundOffManual',
  'netPayable',
  'notes',
  'createdAt',
  'savedAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'financialYear',
  'businessSnapshot',
]);

const VALID_STATUSES = new Set(['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled']);

/**
 * Computes Indian Financial Year (Apr 1 to Mar 31) for a given date.
 * Example:
 *   2026-11-04 -> "2026-27"
 *   2027-03-31 -> "2026-27"
 *   2027-04-01 -> "2027-28"
 */
export function getFinancialYear(dateInput = new Date()) {
  const d = typeof dateInput === 'string'
    ? new Date(dateInput.length === 10 ? `${dateInput}T00:00:00Z` : dateInput)
    : (dateInput instanceof Date ? dateInput : new Date());

  const year = isNaN(d.getUTCFullYear()) ? new Date().getUTCFullYear() : d.getUTCFullYear();
  const month = isNaN(d.getUTCMonth()) ? new Date().getUTCMonth() : d.getUTCMonth(); // 0-indexed: 0=Jan, 3=Apr, 11=Dec

  if (month >= 3) {
    const nextYearShort = String((year + 1) % 100).padStart(2, '0');
    return `${year}-${nextYearShort}`;
  } else {
    const curYearShort = String(year % 100).padStart(2, '0');
    return `${year - 1}-${curYearShort}`;
  }
}

/**
 * Formats canonical invoice prefix for a business and date.
 * Automatically adapts prefix across financial year boundaries.
 * Example:
 *   getInvoicePrefix("TPS", "2026-11-04") -> "TPS/2026-27/"
 *   getInvoicePrefix("TPS/2026-27/", "2027-04-01") -> "TPS/2027-28/"
 */
export function getInvoicePrefix(businessPrefix = 'TPS', dateInput = new Date()) {
  const fy = getFinancialYear(dateInput);
  const base = (businessPrefix || 'TPS').split('/')[0].trim();
  return `${base}/${fy}/`;
}

const VALID_PAYMENT_MODES = new Set([
  'Cash',
  'UPI / QR Code',
  'Bank Transfer (NEFT/RTGS/IMPS)',
  'Bank Transfer',
  'Credit / Post-dated',
  'Credit',
  'Cheque',
  'Debit/Credit Card',
]);

/**
 * Validates and sanitizes invoice payload to conform strictly to firestore.rules
 */
export function sanitizeInvoiceForFirestore(rawInvoice, user = null, isUpdate = false) {
  if (!rawInvoice || typeof rawInvoice !== 'object') {
    throw new Error('Invalid invoice payload: expected an object.');
  }

  const id = String(rawInvoice.id || '').trim();
  if (!id || id.length > 64) {
    throw new Error('Invoice id is required and must be between 1 and 64 characters.');
  }

  const invoiceNumber = String(rawInvoice.invoiceNumber || '').trim();
  if (!invoiceNumber || invoiceNumber.length > 64) {
    throw new Error('Invoice number is required and must be between 1 and 64 characters.');
  }

  const invoiceDate = String(rawInvoice.invoiceDate || new Date().toISOString().split('T')[0]).trim();
  const dueDate = String(rawInvoice.dueDate || invoiceDate).trim();

  // Validate paymentStatus
  let paymentStatus = String(rawInvoice.paymentStatus || 'Draft').trim();
  if (!VALID_STATUSES.has(paymentStatus)) {
    paymentStatus = 'Pending';
  }

  // Validate paymentMode
  let paymentMode = String(rawInvoice.paymentMode || 'Cash').trim();
  if (!VALID_PAYMENT_MODES.has(paymentMode)) {
    paymentMode = 'Cash';
  }

  // Validate customer map
  if (!rawInvoice.customer || typeof rawInvoice.customer !== 'object' || !rawInvoice.customer.name) {
    throw new Error('Invoice customer must be a map with a non-empty name.');
  }
  const customerName = String(rawInvoice.customer.name).trim().slice(0, 150);
  if (!customerName) {
    throw new Error('Invoice customer name cannot be blank.');
  }

  const customer = {
    name: customerName,
  };
  if (rawInvoice.customer.phone) customer.phone = String(rawInvoice.customer.phone).trim().slice(0, 25);
  if (rawInvoice.customer.address) customer.address = String(rawInvoice.customer.address).trim().slice(0, 300);
  if (rawInvoice.customer.city) customer.city = String(rawInvoice.customer.city).trim().slice(0, 100);
  if (rawInvoice.customer.district) customer.district = String(rawInvoice.customer.district).trim().slice(0, 100);
  if (rawInvoice.customer.state) customer.state = String(rawInvoice.customer.state).trim().slice(0, 100);
  if (rawInvoice.customer.stateCode) customer.stateCode = String(rawInvoice.customer.stateCode).trim().slice(0, 10);
  if (rawInvoice.customer.pincode) customer.pincode = String(rawInvoice.customer.pincode).trim().slice(0, 20);
  if (rawInvoice.customer.gstin) customer.gstin = String(rawInvoice.customer.gstin).trim().toUpperCase().slice(0, 25);
  if (rawInvoice.customer.pan) customer.pan = String(rawInvoice.customer.pan).trim().toUpperCase().slice(0, 20);
  if (rawInvoice.customer.shippingAddress) customer.shippingAddress = String(rawInvoice.customer.shippingAddress).trim().slice(0, 300);

  // Validate items list
  if (!Array.isArray(rawInvoice.items) || rawInvoice.items.length === 0) {
    throw new Error('Invoice must contain at least 1 item.');
  }
  if (rawInvoice.items.length > 100) {
    throw new Error('Invoice cannot contain more than 100 items.');
  }

  // Strict financial input validation: prevents silent conversion of malformed data into zero
  validateInvoiceFinancials(rawInvoice);

  const normalizedItems = rawInvoice.items.map((item) => normalizeInvoiceItem(item));

  // Strict financial consistency verification:
  // Verifies that calculations, deductions, and tax totals are coherent
  const consistency = verifyInvoiceFinancialConsistency(
    { ...rawInvoice, customer, items: normalizedItems },
    customer.stateCode || '32'
  );
  if (!consistency.isValid) {
    throw new Error(`Financial consistency check failed: ${consistency.error}`);
  }

  // Authoritative final payable amount derived directly from centralized calculation
  const totals = consistency.totals;
  const netPayable = totals.netPayable;

  const sanitized = {
    id,
    invoiceNumber,
    transactionType: rawInvoice.transactionType || inferTransactionType(rawInvoice),
    invoiceDate,
    dueDate,
    paymentStatus,
    paymentMode,
    customer,
    items: normalizedItems,
    netPayable,
    financialYear: rawInvoice.financialYear || getFinancialYear(invoiceDate),
  };

  if (rawInvoice.placeOfSupply) sanitized.placeOfSupply = String(rawInvoice.placeOfSupply).trim().slice(0, 100);
  if (rawInvoice.reverseCharge) sanitized.reverseCharge = String(rawInvoice.reverseCharge).trim().slice(0, 10);
  if (rawInvoice.poNumber) sanitized.poNumber = String(rawInvoice.poNumber).trim().slice(0, 100);
  if (rawInvoice.ewayBillNo) sanitized.ewayBillNo = String(rawInvoice.ewayBillNo).trim().slice(0, 100);
  if (rawInvoice.irn) sanitized.irn = String(rawInvoice.irn).trim().slice(0, 150);
  if (rawInvoice.notes) sanitized.notes = String(rawInvoice.notes).trim().slice(0, 1000);

  if (rawInvoice.scrapExchange && typeof rawInvoice.scrapExchange === 'object') {
    sanitized.scrapExchange = {
      enabled: Boolean(rawInvoice.scrapExchange.enabled),
      amount: Math.max(0, Number(rawInvoice.scrapExchange.amount) || 0),
      description: String(rawInvoice.scrapExchange.description || 'Old Scrap Battery Buyback').slice(0, 200),
    };
  }

  if (rawInvoice.additionalDiscount !== undefined && rawInvoice.additionalDiscount !== null) {
    sanitized.additionalDiscount = Math.max(0, Number(rawInvoice.additionalDiscount) || 0);
  }

  if (rawInvoice.roundOffManual !== undefined && rawInvoice.roundOffManual !== null && rawInvoice.roundOffManual !== '') {
    sanitized.roundOffManual = Number(rawInvoice.roundOffManual);
  }

  if (rawInvoice.businessSnapshot && typeof rawInvoice.businessSnapshot === 'object') {
    sanitized.businessSnapshot = rawInvoice.businessSnapshot;
  }

  // Audit metadata
  const userUid = user?.uid || (typeof user === 'string' ? user : null);

  if (isUpdate) {
    sanitized.updatedAt = new Date().toISOString();
    if (userUid) {
      sanitized.updatedBy = userUid.slice(0, 128);
    } else if (rawInvoice.updatedBy) {
      sanitized.updatedBy = String(rawInvoice.updatedBy).slice(0, 128);
    }

    if (rawInvoice.createdAt) sanitized.createdAt = rawInvoice.createdAt;
    if (rawInvoice.createdBy) sanitized.createdBy = String(rawInvoice.createdBy).slice(0, 128);
    if (rawInvoice.savedAt) sanitized.savedAt = rawInvoice.savedAt;
  } else {
    sanitized.createdAt = rawInvoice.createdAt || new Date().toISOString();
    sanitized.savedAt = rawInvoice.savedAt || new Date().toISOString();
    if (userUid) {
      sanitized.createdBy = userUid.slice(0, 128);
    } else if (rawInvoice.createdBy) {
      sanitized.createdBy = String(rawInvoice.createdBy).slice(0, 128);
    }
  }

  // Strip unwhitelisted fields
  const cleanDoc = {};
  for (const [k, v] of Object.entries(sanitized)) {
    if (ALLOWED_INVOICE_KEYS.has(k) && v !== undefined) {
      cleanDoc[k] = v;
    }
  }

  return cleanDoc;
}

/**
 * Fetch all invoices from Firestore
 */
export async function getInvoices(businessId = DEFAULT_BUSINESS_ID) {
  try {
    const colRef = collection(db, 'businesses', businessId, 'invoices');
    const snapshot = await getDocs(colRef);
    const invoices = [];
    snapshot.forEach((docSnap) => {
      invoices.push({
        ...docSnap.data(),
        id: docSnap.id,
      });
    });
    return invoices;
  } catch (error) {
    console.error(`[InvoiceService] Failed to get invoices for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Fetch a single invoice by ID
 */
export async function getInvoiceById(businessId = DEFAULT_BUSINESS_ID, invoiceId, dbInstance = db) {
  try {
    const docRef = doc(dbInstance, 'businesses', businessId, 'invoices', invoiceId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return {
      ...snap.data(),
      id: snap.id,
    };
  } catch (error) {
    console.error(`[InvoiceService] Failed to get invoice ${invoiceId}:`, error);
    throw error;
  }
}

export { getInvoiceById as getInvoice };

/**
 * Subscribe to invoices collection with realtime onSnapshot
 */
export function subscribeInvoices(businessId = DEFAULT_BUSINESS_ID, onNext, onError) {
  const colRef = collection(db, 'businesses', businessId, 'invoices');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const invoices = [];
      snapshot.forEach((docSnap) => {
        invoices.push({
          ...docSnap.data(),
          id: docSnap.id,
        });
      });
      if (typeof onNext === 'function') {
        onNext(invoices);
      }
    },
    (err) => {
      console.error(`[InvoiceService] Snapshot error on ${businessId}/invoices:`, err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );
}

/**
 * Creates an invoice atomically with a sequential counter to prevent number collisions.
 * Uses Firestore transaction to guarantee that two cashiers never get the same number.
 *
 * Rules:
 * - Scoped to the specific Financial Year (e.g. 2026-27 vs 2027-28).
 * - Drafts do NOT consume permanent sequential numbers.
 * - Cancelled invoice numbers remain reserved (monotonic sequential increment).
 * - Existing historical numbers are preserved without collision.
 */
export async function createInvoiceWithCounter(
  businessId = DEFAULT_BUSINESS_ID,
  invoiceData,
  user = null,
  options = { prefix: 'TPS' }
) {
  const firestoreDb = options?.dbInstance || db;
  const invoiceDate = invoiceData.invoiceDate || new Date().toISOString().split('T')[0];
  const fy = getFinancialYear(invoiceDate);
  const prefix = getInvoicePrefix(options.prefix || 'TPS', invoiceDate);

  const counterId = `invoices_${fy}`;
  const counterRef = doc(firestoreDb, 'businesses', businessId, 'counters', counterId);
  const legacyCounterRef = doc(firestoreDb, 'businesses', businessId, 'counters', 'invoices');

  const isDraft = invoiceData.paymentStatus === 'Draft';
  const hasExistingPermanentNum = invoiceData.invoiceNumber &&
    !invoiceData.invoiceNumber.startsWith('DRAFT') &&
    !invoiceData.invoiceNumber.endsWith('/000') &&
    invoiceData.invoiceNumber.includes('/');

  // 1. If it's a Draft and does NOT have a permanent historical number, do NOT consume counter sequence
  if (isDraft && !hasExistingPermanentNum) {
    const draftNumber = invoiceData.invoiceNumber && invoiceData.invoiceNumber.startsWith('DRAFT')
      ? invoiceData.invoiceNumber
      : `DRAFT-${Date.now().toString().slice(-6)}`;

    const invoiceId = invoiceData.id || `inv_draft_${Date.now()}`;
    const invoiceDocRef = doc(firestoreDb, 'businesses', businessId, 'invoices', invoiceId);

    const snapshot = invoiceData.businessSnapshot ||
      (options?.business ? createBusinessSnapshot(options.business) : createBusinessSnapshot(DEFAULT_BUSINESS_SETTINGS));

    const sanitized = sanitizeInvoiceForFirestore(
      {
        ...invoiceData,
        id: invoiceId,
        invoiceNumber: draftNumber,
        businessSnapshot: snapshot,
      },
      user,
      false
    );

    await setDoc(invoiceDocRef, sanitized);
    return sanitized;
  }

  // 2. Non-draft invoice (or draft with established number): allocate sequential number via transaction
  // Wrapped in a jittered retry loop to resolve concurrent counter contention gracefully
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await runTransaction(firestoreDb, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const legacySnap = await transaction.get(legacyCounterRef);
        let nextSeq = 1;

        if (counterSnap.exists()) {
          const data = counterSnap.data();
          const currentSeq = Number(data.lastSeq) || 0;
          nextSeq = currentSeq + 1;
        } else {
          // If counter is not initialized, check legacy counter fallback
          if (legacySnap.exists() && legacySnap.data().prefix === prefix) {
            nextSeq = (Number(legacySnap.data().lastSeq) || 0) + 1;
          } else {
            // Counter is uninitialized
            nextSeq = 1;
          }
        }

        // Determine final invoice number:
        let finalInvNumber = invoiceData.invoiceNumber;
        const isPlaceholder = !finalInvNumber ||
          finalInvNumber.startsWith('DRAFT') ||
          finalInvNumber.endsWith('/000') ||
          !finalInvNumber.includes('/');

        if (isPlaceholder) {
          finalInvNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;
        } else {
          // If user supplied an explicit invoice number, update counter to at least that number
          const numMatch = finalInvNumber.match(/(\d+)$/);
          if (numMatch) {
            const parsedNum = parseInt(numMatch[1], 10);
            if (!isNaN(parsedNum) && parsedNum >= nextSeq) {
              nextSeq = parsedNum;
            }
          }
        }

        const invoiceId = invoiceData.id || `inv_${Date.now()}_${String(nextSeq).padStart(3, '0')}`;
        const invoiceDocRef = doc(firestoreDb, 'businesses', businessId, 'invoices', invoiceId);

        const snapshot = invoiceData.businessSnapshot ||
          (options?.business ? createBusinessSnapshot(options.business) : createBusinessSnapshot(DEFAULT_BUSINESS_SETTINGS));

        // Sanitize payload strictly according to firestore.rules
        const sanitized = sanitizeInvoiceForFirestore(
          {
            ...invoiceData,
            id: invoiceId,
            invoiceNumber: finalInvNumber,
            financialYear: fy,
            businessSnapshot: snapshot,
          },
          user,
          false
        );

        // Uniqueness reservation reference and check
        const safeNum = finalInvNumber.replace(/\//g, '_');
        const reservationRef = doc(firestoreDb, 'businesses', businessId, 'invoice_numbers', safeNum);
        const reservationSnap = await transaction.get(reservationRef);
        if (reservationSnap.exists()) {
          throw new Error(`Invoice number "${finalInvNumber}" is already in use and cannot be duplicated.`);
        }

        // Atomic write of invoice, counter increment, and invoice number reservation
        const counterData = {
          lastSeq: nextSeq,
          prefix,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid || 'system',
          lastInvoiceId: invoiceId,
          lastInvoiceNumber: finalInvNumber,
        };

        const reservationData = {
          invoiceId,
          invoiceNumber: finalInvNumber,
          financialYear: fy,
          createdAt: sanitized.createdAt || new Date().toISOString(),
          createdBy: user?.uid || 'system',
        };

        transaction.set(counterRef, counterData, { merge: true });
        if (legacySnap.exists() && legacySnap.data().prefix === prefix) {
          transaction.set(legacyCounterRef, counterData, { merge: true });
        }
        transaction.set(reservationRef, reservationData);
        transaction.set(invoiceDocRef, sanitized);

        return sanitized;
      });
    } catch (txnError) {
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1) + Math.floor(Math.random() * 50)));
        continue;
      }
      throw txnError;
    }
  }
}

/**
 * Direct create of an invoice (e.g. when importing an existing historical invoice with known ID & number)
 */
export async function createInvoice(businessId = DEFAULT_BUSINESS_ID, invoiceData, user = null) {
  try {
    const invoiceId = invoiceData.id || `inv_${Date.now()}`;
    const snapshot = invoiceData.businessSnapshot || createBusinessSnapshot(DEFAULT_BUSINESS_SETTINGS);
    const sanitized = sanitizeInvoiceForFirestore(
      { ...invoiceData, id: invoiceId, businessSnapshot: snapshot },
      user,
      false
    );

    const docRef = doc(db, 'businesses', businessId, 'invoices', invoiceId);
    await setDoc(docRef, sanitized);
    return sanitized;
  } catch (error) {
    console.error(`[InvoiceService] Failed to create invoice:`, error);
    throw error;
  }
}

/**
 * Update an existing invoice in Firestore
 */
export async function updateInvoice(
  businessId = DEFAULT_BUSINESS_ID,
  invoiceId,
  updateData,
  user = null,
  dbInstance = db
) {
  try {
    if (!invoiceId) {
      throw new Error('invoiceId is required for update.');
    }

    // Enforce businessSnapshot immutability at service layer
    if (updateData && 'businessSnapshot' in updateData) {
      const docRef = doc(dbInstance, 'businesses', businessId, 'invoices', invoiceId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().businessSnapshot) {
        const existingSnapshot = snap.data().businessSnapshot;
        const incomingSnapshot = updateData.businessSnapshot;
        if (JSON.stringify(existingSnapshot) !== JSON.stringify(incomingSnapshot)) {
          throw new Error('Historical businessSnapshot on an invoice is immutable and cannot be modified.');
        }
      }
    }

    const sanitized = sanitizeInvoiceForFirestore(
      { ...updateData, id: invoiceId },
      user,
      true
    );

    const docRef = doc(dbInstance, 'businesses', businessId, 'invoices', invoiceId);
    await updateDoc(docRef, sanitized);
    return sanitized;
  } catch (error) {
    console.error(`[InvoiceService] Failed to update invoice ${invoiceId}:`, error);
    throw error;
  }
}

/**
 * Update only payment status of an invoice.
 * If transitioning from a temporary Draft to an active status (Pending/Paid),
 * atomically allocates the permanent sequential invoice number.
 */
export async function updateInvoicePaymentStatus(
  businessId = DEFAULT_BUSINESS_ID,
  invoiceId,
  newStatus,
  user = null
) {
  if (!VALID_STATUSES.has(newStatus)) {
    throw new Error(`Invalid paymentStatus: ${newStatus}`);
  }

  const docRef = doc(db, 'businesses', businessId, 'invoices', invoiceId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error(`Invoice ${invoiceId} not found.`);
  }

  const existingData = snap.data();
  const isDraftNumber = existingData.invoiceNumber && existingData.invoiceNumber.startsWith('DRAFT');

  // If transitioning from temporary DRAFT number to active status, allocate sequential number
  if (isDraftNumber && newStatus !== 'Draft') {
    const invoiceDate = existingData.invoiceDate || new Date().toISOString().split('T')[0];
    const fy = getFinancialYear(invoiceDate);
    const prefix = getInvoicePrefix('TPS', invoiceDate);
    const counterRef = doc(db, 'businesses', businessId, 'counters', `invoices_${fy}`);
    const legacyCounterRef = doc(db, 'businesses', businessId, 'counters', 'invoices');

    return await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let nextSeq = 1;
      if (counterSnap.exists()) {
        nextSeq = (Number(counterSnap.data().lastSeq) || 0) + 1;
      } else {
        const legacySnap = await transaction.get(legacyCounterRef);
        if (legacySnap.exists() && legacySnap.data().prefix === prefix) {
          nextSeq = (Number(legacySnap.data().lastSeq) || 0) + 1;
        }
      }

      const allocatedNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;
      const counterData = {
        lastSeq: nextSeq,
        prefix,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system',
      };

      transaction.set(counterRef, counterData, { merge: true });
      transaction.set(legacyCounterRef, counterData, { merge: true });

      const updatePayload = {
        paymentStatus: newStatus,
        invoiceNumber: allocatedNumber,
        updatedAt: new Date().toISOString(),
      };
      if (user?.uid) updatePayload.updatedBy = user.uid;

      transaction.update(docRef, updatePayload);
      return { success: true, id: invoiceId, paymentStatus: newStatus, invoiceNumber: allocatedNumber };
    });
  }

  const updatePayload = {
    paymentStatus: newStatus,
    updatedAt: new Date().toISOString(),
  };
  if (user?.uid) {
    updatePayload.updatedBy = user.uid;
  }

  await updateDoc(docRef, updatePayload);
  return { success: true, id: invoiceId, paymentStatus: newStatus };
}

/**
 * Permanently delete an invoice (Admin only)
 */
export async function deleteInvoice(businessId = DEFAULT_BUSINESS_ID, invoiceId) {
  try {
    if (!invoiceId) {
      throw new Error('invoiceId is required for deletion.');
    }
    const docRef = doc(db, 'businesses', businessId, 'invoices', invoiceId);
    await deleteDoc(docRef);
    return { success: true, id: invoiceId };
  } catch (error) {
    console.error(`[InvoiceService] Failed to delete invoice ${invoiceId}:`, error);
    throw error;
  }
}

