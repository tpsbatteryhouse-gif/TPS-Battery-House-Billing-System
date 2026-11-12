/**
 * TPS BATTERY HOUSE — SAVE FOR LATER ON ISSUED INVOICE REPAIR SUITE
 *
 * Exhaustively tests all 10 required scenarios against the live Firebase Firestore Emulator:
 * 1. Saving an existing draft.
 * 2. Saving a new unsaved invoice as a draft.
 * 3. Editing an issued invoice.
 * 4. Changing an issued invoice from Paid to Pending.
 * 5. Preventing accidental conversion of issued invoices into drafts.
 * 6. Preventing duplicate invoice creation.
 * 7. Preserving invoice numbers.
 * 8. Preserving payment history and outstanding balances.
 * 9. Unauthorized users attempting to edit issued invoices.
 * 10. Reopening the invoice and verifying that the saved payment status persists.
 */

import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';
import {
  saveInvoiceDraft,
  updateInvoice,
  initializeInvoiceCounter,
} from '../src/firebase/services/invoiceService.js';
import {
  isIssuedInvoice,
  hasMeaningfulInvoiceData,
} from '../src/utils/draftState.js';
import {
  canUserEditIssuedInvoice,
} from '../src/utils/permissions.js';
import { calculateDashboardMetrics } from '../src/utils/dashboardFinancialMetrics.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';
const FY = '2026-27';
const PREFIX = 'TPS/2026-27/';

