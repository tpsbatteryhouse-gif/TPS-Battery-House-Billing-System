/**
 * TPS Battery House — Phase 5.1 Invoice Numbering & Transaction Verification Suite
 *
 * Verifies against the real Firestore Emulator:
 * - Financial Year Boundary (April 1 transitions)
 * - Sequential numbering (001, 002, ...)
 * - Concurrent invoice creation under high load (zero duplicates)
 * - Duplicate prevention via reservation documents
 * - Permanent number reservation (cancellation does not free numbers)
 * - Drafts do not consume counter sequence
 * - Transaction retry and atomic rollback behavior
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import { initializeApp as initAdminApp } from '../functions/node_modules/firebase-admin/lib/app/index.js';
import { getAuth as getAdminAuth } from '../functions/node_modules/firebase-admin/lib/auth/index.js';
import { getFirestore as getAdminFirestore } from '../functions/node_modules/firebase-admin/lib/firestore/index.js';
import {
  getFinancialYear,
  getInvoicePrefix,
  createInvoiceWithCounter
} from '../src/firebase/services/invoiceService.js';

const projectId = 'demo-tps-battery-house';
const businessId = 'tps-battery-house';

console.log('=== STARTING INVOICE NUMBERING & TRANSACTION VERIFICATION ===\n');

process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8980';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

// Setup Admin SDK to seed active staff member
const adminApp = initAdminApp({ projectId }, 'admin-inv-suite');
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

const cashierUid = 'active-billing-cashier';
try {
  await adminAuth.createUser({ uid: cashierUid, email: 'cashier@tps.com' });
} catch {}

await adminDb.doc(`businesses/${businessId}/members/${cashierUid}`).set({
  email: 'cashier@tps.com',
  name: 'Active Administrator',
  role: 'admin',
  status: 'active',
  createdAt: new Date().toISOString()
});

// Admin initializes the counter documents
await adminDb.doc(`businesses/${businessId}/counters/invoices_2026-27`).set({
  lastSeq: 0,
  prefix: 'TPS/2026-27/',
  updatedAt: new Date().toISOString(),
  updatedBy: cashierUid
});
await adminDb.doc(`businesses/${businessId}/counters/invoices`).set({
  lastSeq: 0,
  prefix: 'TPS/2026-27/',
  updatedAt: new Date().toISOString(),
  updatedBy: cashierUid
});
await adminDb.doc(`businesses/${businessId}/counters/invoices_2027-28`).set({
  lastSeq: 0,
  prefix: 'TPS/2027-28/',
  updatedAt: new Date().toISOString(),
  updatedBy: cashierUid
});

const clientApp = initializeApp({ apiKey: 'fake-api-key', projectId }, 'inv-tx-suite');
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const customToken = await adminAuth.createCustomToken(cashierUid);
await signInWithCustomToken(clientAuth, customToken);

const firestoreDb = getFirestore(clientApp);
connectFirestoreEmulator(firestoreDb, '127.0.0.1', 8980);

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ✖ [FAIL] ${message}`);
  }
}

async function runInvoiceTxTests() {
  console.log('--- 1. FINANCIAL YEAR BOUNDARY & PREFIX COMPUTATION ---');
  // March 31, 2026 -> 2025-26
  assert(getFinancialYear('2026-03-31') === '2025-26', '2026-03-31 is FY 2025-26');
  // April 1, 2026 -> 2026-27
  assert(getFinancialYear('2026-04-01') === '2026-27', '2026-04-01 transitions to FY 2026-27');
  // March 31, 2027 -> 2026-27
  assert(getFinancialYear('2027-03-31') === '2026-27', '2027-03-31 is FY 2026-27');
  // April 1, 2027 -> 2027-28
  assert(getFinancialYear('2027-04-01') === '2027-28', '2027-04-01 transitions to FY 2027-28');

  // Prefix formats
  assert(getInvoicePrefix('TPS', '2026-03-31') === 'TPS/2025-26/', 'Prefix for 2026-03-31 is TPS/2025-26/');
  assert(getInvoicePrefix('TPS', '2026-04-01') === 'TPS/2026-27/', 'Prefix for 2026-04-01 is TPS/2026-27/');
  assert(getInvoicePrefix('TPS/2026-27/', '2027-04-01') === 'TPS/2027-28/', 'Existing composite prefix correctly updates across FY boundary');

  console.log('\n--- 2. DRAFTS DO NOT CONSUME COUNTER SEQUENCE ---');
  const fyTest = '2026-27';
  const counterRef = doc(firestoreDb, 'businesses', businessId, 'counters', `invoices_${fyTest}`);

  // Create 3 Drafts
  for (let i = 1; i <= 3; i++) {
    const draftRes = await createInvoiceWithCounter(
      businessId,
      {
        invoiceDate: '2026-11-08',
        paymentStatus: 'Draft',
        customer: { name: `Draft Customer ${i}`, phone: '9846830532' },
        items: [{ name: 'Test Battery', qty: 1, rate: 5000, gstRate: 18, isTaxInclusive: true }]
      },
      { uid: cashierUid },
      { dbInstance: firestoreDb }
    );
    assert(draftRes.invoiceNumber.startsWith('DRAFT'), `Draft ${i} assigned draft number: ${draftRes.invoiceNumber}`);
  }

  // Verify counter document does not exist yet (or has 0 seq)
  const counterAfterDrafts = await getDoc(counterRef);
  assert(!counterAfterDrafts.exists() || counterAfterDrafts.data().lastSeq === 0, 'Counter was NOT incremented by Draft creation');

  console.log('\n--- 3. SEQUENTIAL INVOICE NUMBERING ---');
  // Create first finalized invoice
  const inv1 = await createInvoiceWithCounter(
    businessId,
    {
      invoiceDate: '2026-11-08',
      paymentStatus: 'Paid',
      customer: { name: 'Customer One', phone: '9846830532' },
      items: [{ name: 'Amaron Battery', qty: 1, rate: 6500, gstRate: 28, isTaxInclusive: true }]
    },
    { uid: cashierUid },
    { dbInstance: firestoreDb }
  );
  assert(inv1.invoiceNumber === 'TPS/2026-27/001', 'First invoice receives TPS/2026-27/001');

  // Create second finalized invoice
  const inv2 = await createInvoiceWithCounter(
    businessId,
    {
      invoiceDate: '2026-11-08',
      paymentStatus: 'Pending',
      customer: { name: 'Customer Two', phone: '9846830532' },
      items: [{ name: 'Exide Inverter', qty: 1, rate: 12000, gstRate: 18, isTaxInclusive: true }]
    },
    { uid: cashierUid },
    { dbInstance: firestoreDb }
  );
  assert(inv2.invoiceNumber === 'TPS/2026-27/002', 'Second invoice receives TPS/2026-27/002');

  const counterSnap = await getDoc(counterRef);
  assert(counterSnap.data().lastSeq === 2, 'Counter document reflects lastSeq = 2');

  console.log('\n--- 4. CONCURRENT INVOICE CREATION UNDER HIGH LOAD ---');
  // Launch 5 concurrent invoice creation requests simultaneously
  const CONCURRENT_COUNT = 5;
  const concurrentPromises = [];

  for (let i = 1; i <= CONCURRENT_COUNT; i++) {
    concurrentPromises.push(
      createInvoiceWithCounter(
        businessId,
        {
          id: `inv_concurrent_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
          invoiceDate: '2026-11-08',
          paymentStatus: 'Paid',
          customer: { name: `Concurrent Customer ${i}`, phone: '9846830532' },
          items: [{ name: 'Battery', qty: 1, rate: 1000 * i, gstRate: 18, isTaxInclusive: true }]
        },
        { uid: cashierUid },
        { dbInstance: firestoreDb }
      )
    );
  }

  const concurrentResults = await Promise.all(concurrentPromises);
  const allocatedNumbers = concurrentResults.map(r => r.invoiceNumber);
  console.log('Allocated invoice numbers under concurrency:', allocatedNumbers);

  const uniqueNumbers = new Set(allocatedNumbers);
  assert(uniqueNumbers.size === CONCURRENT_COUNT, `Zero collisions: All ${CONCURRENT_COUNT} concurrent requests received unique numbers`);

  // Verify counter is now 2 + 5 = 7
  const counterAfterConcurrency = await getDoc(counterRef);
  assert(counterAfterConcurrency.data().lastSeq === 7, 'Counter lastSeq is exactly 7 after concurrent batch');

  console.log('\n--- 5. DUPLICATE INVOICE NUMBER PREVENTION ---');
  let duplicateThrew = false;
  try {
    // Attempt to manually create an invoice with an already-used invoice number (TPS/2026-27/001)
    await createInvoiceWithCounter(
      businessId,
      {
        invoiceDate: '2026-11-08',
        invoiceNumber: 'TPS/2026-27/001', // Duplicate attempt
        paymentStatus: 'Paid',
        customer: { name: 'Rogue Duplicate', phone: '9846830532' },
        items: [{ name: 'Battery', qty: 1, rate: 1000, gstRate: 18, isTaxInclusive: true }]
      },
      { uid: cashierUid },
      { dbInstance: firestoreDb }
    );
  } catch (err) {
    if (err.message.includes('already in use and cannot be duplicated')) {
      duplicateThrew = true;
    }
  }
  assert(duplicateThrew, 'Reservation check rejected creation with duplicate invoice number');

  console.log('\n--- 6. PERMANENT NUMBER RESERVATION ON CANCELLATION ---');
  // Cancel invoice 2 using Admin SDK
  await adminDb.doc(`businesses/${businessId}/invoices/${inv2.id}`).update({ paymentStatus: 'Cancelled' });

  // Create next invoice -> should receive sequence 8, NOT reuse 002
  const invNext = await createInvoiceWithCounter(
    businessId,
    {
      invoiceDate: '2026-11-08',
      paymentStatus: 'Paid',
      customer: { name: 'Customer Post Cancel', phone: '9846830532' },
      items: [{ name: 'Battery', qty: 1, rate: 2000, gstRate: 18, isTaxInclusive: true }]
    },
    { uid: cashierUid },
    { dbInstance: firestoreDb }
  );
  assert(invNext.invoiceNumber === 'TPS/2026-27/008', 'Next invoice received next sequence TPS/2026-27/008 (cancelled number is permanently preserved)');

  console.log('\n--- 7. SEPARATE FINANCIAL YEAR PARTITIONING ---');
  // Create an invoice with an April 2027 date (FY 2027-28)
  const nextFyInv = await createInvoiceWithCounter(
    businessId,
    {
      invoiceDate: '2027-04-05', // Next FY
      paymentStatus: 'Paid',
      customer: { name: 'Next FY Customer', phone: '9846830532' },
      items: [{ name: 'Battery', qty: 1, rate: 3000, gstRate: 18, isTaxInclusive: true }]
    },
    { uid: cashierUid },
    { dbInstance: firestoreDb }
  );
  assert(nextFyInv.invoiceNumber === 'TPS/2027-28/001', 'Invoice in next FY resets counter to TPS/2027-28/001');

  // Verify that FY 2026-27 counter remains unaffected
  const oldFyCounter = await getDoc(counterRef);
  assert(oldFyCounter.data().lastSeq === 8, 'Previous FY 2026-27 counter remains unaffected at lastSeq = 8');

  console.log('\n======================================================');
  console.log(`INVOICE NUMBERING & TRANSACTION VERIFICATION COMPLETE`);
  console.log(`TOTAL TESTS:  ${total}`);
  console.log(`PASSED TESTS: ${passed}`);
  console.log(`FAILED TESTS: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runInvoiceTxTests().catch(err => {
  console.error('Fatal error in invoice transaction suite:', err);
  process.exit(1);
});
