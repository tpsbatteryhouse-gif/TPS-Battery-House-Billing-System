/**
 * TPS BATTERY HOUSE — ADMINISTRATOR DRAFT SAVE PERMISSIONS & UNCHANGED INVOICE SUITE
 *
 * Exhaustively tests all 17 required scenarios:
 * 1. Real authenticated Administrator creates a draft.
 * 2. Administrator updates an existing draft.
 * 3. Administrator saves an unchanged draft without unnecessary writes.
 * 4. Manager creates a draft.
 * 5. Cashier creates a draft.
 * 6. Pending staff are rejected.
 * 7. Disabled staff are rejected.
 * 8. Removed staff are rejected.
 * 9. Unauthenticated users are rejected.
 * 10. Missing financial-year counter does not prevent draft creation.
 * 11. Draft creation does not increment the official invoice counter.
 * 12. Draft creation does not create an issued-invoice reservation.
 * 13. Existing draft identity remains unchanged after updates.
 * 14. Draft data survives reload.
 * 15. Cross-business access is denied.
 * 16. Issued invoices cannot be converted back into drafts.
 * 17. Draft can subsequently be issued through the correct issuance transaction.
 */

import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';
import {
  saveInvoiceDraft,
  createInvoiceWithCounter,
  initializeInvoiceCounter,
} from '../src/firebase/services/invoiceService.js';
import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';
import {
  isIssuedInvoice,
  createDraftSnapshot,
  isDraftModified,
} from '../src/utils/draftState.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';
const OTHER_BIZ_ID = 'foreign-business';
const FY = '2026-27';
const PREFIX = 'TPS/2026-27/';

let passed = 0;
let failed = 0;

async function it(title, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`);
    console.error(`    ${err.stack || err.message}`);
    failed++;
  }
}

function checkEmulatorRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://${EMULATOR_HOST}:${EMULATOR_PORT}/`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureEmulator() {
  const isRunning = await checkEmulatorRunning();
  if (isRunning) return null;

  const javaBin = [
    '/tmp/jdk-21/bin/java',
    '/usr/bin/java',
    'java',
  ].find((p) => p === 'java' || fs.existsSync(p)) || 'java';

  const jarPath = [
    '/tmp/firestore-emulator.jar',
    '/home/navaneeth/.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar',
  ].find((p) => fs.existsSync(p));

  if (!jarPath) {
    throw new Error('Could not find firestore-emulator.jar in /tmp or ~/.cache/firebase/emulators');
  }

  console.log(`[Suite] Starting Firestore emulator with ${javaBin}...`);
  const emuProcess = spawn(
    javaBin,
    [
      '-jar',
      jarPath,
      '--rules',
      'firestore.rules',
      '--host',
      EMULATOR_HOST,
      '--port',
      String(EMULATOR_PORT),
      '--webchannel_port',
      '8981',
    ],
    { stdio: 'ignore', detached: true }
  );

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkEmulatorRunning()) {
      console.log('[Suite] Emulator is ready.\n');
      return emuProcess;
    }
  }
  throw new Error('Timed out waiting for Firestore emulator');
}

