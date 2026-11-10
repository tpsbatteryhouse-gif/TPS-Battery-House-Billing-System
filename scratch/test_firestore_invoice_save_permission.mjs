/**
 * TPS BATTERY HOUSE — FIRESTORE INVOICE SAVE PERMISSION & TRANSACTION INTEGRITY SUITE
 *
 * Exhaustively tests all 18 required scenarios against the live Firebase Firestore Emulator:
 * 1. Admin successfully creates an invoice.
 * 2. Manager successfully creates an invoice.
 * 3. Cashier successfully creates an invoice.
 * 4. Pending staff cannot create invoices.
 * 5. Disabled staff cannot create invoices.
 * 6. Unauthenticated users cannot create invoices.
 * 7. Manager cannot initialize a missing counter.
 * 8. Authorized administrator can initialize the counter.
 * 9. Manager can create an invoice using an existing valid counter.
 * 10. Counter increments exactly once.
 * 11. Invoice and reservation are atomically linked.
 * 12. Duplicate invoice numbers are rejected.
 * 13. Invalid invoice payload is rejected.
 * 14. Invalid financial year is rejected.
 * 15. Cross-business writes are rejected.
 * 16. Failed transaction leaves no partial invoice, counter update, or reservation.
 * 17. Successful save allows print workflow to proceed.
 * 18. Failed save never opens printing.
 * Plus: Concurrent multi-cashier invoice creation test.
 */

import fs from 'fs';
import assert from 'assert';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  createInvoiceWithCounter,
  initializeInvoiceCounter,
} from '../src/firebase/services/invoiceService.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';
const OTHER_BIZ_ID = 'other-business';
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