let passed = 0;
let failed = 0;

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
  console.log('================================================================');
  console.log('TPS BATTERY HOUSE — SAVE FOR LATER ON ISSUED INVOICE TEST SUITE');
  console.log('================================================================\n');

  let emuProcess = null;
  try {
    emuProcess = await ensureEmulator();
  } catch (err) {
    console.error('[Error] Could not start Firestore emulator:', err.message);
    process.exit(1);
  }

  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
    },
  });

  // Clear firestore with retry to handle 499 reset
  for (let i = 0; i < 5; i++) {
    try {
      await testEnv.clearFirestore();
      break;
    } catch (err) {
      if (i === 4) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  // Seed memberships & businesses
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERY HOUSE',
      gstin: '32DIUPP1211B2ZN',
      stateCode: '32',
    });

    // 1. Admin
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_uid'), {
      uid: 'admin_uid',
      email: 'admin@tps.com',
      displayName: 'TPS Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });

    // 2. Manager
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_uid'), {
      uid: 'manager_uid',
      email: 'manager@tps.com',
      displayName: 'Store Manager',
      role: 'manager',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });

    // 3. Cashier
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_uid'), {
      uid: 'cashier_uid',
      email: 'cashier@tps.com',
      displayName: 'Store Cashier',
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });
  });

  const adminClient = testEnv.authenticatedContext('admin_uid', { email: 'admin@tps.com' }).firestore();
  const managerClient = testEnv.authenticatedContext('manager_uid', { email: 'manager@tps.com' }).firestore();
  const cashierClient = testEnv.authenticatedContext('cashier_uid', { email: 'cashier@tps.com' }).firestore();

  const adminUser = { uid: 'admin_uid', email: 'admin@tps.com', role: 'admin', status: 'active' };
  const managerUser = { uid: 'manager_uid', email: 'manager@tps.com', role: 'manager', status: 'active' };
  const cashierUser = { uid: 'cashier_uid', email: 'cashier@tps.com', role: 'cashier', status: 'active' };

  // Initialize invoice counter
  await initializeInvoiceCounter(BIZ_ID, FY, 9, PREFIX, adminUser, adminClient);

  // Seed existing issued invoice: TPS/2026-27/010 (Paid)
  const initialIssuedInvoice = {
    id: 'inv_010',
    invoiceNumber: 'TPS/2026-27/010',
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-10',
    transactionType: 'B2C',
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    customer: {
      name: 'Muhammed Kutty',
      phone: '9847112233',
      address: 'Main Road, Thrithala',
      city: 'Thrithala',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679552',
    },
    items: [
      {
        id: 'item-1',
        name: 'Exide InvaMaster 150Ah Tall Tubular Battery',
        category: 'battery',
        qty: 1,
        rate: 15000,
        isTaxInclusive: true,
        gstRate: 28,
        unit: 'Nos',
        hsn: '8507',
      },
    ],
    additionalDiscount: 0,
    scrapExchange: {
      enabled: false,
      amount: 0,
      description: '',
    },
    roundOffManual: null,
    netPayable: 15000,
    notes: 'Standard bill',
    createdAt: '2026-11-10T10:00:00.000Z',
    createdBy: 'admin_uid',
    businessSnapshot: {
      businessName: 'TPS BATTERY HOUSE',
      gstin: '32DIUPP1211B2ZN',
      stateCode: '32',
    },
    financialYear: FY,
  };

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_010'), initialIssuedInvoice);
    await setDoc(doc(db, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_010'), {
      invoiceId: 'inv_010',
      invoiceNumber: 'TPS/2026-27/010',
      financialYear: FY,
      createdAt: '2026-11-10T10:00:00.000Z',
      createdBy: 'admin_uid',
    });
    // Update counter to 10
    await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`), {
      lastSeq: 10,
      lastInvoiceId: 'inv_010',
      lastInvoiceNumber: 'TPS/2026-27/010',
      financialYear: FY,
      prefix: PREFIX,
    });
  });

  console.log('--- TEST GROUP 1: DRAFT PERSISTENCE (CASES A & C) ---');

  // 1. Saving an existing draft
  await it('1. Saving an existing draft preserves identity and DRAFT prefix', async () => {
    const existingDraftData = {
      id: 'inv_draft_test_01',
      invoiceNumber: 'DRAFT-123456',
      customer: { name: 'Draft Customer 1' },
      items: [{ id: 'item-1', name: 'Battery 100Ah', qty: 1, rate: 8000, isTaxInclusive: true, gstRate: 28 }],
      paymentStatus: 'Draft',
      invoiceDate: '2026-11-11',
      dueDate: '2026-11-11',
    };

    const saved1 = await saveInvoiceDraft(BIZ_ID, existingDraftData, adminUser, { dbInstance: adminClient });
    assert.strictEqual(saved1.id, 'inv_draft_test_01');
    assert.strictEqual(saved1.invoiceNumber, 'DRAFT-123456');
    assert.strictEqual(saved1.paymentStatus, 'Draft');

    // Update existing draft
    const updatedDraftData = {
      ...saved1,
      customer: { name: 'Draft Customer 1 (Updated)' },
      items: [{ id: 'item-1', name: 'Battery 100Ah', qty: 2, rate: 8000, isTaxInclusive: true, gstRate: 28 }],
    };

    const saved2 = await saveInvoiceDraft(BIZ_ID, updatedDraftData, adminUser, { dbInstance: adminClient });
    assert.strictEqual(saved2.id, 'inv_draft_test_01');
    assert.strictEqual(saved2.invoiceNumber, 'DRAFT-123456');
    assert.strictEqual(saved2.customer.name, 'Draft Customer 1 (Updated)');
    assert.strictEqual(saved2.items[0].qty, 2);
  });

  // 2. Saving a new unsaved invoice as a draft
  await it('2. Saving a new unsaved invoice as a draft does not consume official counter', async () => {
    const newInvoiceTemplate = {
      id: 'inv-temp-' + Date.now(),
      invoiceNumber: 'TPS/2026-27/---',
      customer: { name: 'New Walk-in Customer', phone: '9988776655' },
      items: [{ id: 'item-1', name: 'Solar Inverter 1kVA', qty: 1, rate: 12000, isTaxInclusive: true, gstRate: 18 }],
      paymentStatus: 'Paid', // Default selection in UI
      invoiceDate: '2026-11-11',
      dueDate: '2026-11-11',
    };

    // Client classifier check: must NOT be classified as an issued invoice
    assert.strictEqual(isIssuedInvoice(newInvoiceTemplate), false, 'New template must not be identified as issued');
    assert.strictEqual(hasMeaningfulInvoiceData(newInvoiceTemplate), true, 'Must have meaningful data');

    // Save as draft
    const draftSaved = await saveInvoiceDraft(BIZ_ID, newInvoiceTemplate, cashierUser, { dbInstance: cashierClient });
    assert.strictEqual(draftSaved.paymentStatus, 'Draft');
    assert(draftSaved.invoiceNumber.startsWith('DRAFT-'), `Must assign DRAFT- number, got ${draftSaved.invoiceNumber}`);

    // Verify counter was NOT incremented
    const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.data().lastSeq, 10, 'Counter must remain exactly 10');
  });

  console.log('\n--- TEST GROUP 2: ISSUED INVOICE EDITING & PAYMENT STATUS TRANSITION (CASE B) ---');

  // 3. Editing an issued invoice
  await it('3. Editing an issued invoice preserves original invoiceNumber and doc id', async () => {
    // Administrator updates notes on issued invoice
    const updatePayload = {
      ...initialIssuedInvoice,
      notes: 'Customer requested 36-month warranty stamped on invoice.',
    };

    const updated = await updateInvoice(BIZ_ID, 'inv_010', updatePayload, adminUser, adminClient);
    assert.strictEqual(updated.id, 'inv_010');
    assert.strictEqual(updated.invoiceNumber, 'TPS/2026-27/010');
    assert.strictEqual(updated.notes, 'Customer requested 36-month warranty stamped on invoice.');
  });

  // 4. Changing an issued invoice from Paid to Pending
  await it('4. Changing an issued invoice from Paid to Pending succeeds via updateInvoice', async () => {
    // Reproduction Scenario: User changes "Paid now" to "Pay later"
    const updatePayload = {
      ...initialIssuedInvoice,
      paymentStatus: 'Pending',
    };

    const updated = await updateInvoice(BIZ_ID, 'inv_010', updatePayload, adminUser, adminClient);
    assert.strictEqual(updated.id, 'inv_010');
    assert.strictEqual(updated.invoiceNumber, 'TPS/2026-27/010');
    assert.strictEqual(updated.paymentStatus, 'Pending', 'Payment status must be updated to Pending');
    assert.strictEqual(updated.netPayable, 15000, 'Financial totals must remain strictly intact');
  });

  // 5. Preventing accidental conversion of issued invoices into drafts
  await it('5. Preventing accidental conversion of issued invoices into drafts', async () => {
    // Client classifier check
    const issuedInv = {
      id: 'inv_010',
      invoiceNumber: 'TPS/2026-27/010',
      paymentStatus: 'Pending',
    };
    assert.strictEqual(isIssuedInvoice(issuedInv), true, 'Must correctly identify as issued invoice');

    // Attempting to demote issued invoice to Draft via Firestore update must fail under rules
    let rulesError = null;
    try {
      await updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_010'), {
        paymentStatus: 'Draft',
      });
    } catch (err) {
      rulesError = err;
    }
    assert(rulesError !== null, 'Firestore rules MUST reject converting issued invoice to Draft');
  });

  // 6. Preventing duplicate invoice creation
  await it('6. Editing an issued invoice does not create duplicate documents or increment counter', async () => {
    const invoicesSnapBefore = await getDocs(collection(adminClient, 'businesses', BIZ_ID, 'invoices'));
    const countBefore = invoicesSnapBefore.size;

    // Perform another update on inv_010
    await updateInvoice(BIZ_ID, 'inv_010', {
      ...initialIssuedInvoice,
      paymentStatus: 'Pending',
      paymentMode: 'Bank Transfer (NEFT/RTGS/IMPS)',
    }, adminUser, adminClient);

    const invoicesSnapAfter = await getDocs(collection(adminClient, 'businesses', BIZ_ID, 'invoices'));
    const countAfter = invoicesSnapAfter.size;

    assert.strictEqual(countAfter, countBefore, 'Invoice document count must not increase');

    // Check counter
    const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.data().lastSeq, 10, 'Counter must NOT be consumed on update');
  });

  // 7. Preserving invoice numbers
  await it('7. Preserving invoice numbers: attempt to tamper with invoiceNumber is rejected', async () => {
    let rulesError = null;
    try {
      await updateDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_010'), {
        invoiceNumber: 'TPS/2026-27/999',
      });
    } catch (err) {
      rulesError = err;
    }
    assert(rulesError !== null, 'Firestore rules MUST reject modifying invoiceNumber of issued invoice');
  });

  // 8. Preserving payment history and outstanding balances
  await it('8. Financial metrics correctly reflect transition from Paid to Pending', async () => {
    // Test dataset with 1 Paid invoice and 1 newly changed to Pending
    const dataset = [
      {
        id: 'inv_010',
        invoiceNumber: 'TPS/2026-27/010',
        invoiceDate: '2026-11-10',
        paymentStatus: 'Pending',
        netPayable: 15000,
        items: [{ id: '1', category: 'battery', rate: 15000, qty: 1 }],
      },
    ];

    const metrics = calculateDashboardMetrics(dataset);
    assert.strictEqual(metrics.financials.totalBilled, 15000, 'Total billed must remain 15,000');
    assert.strictEqual(metrics.financials.collectedRevenue, 0, 'Collected revenue is 0 since invoice is now Pending');
    assert.strictEqual(metrics.financials.pendingAmount, 15000, 'Pending amount must be 15,000');
    assert.strictEqual(metrics.financials.totalOutstanding, 15000, 'Total outstanding must be 15,000');
  });

  console.log('\n--- TEST GROUP 3: SECURITY & AUTHORIZATION BOUNDARIES ---');

  // 9. Unauthorized users attempting to edit issued invoices
  await it('9a. Cashier cannot edit an issued invoice (client check & emulator rules)', async () => {
    // 1. Client permission check
    const perm = canUserEditIssuedInvoice(cashierUser, initialIssuedInvoice);
    assert.strictEqual(perm.allowed, false);
    assert(perm.reason.includes('Billing cashiers cannot modify'));

    // 2. Emulator rules rejection
    let rulesError = null;
    try {
      await updateDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'inv_010'), {
        paymentStatus: 'Paid',
      });
    } catch (err) {
      rulesError = err;
    }
    assert(rulesError !== null, 'Firestore rules must reject cashier updating issued invoice');
  });

  await it('9b. Manager cannot edit an invoice that was previously Paid (client check & emulator rules)', async () => {
    // Seed another issued invoice that is currently Paid in Firestore
    const paidInvoiceForManagerTest = {
      ...initialIssuedInvoice,
      id: 'inv_paid_mgr_test',
      invoiceNumber: 'TPS/2026-27/011',
      paymentStatus: 'Paid',
    };

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_paid_mgr_test'), paidInvoiceForManagerTest);
    });

    // 1. Client permission check
    const perm = canUserEditIssuedInvoice(managerUser, paidInvoiceForManagerTest);
    assert.strictEqual(perm.allowed, false);
    assert(perm.reason.includes('Only store administrators can modify an invoice that was previously issued as Paid'));

    // 2. Emulator rules rejection
    let rulesError = null;
    try {
      await updateDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'inv_paid_mgr_test'), {
        paymentStatus: 'Pending',
      });
    } catch (err) {
      rulesError = err;
    }
    assert(rulesError !== null, 'Firestore rules must reject manager updating Paid invoice');
  });

  // 10. Reopening the invoice and verifying that the saved payment status persists
  await it('10. Reopening invoice from Firestore verifies that Pending status persists', async () => {
    const snap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'inv_010'));
    assert(snap.exists(), 'Invoice inv_010 must exist');
    const data = snap.data();

    assert.strictEqual(data.id, 'inv_010');
    assert.strictEqual(data.invoiceNumber, 'TPS/2026-27/010');
    assert.strictEqual(data.paymentStatus, 'Pending', 'paymentStatus must persist as Pending');
    assert.strictEqual(data.netPayable, 15000);
    assert.strictEqual(data.customer.name, 'Muhammed Kutty');
    assert.strictEqual(data.items.length, 1);
  });

  console.log(`\n================================================================`);
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================`);

  if (emuProcess) {
    try {
      process.kill(-emuProcess.pid);
    } catch {
      try {
        emuProcess.kill('SIGKILL');
      } catch {}
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
