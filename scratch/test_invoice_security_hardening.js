/**
 * Phase 2C.2: Invoice Security Hardening Test Suite
 *
 * Verifies:
 * 1. Cashier & Manager Counter Manipulation Protection (Monotonic +1 only, no reset, no arbitrary jump)
 * 2. Counter Creation Restricted Exclusively to Admin
 * 3. Billing Blocked Before Counter Initialization (Enforced at Security Rules level)
 * 4. Billing Blocked During Active In-Progress Migration
 * 5. Draft Invoices Allowed Without Counter Initialization
 * 6. Atomic Migration Locking (Unique ownerToken, lease expiration, heartbeat renewal, expired lock recovery)
 * 7. Simultaneous Migration Prevention Between Two Admins
 * 8. Multi-Financial-Year Migration (2025-26, 2026-27, 2027-28) with Independent Counters
 * 9. Duplicate & Malformed Invoice Number Detection & Reporting
 * 10. Interrupted Migration Safe Recovery & Idempotency
 */

import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';

// Production imports
import {
  sanitizeInvoiceForFirestore,
} from '../src/firebase/services/invoiceService.js';
import {
  acquireMigrationLock,
  renewMigrationLock,
  releaseMigrationLock,
  migrateLocalInvoicesToFirestore,
  INVOICE_STORAGE_KEY,
  INVOICE_MIGRATION_STATUS_KEY,
} from '../src/firebase/services/invoiceMigration.js';

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

// Mock localStorage for Node.js
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