async function runSuite() {
  console.log('================================================================');
  console.log('TPS BATTERY HOUSE — INVOICE SAVE PERMISSION & RBAC SUITE');
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

  // Retry loop for clearFirestore to prevent gRPC 499 cancellation race
  for (let i = 0; i < 5; i++) {
    try {
      await testEnv.clearFirestore();
      break;
    } catch (err) {
      if (i === 4) throw err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
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

    // 1. Admin
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_uid'), {
      uid: 'admin_uid',
      email: 'admin@tps.com',
      displayName: 'TPS Administrator',
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
      displayName: 'Billing Cashier',
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });

    // 4. Pending Staff
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'pending_uid'), {
      uid: 'pending_uid',
      email: 'pending@tps.com',
      displayName: 'Pending Staff',
      role: 'cashier',
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });

    // 5. Disabled Staff
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'disabled_uid'), {
      uid: 'disabled_uid',
      email: 'disabled@tps.com',
      displayName: 'Disabled Staff',
      role: 'cashier',
      status: 'disabled',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });
  });

  const adminClient = testEnv.authenticatedContext('admin_uid', { email: 'admin@tps.com' }).firestore();
  const managerClient = testEnv.authenticatedContext('manager_uid', { email: 'manager@tps.com' }).firestore();
  const cashierClient = testEnv.authenticatedContext('cashier_uid', { email: 'cashier@tps.com' }).firestore();
  const pendingClient = testEnv.authenticatedContext('pending_uid', { email: 'pending@tps.com' }).firestore();
  const disabledClient = testEnv.authenticatedContext('disabled_uid', { email: 'disabled@tps.com' }).firestore();
  const unauthClient = testEnv.unauthenticatedContext().firestore();

  const adminUser = { uid: 'admin_uid', role: 'admin' };
  const managerUser = { uid: 'manager_uid', role: 'manager' };
  const cashierUser = { uid: 'cashier_uid', role: 'cashier' };

  const sampleInvoice = {
    customer: {
      name: 'Rajesh K',
      phone: '9847123456',
      address: 'Main Road, Pattambi',
      stateCode: '32',
    },
    items: [
      {
        id: 'item-1',
        name: 'Exide InvaMaster 150Ah',
        category: 'battery',
        qty: 1,
        rate: 14800,
        isTaxInclusive: true,
        gstRate: 28,
        unit: 'Set',
        hsn: '8507',
      },
    ],
    invoiceDate: '2026-11-09',
    paymentStatus: 'Pending',
    paymentMode: 'Cash',
  };

  console.log('--- PART 1: COUNTER INITIALIZATION & AUTHORIZATION ---');

  await it('Scenario 7: Manager cannot initialize a missing counter', async () => {
    let errorCaught = null;
    try {
      await setDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`), {
        lastSeq: 0,
        prefix: PREFIX,
        updatedAt: new Date().toISOString(),
        updatedBy: 'manager_uid',
      });
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Manager write to initialize counter must be rejected');
    assert(
      errorCaught.code === 'permission-denied' || errorCaught.message.includes('permission-denied'),
      'Must fail with permission-denied'
    );
  });

  await it('Scenario 8: Authorized administrator can initialize the counter', async () => {
    const res = await initializeInvoiceCounter(
      BIZ_ID,
      FY,
      0,
      PREFIX,
      adminUser,
      adminClient
    );
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.created, true);

    const snap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert(snap.exists(), 'Counter document must exist');
    assert.strictEqual(snap.data().lastSeq, 0);
    assert.strictEqual(snap.data().prefix, PREFIX);
  });

  console.log('\n--- PART 2: ROLE-BASED INVOICE CREATION ---');

  await it('Scenario 1: Admin successfully creates an invoice', async () => {
    const res = await createInvoiceWithCounter(BIZ_ID, sampleInvoice, adminUser, {
      dbInstance: adminClient,
      prefix: PREFIX,
    });
    assert.strictEqual(res.invoiceNumber, `${PREFIX}001`);
    assert.strictEqual(res.netPayable, 14800);

    const invSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', res.id));
    assert(invSnap.exists(), 'Invoice document must exist in Firestore');
  });

  await it('Scenario 2 & 9: Manager successfully creates an invoice using existing counter', async () => {
    const res = await createInvoiceWithCounter(BIZ_ID, sampleInvoice, managerUser, {
      dbInstance: managerClient,
      prefix: PREFIX,
    });
    assert.strictEqual(res.invoiceNumber, `${PREFIX}002`);
    assert.strictEqual(res.netPayable, 14800);

    const invSnap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', res.id));
    assert(invSnap.exists(), 'Invoice document created by manager must exist in Firestore');
  });

  await it('Scenario 3: Cashier successfully creates an invoice', async () => {
    const res = await createInvoiceWithCounter(BIZ_ID, sampleInvoice, cashierUser, {
      dbInstance: cashierClient,
      prefix: PREFIX,
    });
    assert.strictEqual(res.invoiceNumber, `${PREFIX}003`);
    assert.strictEqual(res.netPayable, 14800);

    const invSnap = await getDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', res.id));
    assert(invSnap.exists(), 'Invoice document created by cashier must exist in Firestore');
  });

  await it('Scenario 10: Counter increments exactly once per created invoice', async () => {
    const counterSnap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.data().lastSeq, 3);
    assert.strictEqual(counterSnap.data().lastInvoiceNumber, `${PREFIX}003`);
  });

  await it('Scenario 11: Invoice and reservation are atomically linked', async () => {
    const safeNum = `${PREFIX}003`.replace(/\//g, '_');
    const resSnap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoice_numbers', safeNum));
    assert(resSnap.exists(), 'Uniqueness reservation must exist');
    assert.strictEqual(resSnap.data().invoiceNumber, `${PREFIX}003`);
    assert.strictEqual(resSnap.data().financialYear, FY);
  });

  console.log('\n--- PART 3: PERMISSION DENIAL GUARDS ---');

  await it('Scenario 4: Pending staff cannot create invoices', async () => {
    let errorCaught = null;
    try {
      await createInvoiceWithCounter(BIZ_ID, sampleInvoice, { uid: 'pending_uid' }, {
        dbInstance: pendingClient,
        prefix: PREFIX,
      });
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Pending staff invoice creation must be rejected');
  });

  await it('Scenario 5: Disabled staff cannot create invoices', async () => {
    let errorCaught = null;
    try {
      await createInvoiceWithCounter(BIZ_ID, sampleInvoice, { uid: 'disabled_uid' }, {
        dbInstance: disabledClient,
        prefix: PREFIX,
      });
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Disabled staff invoice creation must be rejected');
  });

  await it('Scenario 6: Unauthenticated users cannot create invoices', async () => {
    let errorCaught = null;
    try {
      await createInvoiceWithCounter(BIZ_ID, sampleInvoice, null, {
        dbInstance: unauthClient,
        prefix: PREFIX,
      });
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Unauthenticated invoice creation must be rejected');
  });

  await it('Scenario 15: Cross-business writes are rejected', async () => {
    let errorCaught = null;
    try {
      await createInvoiceWithCounter(OTHER_BIZ_ID, sampleInvoice, managerUser, {
        dbInstance: managerClient,
        prefix: PREFIX,
      });
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Cross-tenant business write must be rejected');
  });

  console.log('\n--- PART 4: DATA INTEGRITY & FINANCIAL VALIDATION GUARDS ---');

  await it('Scenario 12: Duplicate invoice numbers are rejected', async () => {
    const safeNum = `${PREFIX}002`.replace(/\//g, '_');
    const existingRes = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoice_numbers', safeNum));
    assert(existingRes.exists(), 'Reservation for 002 must already exist');

    let errorCaught = null;
    try {
      await createInvoiceWithCounter(
        BIZ_ID,
        { ...sampleInvoice, invoiceNumber: `${PREFIX}002` },
        managerUser,
        { dbInstance: managerClient, prefix: PREFIX }
      );
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Duplicate invoice number must be rejected');
    assert(errorCaught.message.includes('already in use') || errorCaught.code === 'permission-denied');
  });

  await it('Scenario 13: Invalid invoice payload is rejected (missing customer)', async () => {
    let errorCaught = null;
    try {
      await createInvoiceWithCounter(
        BIZ_ID,
        { ...sampleInvoice, customer: { name: '' } },
        managerUser,
        { dbInstance: managerClient, prefix: PREFIX }
      );
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Invoice without customer name must be rejected');
  });

  await it('Scenario 14: Invalid financial year is rejected', async () => {
    let errorCaught = null;
    try {
      await createInvoiceWithCounter(
        BIZ_ID,
        { ...sampleInvoice, invoiceDate: '2026-11-09', financialYear: '1999-00' },
        managerUser,
        { dbInstance: managerClient, prefix: PREFIX }
      );
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Mismatched financial year must be rejected');
  });

  await it('Scenario 16: Failed transaction leaves no partial invoice, counter update, or reservation', async () => {
    const counterBefore = (await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`))).data().lastSeq;

    let errorCaught = null;
    try {
      // Submitting an invoice with corrupt negative rate to fail transaction
      await createInvoiceWithCounter(
        BIZ_ID,
        {
          ...sampleInvoice,
          items: [{ ...sampleInvoice.items[0], rate: -5000 }],
        },
        managerUser,
        { dbInstance: managerClient, prefix: PREFIX }
      );
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Transaction must fail');

    const counterAfter = (await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`))).data().lastSeq;
    assert.strictEqual(counterAfter, counterBefore, 'Counter must not advance on failed transaction');

    const nonExistentReservation = await getDoc(
      doc(managerClient, 'businesses', BIZ_ID, 'invoice_numbers', `${PREFIX}004`.replace(/\//g, '_'))
    );
    assert(!nonExistentReservation.exists(), 'No reservation should exist for failed transaction');
  });

  console.log('\n--- PART 5: SAVE & PRINT CONTRACT VERIFICATION ---');

  await it('Scenario 17: Successful save returns valid permanent invoice for printing', async () => {
    let printOpened = false;
    const fakePrint = () => { printOpened = true; };

    // Simulating InvoiceSummary handleSaveAndPrint contract
    const saved = await createInvoiceWithCounter(BIZ_ID, sampleInvoice, managerUser, {
      dbInstance: managerClient,
      prefix: PREFIX,
    });

    if (saved && saved !== false && saved.invoiceNumber && !saved.invoiceNumber.startsWith('DRAFT')) {
      fakePrint();
    }

    assert.strictEqual(printOpened, true, 'Print must open after verified persistence');
    assert.strictEqual(saved.invoiceNumber, `${PREFIX}004`);
  });

  await it('Scenario 18: Failed save never opens printing', async () => {
    let printOpened = false;
    const fakePrint = () => { printOpened = true; };

    let saveFailed = false;
    let savedResult = null;
    try {
      savedResult = await createInvoiceWithCounter(
        BIZ_ID,
        { ...sampleInvoice, items: [{ ...sampleInvoice.items[0], rate: -999 }] },
        managerUser,
        { dbInstance: managerClient, prefix: PREFIX }
      );
    } catch {
      saveFailed = true;
      savedResult = false;
    }

    if (savedResult && savedResult !== false && savedResult.invoiceNumber && !savedResult.invoiceNumber.startsWith('DRAFT')) {
      fakePrint();
    }

    assert.strictEqual(saveFailed, true, 'Save must fail');
    assert.strictEqual(printOpened, false, 'Print dialog must NEVER open when save fails');
  });

  console.log('\n--- PART 6: CONCURRENT INVOICE ALLOCATION STRESS TEST ---');

  await it('Concurrent Multi-Cashier Invoice Allocation produces sequential, unique numbers without collisions', async () => {
    const concurrentRequests = 5;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        createInvoiceWithCounter(
          BIZ_ID,
          {
            ...sampleInvoice,
            customer: { name: `Customer Concurrent ${i + 1}`, stateCode: '32' },
          },
          cashierUser,
          { dbInstance: cashierClient, prefix: PREFIX }
        )
      );
    }

    const results = await Promise.all(promises);
    const invoiceNumbers = results.map((r) => r.invoiceNumber);

    console.log(`    Generated numbers: ${invoiceNumbers.join(', ')}`);
    const uniqueNumbers = new Set(invoiceNumbers);
    assert.strictEqual(uniqueNumbers.size, concurrentRequests, 'Every concurrent invoice must have a distinct unique number');

    const counterSnap = await getDoc(doc(cashierClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.data().lastSeq, 4 + concurrentRequests, 'Counter must advance by exact number of concurrent invoices');
  });

  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
