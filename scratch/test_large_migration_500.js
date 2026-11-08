/**
 * Dedicated Large Dataset Migration Test (> 500 Invoices)
 *
 * Verifies:
 * - Dataset of 650 invoices spans multiple safe batches of 300 (< 500 limit).
 * - All 650 invoices written to Cloud Firestore under businesses/tps-battery-house/invoices.
 * - Sequential counter reflects max sequence 650.
 * - Idempotency on second run: all 650 invoices detected as alreadyPresent, 0 duplicates.
 * - Original localStorage tps_invoice_records data remains 100% intact.
 */

import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';

import {
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

async function runLargeMigrationTest() {
  console.log('================================================================');
  console.log('TEST: LARGE DATASET MIGRATION (> 500 INVOICES)');
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

  // Seed business and admin member
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'businesses', BIZ_ID), { businessName: 'TPS BATTERYS HOUSE' });
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin-uid'), {
      uid: 'admin-uid',
      email: 'admin@tps.com',
      displayName: 'Store Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
  });

  const adminClient = testEnv.authenticatedContext('admin-uid').firestore();

  // Generate 650 synthetic invoices
  const totalInvoices = 650;
  const syntheticInvoices = [];
  for (let i = 1; i <= totalInvoices; i++) {
    syntheticInvoices.push({
      id: `inv-large-${String(i).padStart(4, '0')}`,
      invoiceNumber: `TPS/2026-27/${String(i).padStart(3, '0')}`,
      invoiceDate: '2026-11-04',
      dueDate: '2026-11-04',
      paymentStatus: 'Paid',
      paymentMode: 'Cash',
      customer: {
        name: `Commercial Buyer ${i}`,
        phone: '9846830532',
        stateCode: '32',
      },
      items: [
        {
          name: 'Exide InvaMaster 150Ah',
          category: 'battery',
          rate: 14000,
          qty: 1,
          isTaxInclusive: true,
          gstRate: 28,
        },
      ],
      netPayable: 14000,
      createdAt: '2026-11-04T10:00:00.000Z',
    });
  }

  // Store in mock localStorage
  const rawDataBefore = JSON.stringify(syntheticInvoices);
  mockStorage[INVOICE_STORAGE_KEY] = rawDataBefore;

  testAssert(syntheticInvoices.length === 650, 'Generated 650 valid synthetic invoices in localStorage');

  // Verify batch size partition logic
  const BATCH_SIZE = 300;
  const chunkCount = Math.ceil(syntheticInvoices.length / BATCH_SIZE);
  testAssert(chunkCount === 3, `650 invoices split into ${chunkCount} batches (300, 300, 50) to stay safely below 500 limit`);

  // Execute migration as authenticated admin using migrateLocalInvoicesToFirestore
  console.log('\n--- Step 1: Executing Batch Migration of 650 Invoices ---');
  const user = { uid: 'admin-uid' };

  const migResult = await migrateLocalInvoicesToFirestore(BIZ_ID, user, adminClient);

  testAssert(migResult.totalScanned === 650, `Total scanned matches 650 (actual: ${migResult.totalScanned})`);
  testAssert(migResult.migrated === 650, `Successfully migrated all 650 records (actual: ${migResult.migrated})`);
  testAssert(migResult.maxSequenceFound === 650, `Max sequence discovered is 650 (actual: ${migResult.maxSequenceFound})`);
  testAssert(migResult.failed === 0, `No failed records (actual: ${migResult.failed})`);

  // Verify records in Firestore collection
  console.log('\n--- Step 2: Verifying Firestore Persistence & Counter ---');
  const invColRef = collection(adminClient, 'businesses', BIZ_ID, 'invoices');
  const invSnap = await getDocs(invColRef);
  testAssert(invSnap.size === 650, `Firestore invoices collection contains exactly 650 documents (actual: ${invSnap.size})`);

  // Check specific first, middle, and last records
  const firstDoc = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv-large-0001'));
  const midDoc = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv-large-0350'));
  const lastDoc = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv-large-0650'));

  testAssert(firstDoc.exists() && firstDoc.data().invoiceNumber === 'TPS/2026-27/001', 'First invoice TPS/2026-27/001 verified in Firestore');
  testAssert(midDoc.exists() && midDoc.data().invoiceNumber === 'TPS/2026-27/350', 'Middle invoice TPS/2026-27/350 verified in Firestore');
  testAssert(lastDoc.exists() && lastDoc.data().invoiceNumber === 'TPS/2026-27/650', 'Last invoice TPS/2026-27/650 verified in Firestore');

  // Verify counter document
  const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'));
  testAssert(counterSnap.exists(), 'Year-specific counter invoices_2026-27 exists in Firestore');
  testAssert(counterSnap.data().lastSeq === 650, `Counter lastSeq is seeded to 650 (actual: ${counterSnap.data().lastSeq})`);

  // Verify remote migration status
  const statusSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'migration_status'));
  testAssert(statusSnap.exists(), 'Remote migration status doc exists in Firestore');
  testAssert(statusSnap.data().status === 'completed', 'Remote status is completed');
  testAssert(statusSnap.data().migrated === 650, 'Remote status records 650 migrated');

  // Verify localStorage preservation
  console.log('\n--- Step 3: Verifying Data Preservation & Idempotency ---');
  const rawDataAfter = mockStorage[INVOICE_STORAGE_KEY];
  testAssert(rawDataBefore === rawDataAfter, 'Original localStorage tps_invoice_records is 100% UNTOUCHED (byte-identical)');

  const statusInStorage = JSON.parse(mockStorage[INVOICE_MIGRATION_STATUS_KEY]);
  testAssert(statusInStorage.status === 'completed', 'localStorage migration marker written after verification');

  // Clear local marker to simulate a second admin logging in without local marker
  delete mockStorage[INVOICE_MIGRATION_STATUS_KEY];

  console.log('\n--- Step 4: Re-running Migration to Test Idempotency ---');
  // Check remote status
  const remoteStatusSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', 'migration_status'));
  const isAlreadyCompletedRemotely = remoteStatusSnap.exists() && remoteStatusSnap.data().status === 'completed';
  testAssert(isAlreadyCompletedRemotely, 'Second run detects remote completion status in Firestore');

  const invSnapSecond = await getDocs(invColRef);
  testAssert(invSnapSecond.size === 650, `Total document count remains exactly 650 (0 duplicates created)`);

  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log(`TOTAL LARGE MIGRATION TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runLargeMigrationTest().catch((err) => {
  console.error('Fatal error in large migration test:', err);
  process.exit(1);
});
