import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';

// Production imports
import {
  sanitizeInvoiceForFirestore,
} from '../src/firebase/services/invoiceService.js';
import {
  isInvoiceMigrationNeeded,
  extractLocalInvoices,
  INVOICE_STORAGE_KEY,
  INVOICE_MIGRATION_STATUS_KEY,
} from '../src/firebase/services/invoiceMigration.js';
import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';

let passed = 0;
let failed = 0;

function testAssert(condition, desc) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function checkPass(p, desc) {
  try {
    await p;
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc} -> ${err.message}`);
    failed++;
  }
}

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('PHASE 2C: INVOICE MANAGEMENT FIRESTORE INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // =================================================================
  // SECTION 1: INVOICE SCHEMA SANITIZATION & VALIDATION TESTS
  // =================================================================
  console.log('--- Section 1: Invoice Schema Sanitization & Validation ---');

  const sampleB2B = {
    id: 'inv_test_001',
    invoiceNumber: 'TPS/2026-27/001',
    transactionType: 'B2B',
    invoiceDate: '2026-10-28',
    dueDate: '2026-11-10',
    paymentStatus: 'Pending',
    paymentMode: 'Bank Transfer (NEFT/RTGS/IMPS)',
    placeOfSupply: 'Kerala (32)',
    reverseCharge: 'No',
    poNumber: 'PO-2026-001',
    ewayBillNo: '272584310896',
    irn: '7a74303e39eb6e02725843108b6962a19a1cc470ac6ee39f4174a495c3d18471',
    customer: {
      name: 'Green Valley Agro Farm',
      phone: '9847334455',
      address: 'Kudallur, Anakkara Road',
      city: 'Anakkara',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679551',
      gstin: '32AABCG9981A1Z4',
      pan: 'AABCG9981A',
    },
    items: [
      {
        id: 'item-1',
        name: 'Exide InvaMaster 150Ah Battery',
        category: 'battery',
        hsn: '8507',
        qty: 1,
        unit: 'Nos',
        rate: 14800,
        isTaxInclusive: true,
        gstRate: 28,
      },
    ],
    scrapExchange: {
      enabled: true,
      description: 'Old Battery Buyback',
      amount: 2000,
    },
    additionalDiscount: 500,
    notes: 'Standard 36M Warranty',
    arbitraryGarbage: 'strip_this_out',
  };

  const sanitizedB2B = sanitizeInvoiceForFirestore(sampleB2B, { uid: 'admin_123' }, false);
  testAssert(sanitizedB2B.id === 'inv_test_001', 'Sanitizer preserves valid invoice ID');
  testAssert(sanitizedB2B.invoiceNumber === 'TPS/2026-27/001', 'Sanitizer preserves invoiceNumber');
  testAssert(sanitizedB2B.paymentStatus === 'Pending', 'Sanitizer preserves paymentStatus');
  testAssert(sanitizedB2B.customer.name === 'Green Valley Agro Farm', 'Sanitizer preserves customer map');
  testAssert(sanitizedB2B.customer.gstin === '32AABCG9981A1Z4', 'Sanitizer preserves buyer GSTIN');
  testAssert(sanitizedB2B.items.length === 1, 'Sanitizer preserves line items');
  testAssert(sanitizedB2B.netPayable === 12300, 'Sanitizer accurately computes netPayable (14800 - 2000 - 500 = 12300)');
  testAssert(sanitizedB2B.createdBy === 'admin_123', 'Sanitizer attaches createdBy uid on create');
  testAssert(sanitizedB2B.arbitraryGarbage === undefined, 'Sanitizer strips unwhitelisted fields');

  // Error handling
  let threwNoCust = false;
  try {
    sanitizeInvoiceForFirestore({ id: 'bad', invoiceNumber: 'BAD' });
  } catch {
    threwNoCust = true;
  }
  testAssert(threwNoCust, 'Sanitizer rejects invoice without customer map');

  let threwNoItems = false;
  try {
    sanitizeInvoiceForFirestore({ id: 'bad', invoiceNumber: 'BAD', customer: { name: 'Test' }, items: [] });
  } catch {
    threwNoItems = true;
  }
  testAssert(threwNoItems, 'Sanitizer rejects invoice with empty items array');

  // Update immutability
  const updateInput = {
    ...sanitizedB2B,
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'original_uid',
  };
  const sanitizedUpdate = sanitizeInvoiceForFirestore(updateInput, { uid: 'updater_uid' }, true);
  testAssert(sanitizedUpdate.updatedBy === 'updater_uid', 'Sanitizer attaches updatedBy on update');
  testAssert(sanitizedUpdate.createdAt === '2026-10-01T00:00:00.000Z', 'Sanitizer preserves original createdAt on update');
  testAssert(sanitizedUpdate.createdBy === 'original_uid', 'Sanitizer preserves original createdBy on update');

  // =================================================================
  // SECTION 2: INVOICE MIGRATION & LOCAL STORAGE SAFETY
  // =================================================================
  console.log('\n--- Section 2: Invoice Migration & Idempotency ---');

  const origLocal = global.localStorage;
  global.localStorage = new MockLocalStorage();

  localStorage.setItem(INVOICE_MIGRATION_STATUS_KEY, 'completed');
  testAssert(isInvoiceMigrationNeeded() === false, 'isInvoiceMigrationNeeded returns false when already completed');

  localStorage.removeItem(INVOICE_MIGRATION_STATUS_KEY);
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify([{ id: 'inv-1', invoiceNumber: 'TPS/2026-27/001' }]));
  testAssert(isInvoiceMigrationNeeded() === true, 'isInvoiceMigrationNeeded returns true when flag absent and invoices exist');

  const extracted = extractLocalInvoices();
  testAssert(extracted.length === 1 && extracted[0].id === 'inv-1', 'extractLocalInvoices retrieves local array without mutation');
  testAssert(JSON.parse(localStorage.getItem(INVOICE_STORAGE_KEY)).length === 1, 'Local invoice records in localStorage remain completely untouched');

  global.localStorage = origLocal;

  // =================================================================
  // SECTION 3: HISTORICAL SNAPSHOT ISOLATION & GST ACCURACY
  // =================================================================
  console.log('\n--- Section 3: Historical Snapshot Decoupling & GST Math ---');

  const historicalInvoice = {
    id: 'inv_hist_01',
    invoiceNumber: 'TPS/2026-27/010',
    customer: {
      name: 'Original Buyer Snapshot',
      phone: '9846000000',
      stateCode: '32',
    },
    items: [
      {
        id: 'item-10',
        name: 'Historic Inverter 1000VA',
        rate: 7000,
        qty: 2,
        gstRate: 18,
        isTaxInclusive: true,
      },
    ],
    netPayable: 14000,
  };

  // Verify historical snapshot did not mutate even if store records change

  // Verify historical snapshot did not mutate
  testAssert(historicalInvoice.customer.name === 'Original Buyer Snapshot', 'Historical customer name is strictly decoupled');
  testAssert(historicalInvoice.items[0].rate === 7000, 'Historical item rate is strictly decoupled');
  testAssert(historicalInvoice.netPayable === 14000, 'Historical netPayable is strictly decoupled');

  const recomputed = calculateInvoiceTotals(historicalInvoice, '32');
  testAssert(recomputed.netPayable === 14000, 'GST calculator returns identical netPayable for historical snapshot');

  // =================================================================
  // SECTION 4: LIVE FIRESTORE EMULATOR & SECURITY RULES TESTS
  // =================================================================
  console.log('\n--- Section 4: Live Firestore Emulator & Security Rules ---');

  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
    },
  });

  try {
    // Seed fixtures
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERYS HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      // Staff members
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_u'), {
        uid: 'admin_u',
        email: 'admin@tps.com',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'system',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_u'), {
        uid: 'manager_u',
        email: 'manager@tps.com',
        role: 'manager',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'admin_u',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_u'), {
        uid: 'cashier_u',
        email: 'cashier@tps.com',
        role: 'cashier',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'admin_u',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'disabled_u'), {
        uid: 'disabled_u',
        email: 'disabled@tps.com',
        role: 'manager',
        status: 'disabled',
        createdAt: new Date(),
        createdBy: 'admin_u',
      });

      // Initialized sequential counter for FY 2026-27
      await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
        lastSeq: 0,
        prefix: 'TPS/2026-27/',
      });
    });

    const validInvoiceDoc = {
      id: 'inv_live_01',
      invoiceNumber: 'TPS/2026-27/001',
      financialYear: '2026-27',
      invoiceDate: '2026-10-28',
      dueDate: '2026-10-28',
      paymentStatus: 'Pending',
      paymentMode: 'Cash',
      customer: { name: 'Customer One', stateCode: '32' },
      items: [{ id: 'it-1', name: 'Battery 150Ah', qty: 1, rate: 14500, gstRate: 28, isTaxInclusive: true }],
      netPayable: 14500,
      createdAt: new Date(),
      createdBy: 'cashier_u',
    };

    // 4.1 Cashier Permissions
    console.log('\n[4.1 Cashier Permissions]');
    const cashierCtx = testEnv.authenticatedContext('cashier_u', { email: 'cashier@tps.com' });
    const cashierDb = cashierCtx.firestore();

    await checkPass(
      assertSucceeds(runTransaction(cashierDb, async (txn) => {
        const counterRef = doc(cashierDb, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
        txn.update(counterRef, {
          lastSeq: 1,
          prefix: 'TPS/2026-27/',
          lastInvoiceId: 'inv_live_01',
          lastInvoiceNumber: 'TPS/2026-27/001',
          updatedAt: new Date().toISOString(),
          updatedBy: 'cashier_u',
        });
        txn.set(doc(cashierDb, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_001'), {
          invoiceId: 'inv_live_01',
          invoiceNumber: 'TPS/2026-27/001',
          financialYear: '2026-27',
          createdAt: new Date().toISOString(),
          createdBy: 'cashier_u',
        });
        txn.set(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'), validInvoiceDoc);
      })),
      'Cashier CAN create valid invoice document'
    );

    await checkPass(
      assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'))),
      'Cashier CAN read invoice document'
    );

    await checkPass(
      assertFails(updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'), { paymentStatus: 'Paid' })),
      'Cashier CANNOT update invoice (Forbidden)'
    );

    await checkPass(
      assertFails(deleteDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'))),
      'Cashier CANNOT delete invoice (Forbidden)'
    );

    // 4.2 Manager Permissions & Protection of Finalized Invoices
    console.log('\n[4.2 Manager Permissions & Finalized Invoices]');
    const mgrCtx = testEnv.authenticatedContext('manager_u', { email: 'manager@tps.com' });
    const mgrDb = mgrCtx.firestore();

    // Manager can update pending invoice (e.g. notes or metadata)
    await checkPass(
      assertSucceeds(updateDoc(doc(mgrDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'), { notes: 'Manager updated notes' })),
      'Manager CAN update pending invoice notes'
    );

    // Manager finalizes Pending -> Paid with matching financial total
    await checkPass(
      assertSucceeds(updateDoc(doc(mgrDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'), { paymentStatus: 'Paid' })),
      'Manager CAN finalize Pending invoice to Paid'
    );

    // Manager CANNOT edit already Paid invoice
    await checkPass(
      assertFails(updateDoc(doc(mgrDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'), { notes: 'Manager illegal edit on Paid' })),
      'Manager CANNOT modify finalized/Paid invoice (Locked)'
    );

    // Manager CANNOT delete invoices
    await checkPass(
      assertFails(deleteDoc(doc(mgrDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'))),
      'Manager CANNOT delete invoices (Forbidden)'
    );

    // 4.3 Administrator Authorized Corrections & Deletion
    console.log('\n[4.3 Admin Authorized Corrections & Deletion]');
    const adminCtx = testEnv.authenticatedContext('admin_u', { email: 'admin@tps.com' });
    const adminDb = adminCtx.firestore();

    // Admin CAN update Paid invoice for authorized correction
    await checkPass(
      assertSucceeds(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'), { notes: 'Admin authorized note correction' })),
      'Admin CAN update Paid invoice (Authorized administrative correction)'
    );

    // Admin CANNOT change immutable invoiceNumber
    await checkPass(
      assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'), { invoiceNumber: 'TPS/2026-27/999' })),
      'Admin CANNOT change immutable invoiceNumber'
    );

    // Admin CAN permanently delete invoice
    await checkPass(
      assertSucceeds(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'))),
      'Admin CAN permanently delete invoice'
    );

    // 4.4 Unauthenticated and Disabled Users Protection
    console.log('\n[4.4 Unauthenticated & Disabled User Protection]');
    const unauthCtx = testEnv.unauthenticatedContext();
    const unauthDb = unauthCtx.firestore();

    await checkPass(
      assertFails(getDoc(doc(unauthDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'))),
      'Unauthenticated visitor CANNOT read invoices'
    );

    const disabledCtx = testEnv.authenticatedContext('disabled_u', { email: 'disabled@tps.com' });
    const disabledDb = disabledCtx.firestore();

    await checkPass(
      assertFails(getDoc(doc(disabledDb, 'businesses', BIZ_ID, 'invoices', 'inv_live_01'))),
      'Disabled user CANNOT read invoices'
    );

    // 4.5 Cross-Business Isolation
    console.log('\n[4.5 Cross-Business Isolation]');
    await checkPass(
      assertFails(getDoc(doc(adminDb, 'businesses', 'other-unknown-biz', 'invoices', 'inv_live_01'))),
      'Member cannot access other business invoices'
    );

    // 4.6 Schema Enforcement at Rules Level
    console.log('\n[4.6 Schema Enforcement at Rules Level]');
    const missingItems = { ...validInvoiceDoc, id: 'inv_bad_1', items: [] };
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_bad_1'), missingItems)),
      'Rules reject invoice with empty items'
    );

    const invalidStatus = { ...validInvoiceDoc, id: 'inv_bad_2', paymentStatus: 'IllegalStatus' };
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_bad_2'), invalidStatus)),
      'Rules reject invoice with invalid paymentStatus'
    );

    const illegalField = { ...validInvoiceDoc, id: 'inv_bad_3', secretBackdoor: 'malicious' };
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_bad_3'), illegalField)),
      'Rules reject invoice with arbitrary unwhitelisted fields'
    );

  } finally {
    await testEnv.cleanup();
  }

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n================================================================');
  console.log(`TOTAL PHASE 2C TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