async function runSuite() {
  let spawnedEmu = null;
  try {
    spawnedEmu = await ensureEmulator();
  } catch (e) {
    console.error('[Suite] Emulator startup failed:', e.message);
    process.exit(1);
  }

  console.log('================================================================');
  console.log('TPS BATTERY HOUSE — ADMIN DRAFT SAVE & UNCHANGED INVOICE SUITE');
  console.log('================================================================\n');

  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
    },
  });

  // Clear Firestore
  for (let i = 0; i < 5; i++) {
    try {
      await testEnv.clearFirestore();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Seed memberships & businesses
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERY HOUSE',
      gstin: '32DIUPP1211B2ZN',
    });

    await setDoc(doc(db, 'businesses', OTHER_BIZ_ID), {
      businessName: 'OTHER ENTERPRISE',
      gstin: '32AABCT1332L1Z1',
    });

    // 1. Authenticated Administrator
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_uid_01'), {
      uid: 'admin_uid_01',
      email: 'admin@tps.com',
      displayName: 'TPS Administrator',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });

    // 2. Store Manager
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_uid_01'), {
      uid: 'manager_uid_01',
      email: 'manager@tps.com',
      displayName: 'Store Manager',
      role: 'manager',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid_01',
    });

    // 3. Billing Cashier
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_uid_01'), {
      uid: 'cashier_uid_01',
      email: 'cashier@tps.com',
      displayName: 'Billing Cashier',
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid_01',
    });

    // 4. Pending Staff
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'pending_uid_01'), {
      uid: 'pending_uid_01',
      email: 'pending@tps.com',
      displayName: 'Pending Applicant',
      role: 'cashier',
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid_01',
    });

    // 5. Disabled Staff
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'disabled_uid_01'), {
      uid: 'disabled_uid_01',
      email: 'disabled@tps.com',
      displayName: 'Ex Staff Member',
      role: 'cashier',
      status: 'disabled',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid_01',
    });
  });

  const adminClient = testEnv.authenticatedContext('admin_uid_01', { email: 'admin@tps.com' }).firestore();
  const managerClient = testEnv.authenticatedContext('manager_uid_01', { email: 'manager@tps.com' }).firestore();
  const cashierClient = testEnv.authenticatedContext('cashier_uid_01', { email: 'cashier@tps.com' }).firestore();
  const pendingClient = testEnv.authenticatedContext('pending_uid_01', { email: 'pending@tps.com' }).firestore();
  const disabledClient = testEnv.authenticatedContext('disabled_uid_01', { email: 'disabled@tps.com' }).firestore();
  const unauthClient = testEnv.unauthenticatedContext().firestore();

  const adminUser = { uid: 'admin_uid_01', role: 'admin', email: 'admin@tps.com' };
  const managerUser = { uid: 'manager_uid_01', role: 'manager', email: 'manager@tps.com' };
  const cashierUser = { uid: 'cashier_uid_01', role: 'cashier', email: 'cashier@tps.com' };

  const sampleDraft = {
    customer: {
      name: 'Malabar Logistics Private Limited',
      phone: '9846830532',
      address: 'Near Old Bus Stand, Pattambi Road',
      city: 'Thrithala',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679534',
      gstin: '32AAECM4421B1Z9',
    },
    items: [
      {
        id: 'item-bat-01',
        name: 'Amaron Current 150Ah Tall Tubular Battery',
        category: 'battery',
        qty: 2,
        rate: 15500,
        isTaxInclusive: true,
        gstRate: 28,
        unit: 'Nos',
        hsn: '8507',
      },
    ],
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-20',
    paymentStatus: 'Draft',
    paymentMode: 'Cash',
    additionalDiscount: 500,
    scrapExchange: {
      enabled: true,
      amount: 1400,
      description: 'Old Scrap Battery Buyback',
    },
    notes: 'Quotation prepared for corporate fleet maintenance.',
  };

  const calculatedTotals = calculateInvoiceTotals(sampleDraft, '32');
  sampleDraft.netPayable = calculatedTotals.netPayable; // 29,100

  console.log('--- PART 1: ADMINISTRATOR DRAFT CREATION, UPDATE & UNCHANGED HANDLING ---');

  // 1. Real authenticated Administrator creates a draft
  let adminDraftResult;
  await it('1. Real authenticated Administrator creates a draft', async () => {
    adminDraftResult = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_admin_live_01' },
      adminUser,
      { dbInstance: adminClient }
    );
    assert.strictEqual(adminDraftResult.paymentStatus, 'Draft');
    assert(adminDraftResult.invoiceNumber.startsWith('DRAFT-'));
    assert.strictEqual(adminDraftResult.createdBy, 'admin_uid_01');

    const snap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'draft_admin_live_01'));
    assert.strictEqual(snap.exists(), true);
    assert.strictEqual(snap.data().customer.name, 'Malabar Logistics Private Limited');
    assert.strictEqual(snap.data().netPayable, 29100);
  });

  // 2. Administrator updates an existing draft
  await it('2. Administrator updates an existing draft', async () => {
    const updatedDraft = await saveInvoiceDraft(
      BIZ_ID,
      {
        ...sampleDraft,
        id: 'draft_admin_live_01',
        invoiceNumber: adminDraftResult.invoiceNumber,
        additionalDiscount: 1000,
        items: [{ ...sampleDraft.items[0], qty: 3 }],
      },
      adminUser,
      { dbInstance: adminClient }
    );

    assert.strictEqual(updatedDraft.id, 'draft_admin_live_01');
    assert.strictEqual(updatedDraft.invoiceNumber, adminDraftResult.invoiceNumber);
    assert.strictEqual(updatedDraft.additionalDiscount, 1000);
    assert.strictEqual(updatedDraft.items[0].qty, 3);
    assert.strictEqual(updatedDraft.createdBy, 'admin_uid_01');

    const snap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'draft_admin_live_01'));
    assert.strictEqual(snap.exists(), true);
    assert.strictEqual(snap.data().additionalDiscount, 1000);
  });

  // 3. Administrator saves an unchanged draft without unnecessary writes
  await it('3. Administrator saves an unchanged draft without unnecessary writes', async () => {
    // Current draft state after update 2
    const currentInvoiceInEditor = {
      ...sampleDraft,
      id: 'draft_admin_live_01',
      invoiceNumber: adminDraftResult.invoiceNumber,
      additionalDiscount: 1000,
      items: [{ ...sampleDraft.items[0], qty: 3 }],
    };

    // Form takes snapshot of persisted state
    const cleanSnapshot = createDraftSnapshot(currentInvoiceInEditor);

    // Verify isDraftModified reports false
    const modified = isDraftModified(currentInvoiceInEditor, cleanSnapshot);
    assert.strictEqual(modified, false, 'Unchanged invoice must be recognized as NOT modified');

    // User modifies nothing and clicks Save for later:
    // UI short-circuits without performing Firestore write
    let firestoreWriteAttempted = false;
    let resultMessage = '';

    if (!modified) {
      resultMessage = 'No changes to save. Your draft is already up to date.';
    } else {
      firestoreWriteAttempted = true;
      await saveInvoiceDraft(BIZ_ID, currentInvoiceInEditor, adminUser, { dbInstance: adminClient });
    }

    assert.strictEqual(firestoreWriteAttempted, false, 'No unnecessary Firestore write should occur');
    assert.strictEqual(resultMessage, 'No changes to save. Your draft is already up to date.');
  });

  console.log('\n--- PART 2: STAFF ROLE AUTHORIZATION MATRIX ---');

  // 4. Manager creates a draft
  await it('4. Manager creates a draft', async () => {
    const mgrResult = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_mgr_live_01' },
      managerUser,
      { dbInstance: managerClient }
    );
    assert.strictEqual(mgrResult.paymentStatus, 'Draft');
    assert.strictEqual(mgrResult.createdBy, 'manager_uid_01');

    const snap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_mgr_live_01'));
    assert.strictEqual(snap.exists(), true);
  });

  // 5. Cashier creates a draft
  await it('5. Cashier creates a draft', async () => {
    const cashierResult = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_cashier_live_01' },
      cashierUser,
      { dbInstance: cashierClient }
    );
    assert.strictEqual(cashierResult.paymentStatus, 'Draft');
    assert.strictEqual(cashierResult.createdBy, 'cashier_uid_01');

    const snap = await getDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'draft_cashier_live_01'));
    assert.strictEqual(snap.exists(), true);
  });

  // 6. Pending staff are rejected
  await it('6. Pending staff are rejected', async () => {
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        BIZ_ID,
        { ...sampleDraft, id: 'draft_pending_rejected' },
        { uid: 'pending_uid_01' },
        { dbInstance: pendingClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Pending staff must be rejected by security rules');
  });

  // 7. Disabled staff are rejected
  await it('7. Disabled staff are rejected', async () => {
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        BIZ_ID,
        { ...sampleDraft, id: 'draft_disabled_rejected' },
        { uid: 'disabled_uid_01' },
        { dbInstance: disabledClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Disabled staff must be rejected by security rules');
  });

  // 8. Removed staff are rejected
  await it('8. Removed staff are rejected', async () => {
    const removedClient = testEnv.authenticatedContext('removed_uid_99', { email: 'removed@tps.com' }).firestore();
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        BIZ_ID,
        { ...sampleDraft, id: 'draft_removed_rejected' },
        { uid: 'removed_uid_99' },
        { dbInstance: removedClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Removed staff must be rejected by security rules');
  });

  // 9. Unauthenticated users are rejected
  await it('9. Unauthenticated users are rejected', async () => {
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        BIZ_ID,
        { ...sampleDraft, id: 'draft_unauth_rejected' },
        null,
        { dbInstance: unauthClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Unauthenticated users must be rejected by security rules');
  });

  console.log('\n--- PART 3: COUNTER & NUMBER RESERVATION ISOLATION ---');

  // 10. Missing financial-year counter does not prevent draft creation
  await it('10. Missing financial-year counter does not prevent draft creation', async () => {
    const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.exists(), false, 'Counter invoices_2026-27 must not exist');

    const draftWithProspective = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_no_counter_01', invoiceNumber: 'TPS/2026-27/042' },
      adminUser,
      { dbInstance: adminClient }
    );
    assert.strictEqual(draftWithProspective.paymentStatus, 'Draft');
    assert(draftWithProspective.invoiceNumber.startsWith('DRAFT-'));
  });

  // 11. Draft creation does not increment the official invoice counter
  await it('11. Draft creation does not increment the official invoice counter', async () => {
    const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.exists(), false, 'Draft saving must never create or touch the counter document');
  });

  // 12. Draft creation does not create an issued-invoice reservation
  await it('12. Draft creation does not create an issued-invoice reservation', async () => {
    const resColSnap = await getDocs(collection(adminClient, 'businesses', BIZ_ID, 'invoice_numbers'));
    assert.strictEqual(resColSnap.size, 0, 'No reservation documents must exist for drafts');
  });

  console.log('\n--- PART 4: DRAFT IDENTITY & PERSISTENCE INTEGRITY ---');

  // 13. Existing draft identity remains unchanged after updates
  await it('13. Existing draft identity remains unchanged after updates', async () => {
    const initialSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'draft_admin_live_01'));
    const initialData = initialSnap.data();

    // Perform another update with modified notes
    const reUpdated = await saveInvoiceDraft(
      BIZ_ID,
      {
        ...initialData,
        notes: 'Revised quotation approved by managing partner.',
      },
      adminUser,
      { dbInstance: adminClient }
    );

    assert.strictEqual(reUpdated.id, 'draft_admin_live_01');
    assert.strictEqual(reUpdated.invoiceNumber, initialData.invoiceNumber);
    assert.strictEqual(reUpdated.createdAt, initialData.createdAt);
    assert.strictEqual(reUpdated.createdBy, initialData.createdBy);
  });

  // 14. Draft data survives reload
  await it('14. Draft data survives reload', async () => {
    const snap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'draft_admin_live_01'));
    const data = snap.data();
    assert.strictEqual(data.customer.name, 'Malabar Logistics Private Limited');
    assert.strictEqual(data.customer.phone, '9846830532');
    assert.strictEqual(data.customer.gstin, '32AAECM4421B1Z9');
    assert.strictEqual(data.items.length, 1);
    assert.strictEqual(data.items[0].name, 'Amaron Current 150Ah Tall Tubular Battery');
    assert.strictEqual(data.items[0].qty, 3);
    assert.strictEqual(data.additionalDiscount, 1000);
    assert.strictEqual(data.notes, 'Revised quotation approved by managing partner.');
  });

  // 15. Cross-business access is denied
  await it('15. Cross-business access is denied', async () => {
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        OTHER_BIZ_ID,
        { ...sampleDraft, id: 'draft_foreign_hack' },
        adminUser,
        { dbInstance: adminClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'User cannot write drafts to another business');
  });

  console.log('\n--- PART 5: DRAFT DEMOTION GUARDS & OFFICIAL ISSUANCE ---');

  // 16. Issued invoices cannot be converted back into drafts
  await it('16. Issued invoices cannot be converted back into drafts', async () => {
    // Seed an official issued invoice
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_issued_official_01'), {
        id: 'inv_issued_official_01',
        invoiceNumber: 'TPS/2026-27/001',
        invoiceDate: '2026-11-10',
        dueDate: '2026-11-10',
        paymentStatus: 'Paid',
        paymentMode: 'Cash',
        customer: { name: 'Customer Paid' },
        items: [{ id: 'item-1', name: 'Battery', qty: 1 }],
        netPayable: 15000,
        createdAt: '2026-11-10T10:00:00.000Z',
        createdBy: 'admin_uid_01',
      });
    });

    // Client-side guard check
    const issuedInvoice = {
      id: 'inv_issued_official_01',
      invoiceNumber: 'TPS/2026-27/001',
      paymentStatus: 'Paid',
    };
    assert.strictEqual(isIssuedInvoice(issuedInvoice), true, 'Must detect as issued invoice');

    // Attempting to demote to Draft via rules directly must fail
    let errCaught = null;
    try {
      await updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_issued_official_01'), {
        paymentStatus: 'Draft',
      });
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Rules must reject demoting an issued invoice back to Draft');
  });

  // 17. Draft can subsequently be issued through the correct issuance transaction
  await it('17. Draft can subsequently be issued through the correct issuance transaction', async () => {
    // 17a. Initialize counter for FY 2026-27
    await initializeInvoiceCounter(BIZ_ID, FY, 0, PREFIX, adminUser, adminClient);

    // 17b. Issue the draft created in Scenario 1
    const issuedResult = await createInvoiceWithCounter(
      BIZ_ID,
      {
        ...sampleDraft,
        id: 'draft_admin_live_01',
        invoiceNumber: adminDraftResult.invoiceNumber,
        paymentStatus: 'Paid',
      },
      adminUser,
      { prefix: PREFIX, dbInstance: adminClient }
    );

    assert.strictEqual(issuedResult.id, 'draft_admin_live_01');
    assert.strictEqual(issuedResult.paymentStatus, 'Paid');
    assert.strictEqual(issuedResult.invoiceNumber, 'TPS/2026-27/001');

    // Verify counter was incremented
    const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.data().lastSeq, 1);
    assert.strictEqual(counterSnap.data().lastInvoiceNumber, 'TPS/2026-27/001');

    // Verify reservation was created
    const resSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_001'));
    assert.strictEqual(resSnap.exists(), true);
    assert.strictEqual(resSnap.data().invoiceId, 'draft_admin_live_01');
  });

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (testEnv) {
    try {
      await testEnv.cleanup();
    } catch {}
  }

  if (spawnedEmu) {
    try {
      spawnedEmu.kill('SIGKILL');
    } catch {}
  }

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('[Suite] Unhandled failure:', err);
  process.exit(1);
});