async function runHardeningSuite() {
  console.log('================================================================');
  console.log('PHASE 2C.2: INVOICE SECURITY HARDENING TEST SUITE');
  console.log('================================================================\n');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  await testEnv.clearFirestore();

  // Seed business and staff members
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERYS HOUSE',
      gstin: '32ABCDE1234F1Z5',
    });
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin-uid'), {
      uid: 'admin-uid',
      email: 'admin@tps.com',
      displayName: 'Store Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin-2'), {
      uid: 'admin-2',
      email: 'admin2@tps.com',
      displayName: 'Second Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'manager-uid'), {
      uid: 'manager-uid',
      email: 'manager@tps.com',
      displayName: 'Store Manager',
      role: 'manager',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
    });
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'cashier-uid'), {
      uid: 'cashier-uid',
      email: 'cashier@tps.com',
      displayName: 'Counter Cashier',
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
    });

    // Seed initialized counter for 2026-27 at lastSeq: 10
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 10,
      prefix: 'TPS/2026-27/',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    });
  });

  const adminClient = testEnv.authenticatedContext('admin-uid').firestore();
  const admin2Client = testEnv.authenticatedContext('admin-2').firestore();
  const managerClient = testEnv.authenticatedContext('manager-uid').firestore();
  const cashierClient = testEnv.authenticatedContext('cashier-uid').firestore();

  // =================================================================
  // SECTION 1: HARDENED COUNTER SECURITY & MANIPULATION RESISTANCE
  // =================================================================
  console.log('--- Section 1: Counter Security & Anti-Manipulation ---');

  // 1.1 Non-admins cannot create a counter from scratch
  await assertFails(
    setDoc(doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2029-30'), {
      lastSeq: 1,
      prefix: 'TPS/2029-30/',
      updatedAt: new Date().toISOString(),
      updatedBy: 'cashier-uid',
    })
  );
  testAssert(true, 'Cashier CANNOT create new counter document from scratch (Admin-only creation)');

  await assertFails(
    setDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', 'invoices_2029-30'), {
      lastSeq: 1,
      prefix: 'TPS/2029-30/',
      updatedAt: new Date().toISOString(),
      updatedBy: 'manager-uid',
    })
  );
  testAssert(true, 'Manager CANNOT create new counter document from scratch (Admin-only creation)');

  // 1.2 Admin can create new counter document
  await assertSucceeds(
    setDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2029-30'), {
      lastSeq: 0,
      prefix: 'TPS/2029-30/',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    })
  );
  testAssert(true, 'Admin CAN initialize new counter document');

  // 1.3 Cashier CANNOT arbitrarily jump lastSeq (e.g. from 10 to 500)
  await assertFails(
    updateDoc(doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 500,
      updatedAt: new Date().toISOString(),
      updatedBy: 'cashier-uid',
    })
  );
  testAssert(true, 'Cashier CANNOT jump counter by +490 (Arbitrary jump rejected)');

  // 1.4 Cashier CANNOT decrease or reset lastSeq (e.g. from 10 to 5, or 10 to 0)
  await assertFails(
    updateDoc(doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 5,
      updatedAt: new Date().toISOString(),
      updatedBy: 'cashier-uid',
    })
  );
  testAssert(true, 'Cashier CANNOT decrease counter (Counter rollback rejected)');

  await assertFails(
    updateDoc(doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 0,
      updatedAt: new Date().toISOString(),
      updatedBy: 'cashier-uid',
    })
  );
  testAssert(true, 'Cashier CANNOT reset counter to 0 (Counter reset rejected)');

  // 1.5 Cashier CAN increment by exactly +1 (10 -> 11) atomically linked to a valid invoice
  await assertSucceeds(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_c1_11');

      transaction.update(counterRef, {
        lastSeq: 11,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_c1_11',
        lastInvoiceNumber: 'TPS/2026-27/011',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      const invPayload = sanitizeInvoiceForFirestore({
        id: 'inv_c1_11',
        invoiceNumber: 'TPS/2026-27/011',
        invoiceDate: '2026-11-04',
        financialYear: '2026-27',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Cashier Buyer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });

      transaction.set(doc(cashierClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_011'), {
        invoiceId: 'inv_c1_11',
        invoiceNumber: 'TPS/2026-27/011',
        financialYear: '2026-27',
        createdAt: invPayload.createdAt,
        createdBy: 'cashier-uid',
      });
      transaction.set(invRef, invPayload);
    })
  );
  testAssert(true, 'Cashier CAN increment counter by exactly +1 (Monotonic sequential with matching invoice)');

  // 1.6 Manager CANNOT arbitrarily jump lastSeq
  await assertFails(
    updateDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 999,
      updatedAt: new Date().toISOString(),
      updatedBy: 'manager-uid',
    })
  );
  testAssert(true, 'Manager CANNOT jump counter arbitrarily');

  // 1.7 Manager CAN increment by exactly +1 (11 -> 12) atomically linked to a valid invoice
  await assertSucceeds(
    runTransaction(managerClient, async (transaction) => {
      const counterRef = doc(managerClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'inv_m1_12');

      transaction.update(counterRef, {
        lastSeq: 12,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_m1_12',
        lastInvoiceNumber: 'TPS/2026-27/012',
        updatedAt: new Date().toISOString(),
        updatedBy: 'manager-uid',
      });

      const invPayload = sanitizeInvoiceForFirestore({
        id: 'inv_m1_12',
        invoiceNumber: 'TPS/2026-27/012',
        invoiceDate: '2026-11-04',
        financialYear: '2026-27',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Manager Buyer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'manager-uid' });

      transaction.set(doc(managerClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_012'), {
        invoiceId: 'inv_m1_12',
        invoiceNumber: 'TPS/2026-27/012',
        financialYear: '2026-27',
        createdAt: invPayload.createdAt,
        createdBy: 'manager-uid',
      });
      transaction.set(invRef, invPayload);
    })
  );
  testAssert(true, 'Manager CAN increment counter by exactly +1');

  // 1.8 Admin can make authorized adjustments (e.g. during migration seed)
  await assertSucceeds(
    updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 50,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    })
  );
  testAssert(true, 'Admin CAN update counter for authorized maintenance/migration');

  // =================================================================
  // SECTION 2: PREVENT BILLING BEFORE COUNTER INITIALIZATION
  // =================================================================
  console.log('\n--- Section 2: Prevent Billing Before Counter Initialization ---');

  // 2.1 Cashier tries to create permanent invoice for FY 2028-29 (counter NOT initialized)
  const uninitializedInvoicePayload = sanitizeInvoiceForFirestore({
    id: 'inv-uninit-01',
    invoiceNumber: 'TPS/2028-29/001',
    invoiceDate: '2028-05-10',
    paymentStatus: 'Pending',
    paymentMode: 'Cash',
    customer: { name: 'Eager Buyer' },
    items: [{ name: 'Battery', rate: 10000, qty: 1 }],
  }, { uid: 'cashier-uid' });

  await assertFails(
    setDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv-uninit-01'), uninitializedInvoicePayload)
  );
  testAssert(true, 'Cashier CANNOT create permanent invoice for uninitialized FY 2028-29 (Blocked by rules)');

  // 2.2 Manager also blocked from uninitialized FY
  await assertFails(
    setDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'inv-uninit-02'), {
      ...uninitializedInvoicePayload,
      id: 'inv-uninit-02',
    })
  );
  testAssert(true, 'Manager CANNOT create permanent invoice for uninitialized FY 2028-29 (Blocked by rules)');

  // 2.3 Draft invoice for uninitialized FY CAN be saved (Draft exemption)
  const draftPayload = sanitizeInvoiceForFirestore({
    id: 'inv-draft-future',
    invoiceNumber: 'DRAFT-998877',
    invoiceDate: '2028-05-10',
    paymentStatus: 'Draft',
    customer: { name: 'Provisional Draft Customer' },
    items: [{ name: 'Battery', rate: 10000, qty: 1 }],
  }, { uid: 'cashier-uid' });

  await assertSucceeds(
    setDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv-draft-future'), draftPayload)
  );
  testAssert(true, 'Cashier CAN save Draft invoice for uninitialized FY without error');

  // 2.4 Permanent invoice for INITIALIZED FY 2026-27 succeeds via atomic transaction
  await assertSucceeds(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv-init-ok');

      transaction.update(counterRef, {
        lastSeq: 51,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv-init-ok',
        lastInvoiceNumber: 'TPS/2026-27/051',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      const initializedInvoicePayload = sanitizeInvoiceForFirestore({
        id: 'inv-init-ok',
        invoiceNumber: 'TPS/2026-27/051',
        invoiceDate: '2026-11-04',
        financialYear: '2026-27',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Standard Customer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });

      transaction.set(doc(cashierClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_051'), {
        invoiceId: 'inv-init-ok',
        invoiceNumber: 'TPS/2026-27/051',
        financialYear: '2026-27',
        createdAt: initializedInvoicePayload.createdAt,
        createdBy: 'cashier-uid',
      });
      transaction.set(invRef, initializedInvoicePayload);
    })
  );
  testAssert(true, 'Cashier CAN create permanent invoice for initialized FY 2026-27');

  // =================================================================
  // SECTION 3: ATOMIC MIGRATION LOCKING & MULTI-ADMIN CONCURRENCY
  // =================================================================
  console.log('\n--- Section 3: Atomic Migration Locking with Lease & Token ---');

  // 3.1 Admin 1 acquires atomic lock
  const lock1 = await acquireMigrationLock(BIZ_ID, { uid: 'admin-uid' }, adminClient);
  testAssert(lock1.success === true, 'Admin 1 successfully acquires migration lock');
  testAssert(typeof lock1.ownerToken === 'string' && lock1.ownerToken.startsWith('mig_'), 'Unique ownerToken generated');
  testAssert(typeof lock1.leaseExpiresAt === 'string', 'Lease expiration timestamp set');

  // 3.2 Admin 2 attempts concurrent lock acquisition -> REJECTED
  const lock2 = await acquireMigrationLock(BIZ_ID, { uid: 'admin-2' }, admin2Client);
  testAssert(lock2.success === false, 'Admin 2 lock attempt fails while Admin 1 holds active lease');
  testAssert(lock2.locked === true, 'Lock state reported as actively locked');
  testAssert(lock2.activeOwner === 'admin-uid', 'Active lock owner correctly identified as admin-uid');

  // 3.3 Non-admin billing BLOCKED during active migration
  const billingDuringMigrationPayload = sanitizeInvoiceForFirestore({
    id: 'inv-during-mig',
    invoiceNumber: 'TPS/2026-27/052',
    invoiceDate: '2026-11-04',
    paymentStatus: 'Pending',
    customer: { name: 'Blocked Buyer' },
    items: [{ name: 'Battery', rate: 10000, qty: 1 }],
  }, { uid: 'cashier-uid' });

  await assertFails(
    setDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv-during-mig'), billingDuringMigrationPayload)
  );
  testAssert(true, 'Cashier billing is BLOCKED while migration status is in_progress');

  // 3.4 Lease Heartbeat Renewal
  const renewal = await renewMigrationLock(BIZ_ID, lock1.ownerToken, { uid: 'admin-uid' }, adminClient);
  testAssert(renewal.success === true, 'Admin 1 successfully renews lease heartbeat');

  // 3.5 Releasing lock with wrong token -> FAILS
  let releaseError = false;
  try {
    await releaseMigrationLock(BIZ_ID, 'impostor_token', { migrated: 0 }, admin2Client);
  } catch {
    releaseError = true;
  }
  testAssert(releaseError, 'Lock release with invalid ownerToken is rejected');

  // 3.6 Releasing lock with correct token -> SUCCEEDS
  const release = await releaseMigrationLock(BIZ_ID, lock1.ownerToken, { totalScanned: 0, migrated: 0 }, adminClient);
  testAssert(release.success === true, 'Admin 1 releases lock cleanly with valid ownerToken');

  // 3.7 Expired lock safe recovery: simulate stale lock from crashed process
  const staleStatusRef = doc(adminClient, 'businesses', BIZ_ID, 'counters', 'migration_status');
  await setDoc(staleStatusRef, {
    status: 'in_progress',
    ownerToken: 'dead_token',
    startedBy: 'crashed_admin',
    leaseExpiresAt: new Date(Date.now() - 5000).toISOString(), // Expired 5 seconds ago
  });

  const recoveredLock = await acquireMigrationLock(BIZ_ID, { uid: 'admin-2' }, admin2Client);
  testAssert(recoveredLock.success === true, 'Admin 2 safely recovers expired lease lock');
  testAssert(recoveredLock.ownerToken !== 'dead_token', 'New ownerToken assigned to recovered lock');

  // Clean up lock
  await releaseMigrationLock(BIZ_ID, recoveredLock.ownerToken, {}, admin2Client);

  // =================================================================
  // SECTION 4: MULTI-FINANCIAL-YEAR MIGRATION (2025-26, 2026-27, 2027-28)
  // =================================================================
  console.log('\n--- Section 4: Multi-Financial-Year Migration ---');

  // Clear Firestore migration marker to allow clean multi-year test
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await deleteDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'migration_status'));
    await deleteDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2025-26'));
    await deleteDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'));
    await deleteDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2027-28'));
  });

  const multiYearDataset = [
    // FY 2025-26 Invoices (Dates before Apr 1, 2026)
    {
      id: 'inv-fy25-01',
      invoiceNumber: 'TPS/2025-26/001',
      invoiceDate: '2025-06-15',
      paymentStatus: 'Paid',
      customer: { name: 'Customer 2025' },
      items: [{ name: 'Battery', rate: 12000, qty: 1 }],
    },
    {
      id: 'inv-fy25-15',
      invoiceNumber: 'TPS/2025-26/015',
      invoiceDate: '2026-03-31', // Last day of 2025-26
      paymentStatus: 'Paid',
      customer: { name: 'Customer 2025 Last' },
      items: [{ name: 'Battery', rate: 12500, qty: 1 }],
    },

    // FY 2026-27 Invoices (Apr 1, 2026 to Mar 31, 2027)
    {
      id: 'inv-fy26-01',
      invoiceNumber: 'TPS/2026-27/001',
      invoiceDate: '2026-04-01', // First day of 2026-27
      paymentStatus: 'Paid',
      customer: { name: 'Customer 2026 First' },
      items: [{ name: 'Inverter', rate: 7000, qty: 1 }],
    },
    {
      id: 'inv-fy26-50',
      invoiceNumber: 'TPS/2026-27/050',
      invoiceDate: '2027-03-31', // Last day of 2026-27
      paymentStatus: 'Paid',
      customer: { name: 'Customer 2026 Last' },
      items: [{ name: 'Battery', rate: 14000, qty: 1 }],
    },

    // FY 2027-28 Invoices (Apr 1, 2027 onwards)
    {
      id: 'inv-fy27-01',
      invoiceNumber: 'TPS/2027-28/001',
      invoiceDate: '2027-04-01', // First day of 2027-28
      paymentStatus: 'Paid',
      customer: { name: 'Customer 2027 First' },
      items: [{ name: 'Solar', rate: 45000, qty: 1 }],
    },
    {
      id: 'inv-fy27-05',
      invoiceNumber: 'TPS/2027-28/005',
      invoiceDate: '2027-08-20',
      paymentStatus: 'Pending',
      customer: { name: 'Customer 2027-05' },
      items: [{ name: 'Solar Inverter', rate: 25000, qty: 1 }],
    },

    // Injected Duplicate Invoice Number (Duplicate of TPS/2026-27/001)
    {
      id: 'inv-fy26-duplicate',
      invoiceNumber: 'TPS/2026-27/001',
      invoiceDate: '2026-05-10',
      paymentStatus: 'Paid',
      customer: { name: 'Duplicate Customer' },
      items: [{ name: 'Duplicate Item', rate: 1000, qty: 1 }],
    },

    // Injected Malformed Invoice Number (Missing numeric sequence suffix)
    {
      id: 'inv-malformed-01',
      invoiceNumber: 'TPS/MALFORMED/XXX',
      invoiceDate: '2026-09-10',
      paymentStatus: 'Paid',
      customer: { name: 'Malformed Number Customer' },
      items: [{ name: 'Battery', rate: 5000, qty: 1 }],
    },
  ];

  mockStorage[INVOICE_STORAGE_KEY] = JSON.stringify(multiYearDataset);
  delete mockStorage[INVOICE_MIGRATION_STATUS_KEY];

  console.log('--- Step 4.1: Executing Multi-Year Migration ---');
  const migrationRes = await migrateLocalInvoicesToFirestore(BIZ_ID, { uid: 'admin-uid' }, adminClient);

  testAssert(migrationRes.totalScanned === 8, `Scanned 8 candidates (actual: ${migrationRes.totalScanned})`);
  testAssert(migrationRes.migrated === 7, `Migrated 7 valid distinct records (actual: ${migrationRes.migrated})`);
  testAssert(migrationRes.duplicatesFound.length === 1, `1 duplicate invoice number flagged (actual: ${migrationRes.duplicatesFound.length})`);
  testAssert(migrationRes.duplicatesFound[0] === 'TPS/2026-27/001', 'Duplicate invoice number identified: TPS/2026-27/001');
  testAssert(migrationRes.malformedInvoices.length === 1, `1 malformed invoice number flagged (actual: ${migrationRes.malformedInvoices.length})`);
  testAssert(migrationRes.malformedInvoices[0].invoiceNumber === 'TPS/MALFORMED/XXX', 'Malformed number identified without modification');

  console.log('--- Step 4.2: Verifying Independent Counter Seeding ---');
  const counter2526 = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2025-26'));
  const counter2627 = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'));
  const counter2728 = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2027-28'));

  testAssert(counter2526.exists() && counter2526.data().lastSeq === 15, `FY 2025-26 counter seeded to exactly 15 (actual: ${counter2526.data()?.lastSeq})`);
  testAssert(counter2627.exists() && counter2627.data().lastSeq === 50, `FY 2026-27 counter seeded to exactly 50 (actual: ${counter2627.data()?.lastSeq})`);
  testAssert(counter2728.exists() && counter2728.data().lastSeq === 5, `FY 2027-28 counter seeded to exactly 5 (actual: ${counter2728.data()?.lastSeq})`);

  console.log('--- Step 4.3: Verifying Safe Resumption & Idempotency ---');
  // Clear local marker to simulate re-running migration
  delete mockStorage[INVOICE_MIGRATION_STATUS_KEY];

  const resumeRes = await migrateLocalInvoicesToFirestore(BIZ_ID, { uid: 'admin-uid' }, adminClient);
  testAssert(resumeRes.alreadyCompleted === true || resumeRes.alreadyPresent === 7, 'Re-run safely detects existing records');
  testAssert(resumeRes.migrated === 0, `0 duplicate documents created on re-run (actual: ${resumeRes.migrated})`);

  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log(`TOTAL HARDENING TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runHardeningSuite().catch((err) => {
  console.error('Fatal error in hardening test suite:', err);
  process.exit(1);
});
