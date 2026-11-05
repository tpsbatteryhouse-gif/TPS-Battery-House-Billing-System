/**
 * Phase 2C.3: Final Adversarial Security Review Test Suite
 *
 * Explicitly attempts all adversarial attack vectors and verifies:
 * 1. Invoice-counter bidirectional linkage integrity
 * 2. Administrator permission boundaries and rollback protection
 * 3. Migration correctness, higher-counter preservation, and multi-admin mutex safety
 */

import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';

import {
  sanitizeInvoiceForFirestore,
  createInvoice,
} from '../src/firebase/services/invoiceService.js';

import {
  acquireMigrationLock,
  releaseMigrationLock,
  migrateLocalInvoicesToFirestore,
  seedMigrationCounterAtomic,
} from '../src/firebase/services/invoiceMigration.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-adversarial';
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

// Mock localStorage for Node.js test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('PHASE 2C.3: FINAL ADVERSARIAL SECURITY REVIEW TEST SUITE');
  console.log('================================================================\n');

  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
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
      displayName: 'Store Cashier',
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
    });

    // Seed initialized FY 2026-27 counter at sequence 10
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 10,
      prefix: 'TPS/2026-27/',
      lastInvoiceId: 'inv_seeded_10',
      lastInvoiceNumber: 'TPS/2026-27/010',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    });
  });

  const adminClient = testEnv.authenticatedContext('admin-uid').firestore();
  const admin2Client = testEnv.authenticatedContext('admin-2').firestore();
  const managerClient = testEnv.authenticatedContext('manager-uid').firestore();
  const cashierClient = testEnv.authenticatedContext('cashier-uid').firestore();

  // =================================================================
  // SECTION 1: INVOICE-COUNTER INTEGRITY & BIDIRECTIONAL LINKAGE
  // =================================================================
  console.log('--- Section 1: Invoice-Counter Bidirectional Linkage & Anti-Tamper ---');

  // Attack 1.1: Cashier attempts to increment counter ALONE (without creating an invoice)
  await assertFails(
    updateDoc(doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 11,
      prefix: 'TPS/2026-27/',
      lastInvoiceId: 'inv_fake_11',
      lastInvoiceNumber: 'TPS/2026-27/011',
      updatedAt: new Date().toISOString(),
      updatedBy: 'cashier-uid',
    })
  );
  testAssert(true, 'Attack 1.1: Cashier CANNOT increment counter alone (Invoice linkage enforced via existsAfter)');

  // Attack 1.2: Manager attempts to increment counter ALONE
  await assertFails(
    updateDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 11,
      prefix: 'TPS/2026-27/',
      lastInvoiceId: 'inv_fake_11',
      lastInvoiceNumber: 'TPS/2026-27/011',
      updatedAt: new Date().toISOString(),
      updatedBy: 'manager-uid',
    })
  );
  testAssert(true, 'Attack 1.2: Manager CANNOT increment counter alone without invoice creation');

  // Attack 1.3: Cashier attempts to create a permanent invoice ALONE (without counter increment)
  const standaloneInvoice = sanitizeInvoiceForFirestore({
    id: 'inv_standalone_01',
    invoiceNumber: 'TPS/2026-27/011',
    invoiceDate: '2026-11-05',
    financialYear: '2026-27',
    paymentStatus: 'Pending',
    paymentMode: 'Cash',
    customer: { name: 'Direct Attacker' },
    items: [{ name: 'Battery', rate: 10000, qty: 1 }],
  }, { uid: 'cashier-uid' });

  await assertFails(
    setDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_standalone_01'), standaloneInvoice)
  );
  testAssert(true, 'Attack 1.3: Cashier CANNOT create permanent invoice alone without counter transaction');

  // Attack 1.4: Manager attempts to create a permanent invoice ALONE
  await assertFails(
    setDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'inv_standalone_02'), {
      ...standaloneInvoice,
      id: 'inv_standalone_02',
    })
  );
  testAssert(true, 'Attack 1.4: Manager CANNOT create permanent invoice alone without counter transaction');

  // Attack 1.5: Cashier attempts to forge an arbitrary invoice number in a transaction (e.g. 999 when seq is 11)
  await assertFails(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_forged_999');

      transaction.update(counterRef, {
        lastSeq: 11,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_forged_999',
        lastInvoiceNumber: 'TPS/2026-27/999', // FORGED! Does not match seq 11
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      const forgedPayload = sanitizeInvoiceForFirestore({
        id: 'inv_forged_999',
        invoiceNumber: 'TPS/2026-27/999',
        invoiceDate: '2026-11-05',
        financialYear: '2026-27',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Forged Number Buyer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });

      transaction.set(invRef, forgedPayload);
    })
  );
  testAssert(true, 'Attack 1.5: Cashier CANNOT forge arbitrary invoice number (Regex pattern match enforced on counter)');

  // Attack 1.6: Cashier attempts to increment counter for a Draft invoice
  await assertFails(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_draft_attack');

      transaction.update(counterRef, {
        lastSeq: 11,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_draft_attack',
        lastInvoiceNumber: 'TPS/2026-27/011',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      const draftPayload = sanitizeInvoiceForFirestore({
        id: 'inv_draft_attack',
        invoiceNumber: 'TPS/2026-27/011',
        invoiceDate: '2026-11-05',
        financialYear: '2026-27',
        paymentStatus: 'Draft', // Drafts must NOT consume sequence
        paymentMode: 'Cash',
        customer: { name: 'Draft Consumer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });

      transaction.set(invRef, draftPayload);
    })
  );
  testAssert(true, 'Attack 1.6: Counter increment for Draft invoice is REJECTED (paymentStatus != Draft enforced)');

  // Attack 1.7: Cashier attempts to manipulate invoice prefix (e.g. ABC/2026-27/011)
  await assertFails(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_bad_prefix');

      transaction.update(counterRef, {
        lastSeq: 11,
        prefix: 'ABC/2026-27/', // Altered prefix
        lastInvoiceId: 'inv_bad_prefix',
        lastInvoiceNumber: 'ABC/2026-27/011',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      const badPrefixPayload = sanitizeInvoiceForFirestore({
        id: 'inv_bad_prefix',
        invoiceNumber: 'ABC/2026-27/011',
        invoiceDate: '2026-11-05',
        financialYear: '2026-27',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Prefix Alterer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });

      transaction.set(invRef, badPrefixPayload);
    })
  );
  testAssert(true, 'Attack 1.7: Manipulating counter/invoice prefix is REJECTED (Prefix immutability enforced)');

  // Attack 1.8: Cashier attempts to bypass counter via direct createInvoice() API
  try {
    await createInvoice(BIZ_ID, {
      id: 'inv_direct_bypass',
      invoiceNumber: 'TPS/2026-27/011',
      invoiceDate: '2026-11-05',
      financialYear: '2026-27',
      paymentStatus: 'Pending',
      paymentMode: 'Cash',
      customer: { name: 'Bypass Buyer' },
      items: [{ name: 'Battery', rate: 10000, qty: 1 }],
    }, { uid: 'cashier-uid' });
    testAssert(false, 'Attack 1.8: createInvoice direct bypass unexpectedly succeeded');
  } catch {
    testAssert(true, 'Attack 1.8: Direct createInvoice() API bypass by cashier is REJECTED by rules');
  }

  // Attack 1.9: Cashier attempts to create invoice for uninitialized FY 2028-29
  await assertFails(
    setDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_uninit_fy'), {
      id: 'inv_uninit_fy',
      invoiceNumber: 'TPS/2028-29/001',
      invoiceDate: '2028-05-10',
      financialYear: '2028-29',
      paymentStatus: 'Pending',
      paymentMode: 'Cash',
      customer: { name: 'Future Buyer' },
      items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      netPayable: 10000,
      createdAt: new Date().toISOString(),
      createdBy: 'cashier-uid',
    })
  );
  testAssert(true, 'Attack 1.9: Invoice creation for uninitialized FY is REJECTED (exists(counter) enforced)');

  // Valid 1.10: Legitimate atomic invoice creation with counter increment via runTransaction
  await assertSucceeds(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_legit_11');

      transaction.update(counterRef, {
        lastSeq: 11,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_legit_11',
        lastInvoiceNumber: 'TPS/2026-27/011',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      const validPayload = sanitizeInvoiceForFirestore({
        id: 'inv_legit_11',
        invoiceNumber: 'TPS/2026-27/011',
        invoiceDate: '2026-11-05',
        financialYear: '2026-27',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Valid Buyer 11' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });

      transaction.set(doc(cashierClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_011'), {
        invoiceId: 'inv_legit_11',
        invoiceNumber: 'TPS/2026-27/011',
        financialYear: '2026-27',
        createdAt: validPayload.createdAt,
        createdBy: 'cashier-uid',
      });
      transaction.set(invRef, validPayload);
    })
  );
  testAssert(true, 'Valid 1.10: Legitimate atomic transaction with matching counter and invoice SUCCEEDS');

  // Valid 1.11: Standalone Draft creation is allowed without consuming counter sequence
  const draftOnlyPayload = sanitizeInvoiceForFirestore({
    id: 'inv_draft_safe_01',
    invoiceNumber: 'DRAFT-998811',
    invoiceDate: '2026-11-05',
    financialYear: '2026-27',
    paymentStatus: 'Draft',
    customer: { name: 'Draft Stage Customer' },
    items: [{ name: 'Battery', rate: 10000, qty: 1 }],
  }, { uid: 'cashier-uid' });

  await assertSucceeds(
    setDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_draft_safe_01'), draftOnlyPayload)
  );
  testAssert(true, 'Valid 1.11: Standalone Draft invoice creation SUCCEEDS without counter mutation');

  // =================================================================
  // SECTION 2: ADMINISTRATOR PERMISSIONS & RESTRICTIONS
  // =================================================================
  console.log('\n--- Section 2: Administrator Boundaries & Rollback Protection ---');

  // Admin 2.1: Admin attempts to DECREASE an existing counter sequence (from 11 down to 5)
  await assertFails(
    updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 5, // Rolled back!
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    })
  );
  testAssert(true, 'Admin 2.1: Administrator CANNOT decrease counter sequence (lastSeq >= resource.lastSeq enforced)');

  // Admin 2.2: Admin attempts to RESET an existing counter to 0
  await assertFails(
    updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 0, // Reset to 0!
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    })
  );
  testAssert(true, 'Admin 2.2: Administrator CANNOT reset initialized counter to 0');

  // Admin 2.3: Admin CAN increase or maintain counter sequence for recovery (e.g. advance to 15)
  await assertSucceeds(
    updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 15,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    })
  );
  testAssert(true, 'Admin 2.3: Administrator CAN advance counter sequence for recovery (11 -> 15)');

  // Admin 2.4: Admin CAN update Paid invoice for authorized correction (immutable fields unchanged)
  await assertSucceeds(
    updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_legit_11'), {
      notes: 'Authorized audit correction by administrator',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    })
  );
  testAssert(true, 'Admin 2.4: Administrator CAN make authorized correction notes on issued invoice');

  // Admin 2.5: Admin CANNOT alter immutable invoiceNumber on an existing invoice
  await assertFails(
    updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_legit_11'), {
      invoiceNumber: 'TPS/2026-27/999', // Immutable field alteration
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid',
    })
  );
  testAssert(true, 'Admin 2.5: Administrator CANNOT change immutable invoiceNumber on update');

  // =================================================================
  // SECTION 3: MIGRATION CORRECTNESS & HIGHER-COUNTER PRESERVATION
  // =================================================================
  console.log('\n--- Section 3: Migration Correctness & Distributed Mutex ---');

  // Mig 3.1: Higher counter preservation test
  // Set Firestore counter invoices_2025-26 to lastSeq = 100 in database
  await setDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2025-26'), {
    lastSeq: 100,
    prefix: 'TPS/2025-26/',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
  });

  // Local candidate invoices only have maxSeq = 25 for 2025-26
  mockStorage['tps_invoice_records'] = JSON.stringify([
    {
      id: 'inv_hist_2526_01',
      invoiceNumber: 'TPS/2025-26/025',
      invoiceDate: '2025-08-10',
      financialYear: '2025-26',
      paymentStatus: 'Paid',
      customer: { name: 'Past Buyer' },
      items: [{ name: 'Tubular Battery', rate: 12000, qty: 1 }],
      netPayable: 12000,
    },
    // Historical invoice WITHOUT financialYear field (must auto-derive 2027-28 from invoiceDate)
    {
      id: 'inv_hist_nodate_01',
      invoiceNumber: 'TPS/2027-28/005',
      invoiceDate: '2027-05-15', // No financialYear field!
      paymentStatus: 'Paid',
      customer: { name: 'Future Dated Customer' },
      items: [{ name: 'Inverter', rate: 8000, qty: 1 }],
      netPayable: 8000,
    },
    // Duplicate invoice number
    {
      id: 'inv_hist_dup',
      invoiceNumber: 'TPS/2025-26/025',
      invoiceDate: '2025-08-10',
      paymentStatus: 'Paid',
      customer: { name: 'Duplicate Customer' },
      items: [{ name: 'Tubular Battery', rate: 12000, qty: 1 }],
      netPayable: 12000,
    },
    // Malformed invoice number
    {
      id: 'inv_hist_malformed',
      invoiceNumber: 'INVALID-NO-SEQ',
      invoiceDate: '2025-08-10',
      paymentStatus: 'Paid',
      customer: { name: 'Malformed Num Customer' },
      items: [{ name: 'Battery', rate: 5000, qty: 1 }],
      netPayable: 5000,
    },
  ]);

  // Execute migration
  const migResult = await migrateLocalInvoicesToFirestore(
    BIZ_ID,
    { uid: 'admin-uid' },
    adminClient
  );

  testAssert(migResult.totalScanned === 4, 'Mig 3.1: Scanned 4 candidates');
  testAssert(migResult.duplicatesFound.length === 1, 'Mig 3.2: Detected duplicate invoice number (TPS/2025-26/025)');
  testAssert(migResult.malformedInvoices.length === 1, 'Mig 3.3: Detected malformed invoice number (INVALID-NO-SEQ)');
  testAssert(migResult.maxSeqPerFy['2027-28'] === 5, 'Mig 3.4: Auto-derived FY 2027-28 from invoiceDate without financialYear field');

  // Verify higher counter was PRESERVED and NOT overwritten!
  const fy2526Snap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2025-26'));
  testAssert(
    fy2526Snap.data().lastSeq === 100,
    `Mig 3.5: Counter for 2025-26 remained 100 (DID NOT overwrite with candidate maxSeq 25!)`
  );

  // Mig 3.6: Multi-admin race condition & atomic lock
  // Reset lock to in_progress with active lease
  const lockDocRef = doc(adminClient, 'businesses', BIZ_ID, 'counters', 'migration_status');
  await setDoc(lockDocRef, {
    status: 'in_progress',
    ownerToken: 'mig_token_admin1',
    startedBy: 'admin-uid',
    startedAt: new Date().toISOString(),
    leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
  });

  const lock2 = await acquireMigrationLock(BIZ_ID, { uid: 'admin-2' }, admin2Client);
  testAssert(lock2.success === false && lock2.locked === true, 'Mig 3.6: Admin 2 blocked by Admin 1 active lease');

  // Mig 3.7: Owner token verification on release
  try {
    await releaseMigrationLock(BIZ_ID, 'wrong_token', { totalScanned: 1 }, admin2Client);
    testAssert(false, 'Mig 3.7: Release lock with wrong token should fail');
  } catch {
    testAssert(true, 'Mig 3.7: Release lock with mismatched ownerToken is REJECTED');
  }

  // Mig 3.8: Safe recovery of expired lease
  await setDoc(lockDocRef, {
    status: 'in_progress',
    ownerToken: 'mig_token_expired',
    startedBy: 'admin-uid',
    startedAt: new Date(Date.now() - 120000).toISOString(),
    leaseExpiresAt: new Date(Date.now() - 30000).toISOString(), // Expired 30 seconds ago
  });

  const recoveryLock = await acquireMigrationLock(BIZ_ID, { uid: 'admin-2' }, admin2Client);
  testAssert(recoveryLock.success === true, 'Mig 3.8: Safe recovery of expired migration lease by Admin 2');

  // =================================================================
  // SECTION 4: PHASE 2C.4 FINAL INVOICE INTEGRITY & UNIQUENESS HARDENING
  // =================================================================
  console.log('\n--- Section 4: Phase 2C.4 Final Integrity & Uniqueness Hardening ---');

  // Hardening 4.1: Administrator CANNOT create a permanent invoice alone without counter transaction
  const adminStandalonePayload = sanitizeInvoiceForFirestore({
    id: 'inv_admin_rogue_01',
    invoiceNumber: 'TPS/2026-27/099',
    invoiceDate: '2026-11-05',
    financialYear: '2026-27',
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    customer: { name: 'Admin Direct Buyer' },
    items: [{ name: 'Battery', rate: 15000, qty: 1 }],
  }, { uid: 'admin-uid' });

  await assertFails(
    setDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_admin_rogue_01'), adminStandalonePayload)
  );
  testAssert(true, 'Hardening 4.1: Administrator CANNOT create permanent invoice alone without counter transaction');

  // Hardening 4.2: Administrator CANNOT forge arbitrary invoice number during normal billing
  await assertFails(
    runTransaction(adminClient, async (transaction) => {
      const counterRef = doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_admin_forged');

      transaction.update(counterRef, {
        lastSeq: 16,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_admin_forged',
        lastInvoiceNumber: 'TPS/2026-27/888', // Forged number does not match seq 16
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin-uid',
      });

      const forgedAdminInvoice = sanitizeInvoiceForFirestore({
        id: 'inv_admin_forged',
        invoiceNumber: 'TPS/2026-27/888',
        invoiceDate: '2026-11-05',
        financialYear: '2026-27',
        paymentStatus: 'Paid',
        paymentMode: 'Cash',
        customer: { name: 'Forged Admin Buyer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'admin-uid' });

      transaction.set(doc(adminClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_888'), {
        invoiceId: 'inv_admin_forged',
        invoiceNumber: 'TPS/2026-27/888',
        financialYear: '2026-27',
        createdAt: new Date().toISOString(),
        createdBy: 'admin-uid',
      });
      transaction.set(invRef, forgedAdminInvoice);
    })
  );
  testAssert(true, 'Hardening 4.2: Administrator CANNOT forge arbitrary invoice number (counter pattern match enforced)');

  // Hardening 4.3: Two different invoice IDs CANNOT use the same invoice number (reservation collision)
  await assertFails(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_diff_id_same_num');

      transaction.update(counterRef, {
        lastSeq: 16,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_diff_id_same_num',
        lastInvoiceNumber: 'TPS/2026-27/016',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      // Try to reserve TPS_2026-27_011 which was already reserved in Valid 1.10
      const collisionResRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_011');
      transaction.set(collisionResRef, {
        invoiceId: 'inv_diff_id_same_num',
        invoiceNumber: 'TPS/2026-27/011',
        financialYear: '2026-27',
        createdAt: new Date().toISOString(),
        createdBy: 'cashier-uid',
      });

      const invPayload = sanitizeInvoiceForFirestore({
        id: 'inv_diff_id_same_num',
        invoiceNumber: 'TPS/2026-27/011',
        invoiceDate: '2026-11-05',
        financialYear: '2026-27',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Collision Customer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });
      transaction.set(invRef, invPayload);
    })
  );
  testAssert(true, 'Hardening 4.3: Duplicate invoice number with different ID is REJECTED by reservation collision');

  // Hardening 4.4: Financial Year mismatch against invoiceDate is strictly REJECTED
  await assertFails(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2027-28');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_fy_mismatch');

      // Seed counter 2027-28 if needed
      transaction.set(counterRef, {
        lastSeq: 1,
        prefix: 'TPS/2027-28/',
        lastInvoiceId: 'inv_fy_mismatch',
        lastInvoiceNumber: 'TPS/2027-28/001',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      // Date is 2026-11-05 (which belongs to FY 2026-27, NOT 2027-28)
      const mismatchedPayload = sanitizeInvoiceForFirestore({
        id: 'inv_fy_mismatch',
        invoiceNumber: 'TPS/2027-28/001',
        invoiceDate: '2026-11-05', // Mismatch!
        financialYear: '2027-28',
        paymentStatus: 'Paid',
        paymentMode: 'Cash',
        customer: { name: 'FY Mismatch Customer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });

      transaction.set(doc(cashierClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2027-28_001'), {
        invoiceId: 'inv_fy_mismatch',
        invoiceNumber: 'TPS/2027-28/001',
        financialYear: '2027-28',
        createdAt: new Date().toISOString(),
        createdBy: 'cashier-uid',
      });
      transaction.set(invRef, mismatchedPayload);
    })
  );
  testAssert(true, 'Hardening 4.4: Mismatch between financialYear and invoiceDate is strictly REJECTED');

  // Hardening 4.5: Invoice deletion does NOT make its invoice number reusable
  // First, verify invoice inv_legit_11 exists and its reservation TPS_2026-27_011 exists
  const existingInvSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_legit_11'));
  testAssert(existingInvSnap.exists(), 'Hardening 4.5a: inv_legit_11 exists before deletion');

  // Admin deletes the invoice document
  await assertSucceeds(deleteDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_legit_11')));
  testAssert(true, 'Hardening 4.5b: Admin deleted invoice document inv_legit_11');

  // Admin tries to delete the reservation document — MUST FAIL!
  await assertFails(deleteDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_011')));
  testAssert(true, 'Hardening 4.5c: Reservation document CANNOT be deleted (allow delete: if false)');

  // Attempt to reuse TPS/2026-27/011 for a new invoice — MUST FAIL!
  await assertFails(
    runTransaction(cashierClient, async (transaction) => {
      const counterRef = doc(cashierClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      const invRef = doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_reused_number');

      transaction.update(counterRef, {
        lastSeq: 16,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_reused_number',
        lastInvoiceNumber: 'TPS/2026-27/011',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier-uid',
      });

      transaction.set(doc(cashierClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_011'), {
        invoiceId: 'inv_reused_number',
        invoiceNumber: 'TPS/2026-27/011',
        financialYear: '2026-27',
        createdAt: new Date().toISOString(),
        createdBy: 'cashier-uid',
      });

      const reusedPayload = sanitizeInvoiceForFirestore({
        id: 'inv_reused_number',
        invoiceNumber: 'TPS/2026-27/011',
        invoiceDate: '2026-11-05',
        financialYear: '2026-27',
        paymentStatus: 'Paid',
        paymentMode: 'Cash',
        customer: { name: 'Reused Number Customer' },
        items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      }, { uid: 'cashier-uid' });
      transaction.set(invRef, reusedPayload);
    })
  );
  testAssert(true, 'Hardening 4.5d: Reusing invoice number after original invoice deletion is strictly PREVENTED');

  // Hardening 4.6: Atomic migration counter seeding does NOT downgrade an active billing counter
  // Setup: active billing counter at 35
  await setDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
    lastSeq: 35,
    prefix: 'TPS/2026-27/',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
  });

  // Setup active migration lock owned by recoveryLock.ownerToken
  const activeLockToken = recoveryLock.ownerToken;

  // Migration seeds counter with maxSeq = 20 (lower than active 35)
  const seedResultLow = await seedMigrationCounterAtomic(
    BIZ_ID,
    '2026-27',
    20,
    activeLockToken,
    { uid: 'admin-2' },
    admin2Client
  );
  testAssert(seedResultLow.finalSeq === 35, 'Hardening 4.6a: Counter seeding preserved higher active billing counter (35 > 20)');

  // Migration seeds counter with maxSeq = 50 (higher than active 35)
  const seedResultHigh = await seedMigrationCounterAtomic(
    BIZ_ID,
    '2026-27',
    50,
    activeLockToken,
    { uid: 'admin-2' },
    admin2Client
  );
  testAssert(seedResultHigh.finalSeq === 50, 'Hardening 4.6b: Counter seeding updated to higher migrated counter (50 > 35)');

  // Hardening 4.7: Counter seeding with invalid/expired lock token is REJECTED
  try {
    await seedMigrationCounterAtomic(
      BIZ_ID,
      '2026-27',
      60,
      'invalid_stolen_token',
      { uid: 'admin-2' },
      admin2Client
    );
    testAssert(false, 'Hardening 4.7: Should reject seedMigrationCounterAtomic with invalid token');
  } catch (err) {
    testAssert(true, `Hardening 4.7: Counter seeding with invalid lock token rejected (${err.message})`);
  }

  // Hardening 4.8: Migration retry after interruption safely skips existing records without duplicate numbers
  mockStorage['tps_invoice_records'] = JSON.stringify([
    {
      id: 'inv_retry_01',
      invoiceNumber: 'TPS/2026-27/051',
      invoiceDate: '2026-11-05',
      financialYear: '2026-27',
      paymentStatus: 'Paid',
      customer: { name: 'Retry Customer 1' },
      items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      netPayable: 10000,
    },
    {
      id: 'inv_retry_02',
      invoiceNumber: 'TPS/2026-27/052',
      invoiceDate: '2026-11-05',
      financialYear: '2026-27',
      paymentStatus: 'Paid',
      customer: { name: 'Retry Customer 2' },
      items: [{ name: 'Inverter', rate: 7000, qty: 1 }],
      netPayable: 7000,
    },
  ]);

  // Clear lock for fresh migration run
  await deleteDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'migration_status'));

  // Run first migration run
  const migRun1 = await migrateLocalInvoicesToFirestore(BIZ_ID, { uid: 'admin-uid' }, adminClient);
  testAssert(migRun1.migrated === 2, `Hardening 4.8a: First migration migrated 2 records (got ${migRun1.migrated})`);

  // Clear migration status in localStorage and Firestore lock to simulate an interrupted/retried state
  mockStorage['tps_invoice_migration_v1'] = null;
  await deleteDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'migration_status'));

  // Add 1 new record to mock records alongside the 2 already migrated records
  mockStorage['tps_invoice_records'] = JSON.stringify([
    {
      id: 'inv_retry_01', // Already migrated!
      invoiceNumber: 'TPS/2026-27/051',
      invoiceDate: '2026-11-05',
      financialYear: '2026-27',
      paymentStatus: 'Paid',
      customer: { name: 'Retry Customer 1' },
      items: [{ name: 'Battery', rate: 10000, qty: 1 }],
      netPayable: 10000,
    },
    {
      id: 'inv_retry_02', // Already migrated!
      invoiceNumber: 'TPS/2026-27/052',
      invoiceDate: '2026-11-05',
      financialYear: '2026-27',
      paymentStatus: 'Paid',
      customer: { name: 'Retry Customer 2' },
      items: [{ name: 'Inverter', rate: 7000, qty: 1 }],
      netPayable: 7000,
    },
    {
      id: 'inv_retry_03', // New!
      invoiceNumber: 'TPS/2026-27/053',
      invoiceDate: '2026-11-05',
      financialYear: '2026-27',
      paymentStatus: 'Paid',
      customer: { name: 'Retry Customer 3' },
      items: [{ name: 'Solar Panel', rate: 15000, qty: 1 }],
      netPayable: 15000,
    },
  ]);

  // Retry migration
  const migRun2 = await migrateLocalInvoicesToFirestore(BIZ_ID, { uid: 'admin-uid' }, adminClient);
  testAssert(migRun2.alreadyPresent === 2, 'Hardening 4.8b: Retried migration detected 2 already-present invoices');
  testAssert(migRun2.migrated === 1, 'Hardening 4.8c: Retried migration cleanly imported only the remaining 1 new record');
  testAssert(migRun2.duplicatesFound.length === 0, 'Hardening 4.8d: No duplicate collision errors during retry');

  // Verify counter is now 53
  const finalCounterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'));
  testAssert(finalCounterSnap.data().lastSeq === 53, 'Hardening 4.8e: Final counter safely reflects sequence 53');

  // Clean up
  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log(`TOTAL ADVERSARIAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal error in adversarial review suite:', err);
  process.exit(1);
});
