import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { createInvoiceWithCounter } from '../src/firebase/services/invoiceService.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  return async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ PASS: ${desc}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ FAIL: ${desc} -> ${err.message}`);
    }
  };
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
  const running = await checkEmulatorRunning();
  if (running) return null;

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
    throw new Error('Could not find firestore-emulator.jar');
  }

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

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkEmulatorRunning()) {
      return emuProcess;
    }
  }
  throw new Error('Timed out waiting for Firestore emulator to start');
}

async function runSuite() {
  console.log('================================================================');
  console.log('PHASE 5.2 — CLIENT SDK INVOICE CONCURRENCY & INTEGRITY SUITE');
  console.log(`Target: http://${EMULATOR_HOST}:${EMULATOR_PORT} | Project: ${PROJECT_ID}`);
  console.log('================================================================\n');

  await ensureEmulator();

  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
    },
  });

  await testEnv.clearFirestore();

  try {
    // -------------------------------------------------------------
    // SEEDING FIXTURES
    // -------------------------------------------------------------
    console.log('--- Step 0: Seeding Active Cashier & Counter Fixtures ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Business Doc
      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERY HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      // Active Cashier
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_user'), {
        uid: 'cashier_user',
        email: 'cashier@tps.com',
        displayName: 'Counter Cashier',
        role: 'cashier',
        status: 'active',
        createdAt: new Date(),
      });

      // Active Admin
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_user'), {
        uid: 'admin_user',
        email: 'admin@tps.com',
        displayName: 'Store Admin',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
      });

      // Initialized Counter for FY 2026-27 starting at seq 100
      await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
        lastSeq: 100,
        prefix: 'TPS/2026-27/',
      });
    });

    const ctxCashier = testEnv.authenticatedContext('cashier_user');
    const dbCashier = ctxCashier.firestore();

    const ctxAdmin = testEnv.authenticatedContext('admin_user');
    const dbAdmin = ctxAdmin.firestore();

    // -------------------------------------------------------------
    // TEST 1: 5 CONCURRENT INVOICE CREATIONS
    // -------------------------------------------------------------
    console.log('\n--- 1. Burst Concurrency: 5 Concurrent Invoices ---');
    await it('executes 5 concurrent client invoice creations with zero collisions', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        return createInvoiceWithCounter(
          BIZ_ID,
          {
            customer: { name: `Burst Customer 5-${i + 1}`, phone: '9846000000', stateCode: '32' },
            items: [{ id: 'p1', name: 'Amaron 150Ah', qty: 1, rate: 10000, gstRate: 28, isTaxInclusive: false }],
            paymentStatus: 'Paid',
            paymentMode: 'Cash',
            invoiceDate: '2026-11-03',
            dueDate: '2026-11-03',
          },
          { uid: 'cashier_user' },
          { dbInstance: dbCashier }
        );
      });

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 5, 'All 5 invoices returned');

      const numbers = results.map((r) => r.invoiceNumber);
      const uniqueNumbers = new Set(numbers);
      assert.strictEqual(uniqueNumbers.size, 5, 'All 5 invoice numbers are unique (0 collisions)');

      // Extract sequence numbers and verify they span 101 to 105
      const seqs = numbers.map((n) => parseInt(n.split('/').pop(), 10)).sort((a, b) => a - b);
      assert.deepStrictEqual(seqs, [101, 102, 103, 104, 105], 'Sequence numbers are strictly 101-105');

      // Verify counter in Firestore is at 105
      const counterSnap = await getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'));
      assert.strictEqual(counterSnap.data().lastSeq, 105, 'Counter document sequence updated to 105');
    })();

    // -------------------------------------------------------------
    // TEST 2: 10 CONCURRENT INVOICE CREATIONS
    // -------------------------------------------------------------
    console.log('\n--- 2. High-Contention Concurrency: 10 Concurrent Invoices ---');
    await it('executes 10 concurrent client invoice creations under contention with zero duplicates', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        return createInvoiceWithCounter(
          BIZ_ID,
          {
            customer: { name: `Burst Customer 10-${i + 1}`, phone: '9846000000', stateCode: '32' },
            items: [{ id: 'p2', name: 'Luminous 1100VA', qty: 1, rate: 8500, gstRate: 18, isTaxInclusive: false }],
            paymentStatus: 'Paid',
            paymentMode: 'UPI',
            invoiceDate: '2026-11-03',
            dueDate: '2026-11-03',
          },
          { uid: 'cashier_user' },
          { dbInstance: dbCashier }
        );
      });

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 10, 'All 10 invoices returned');

      const numbers = results.map((r) => r.invoiceNumber);
      const uniqueNumbers = new Set(numbers);
      assert.strictEqual(uniqueNumbers.size, 10, 'All 10 invoice numbers are unique (0 collisions)');

      const seqs = numbers.map((n) => parseInt(n.split('/').pop(), 10)).sort((a, b) => a - b);
      assert.deepStrictEqual(seqs, [106, 107, 108, 109, 110, 111, 112, 113, 114, 115], 'Sequence numbers are strictly 106-115');

      const counterSnap = await getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'));
      assert.strictEqual(counterSnap.data().lastSeq, 115, 'Counter document sequence updated to 115');
    })();

    // -------------------------------------------------------------
    // TEST 3: DUPLICATE INVOICE NUMBER PREVENTION
    // -------------------------------------------------------------
    console.log('\n--- 3. Duplicate Invoice Number & Reservation Guard ---');
    await it('rejects creation of invoice with duplicate number through client reservation tombstone', async () => {
      // Attempt to save invoice specifying number TPS/2026-27/105 which was already assigned in Test 1
      let rejected = false;
      try {
        await createInvoiceWithCounter(
          BIZ_ID,
          {
            invoiceNumber: 'TPS/2026-27/105',
            customer: { name: 'Impostor Customer', phone: '9846000000', stateCode: '32' },
            items: [{ id: 'p1', name: 'Battery', qty: 1, rate: 5000, gstRate: 28 }],
            paymentStatus: 'Paid',
            paymentMode: 'Cash',
            invoiceDate: '2026-11-03',
          },
          { uid: 'cashier_user' },
          { dbInstance: dbCashier }
        );
      } catch (err) {
        rejected = true;
        assert(err.message.includes('already in use') || err.message.includes('PERMISSION_DENIED'), 'Duplicate reservation rejected');
      }
      assert.strictEqual(rejected, true, 'Duplicate invoice number was rejected');
    })();

    // -------------------------------------------------------------
    // TEST 4: ABORTED TRANSACTION ROLLBACK INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- 4. Aborted Transaction Rollback Integrity ---');
    await it('commits zero partial state when a client transaction fails midway', async () => {
      const counterBefore = (await getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'))).data().lastSeq;
      const targetNumber = `TPS/2026-27/${String(counterBefore + 1).padStart(3, '0')}`;
      const safeTarget = targetNumber.replace(/\//g, '_');

      let failedTxn = false;
      try {
        await runTransaction(dbCashier, async (tx) => {
          const counterRef = doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
          tx.update(counterRef, { lastSeq: counterBefore + 1 });

          const resRef = doc(dbCashier, 'businesses', BIZ_ID, 'invoice_numbers', safeTarget);
          tx.set(resRef, { invoiceNumber: targetNumber, invoiceId: 'inv_fail_test' });

          // Deliberate failure: throw error inside transaction
          throw new Error('SIMULATED_CLIENT_NETWORK_DROP');
        });
      } catch (err) {
        if (err.message === 'SIMULATED_CLIENT_NETWORK_DROP') failedTxn = true;
      }

      assert.strictEqual(failedTxn, true, 'Transaction threw simulated failure');

      // Verify ZERO partial state committed
      const counterAfter = (await getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'))).data().lastSeq;
      assert.strictEqual(counterAfter, counterBefore, 'Counter remained unmutated');

      const resAfter = await getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'invoice_numbers', safeTarget));
      assert.strictEqual(resAfter.exists(), false, 'Reservation was not created (rolled back)');
    })();

    // -------------------------------------------------------------
    // TEST 5: FINANCIAL YEAR TRANSITION (APRIL 1 BOUNDARY)
    // -------------------------------------------------------------
    console.log('\n--- 5. Financial Year Boundary Transition (Apr 1) ---');
    await it('transitions gracefully to new financial year prefix and sequence 1', async () => {
      // First, Admin initializes counter for upcoming FY 2027-28
      await setDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'counters', 'invoices_2027-28'), {
        lastSeq: 0,
        prefix: 'TPS/2027-28/',
      });

      // Invoice on April 1, 2027
      const apr1Invoice = await createInvoiceWithCounter(
        BIZ_ID,
        {
          customer: { name: 'FY 27-28 First Customer', phone: '9846000000', stateCode: '32' },
          items: [{ id: 'p1', name: 'Exide Solar 150Ah', qty: 1, rate: 15000, gstRate: 28 }],
          paymentStatus: 'Paid',
          paymentMode: 'Cash',
          invoiceDate: '2027-04-01',
          dueDate: '2027-04-01',
        },
        { uid: 'cashier_user' },
        { dbInstance: dbCashier }
      );

      assert.strictEqual(apr1Invoice.invoiceNumber, 'TPS/2027-28/001', 'First invoice of FY 2027-28 is TPS/2027-28/001');

      // Second invoice on April 2, 2027
      const apr2Invoice = await createInvoiceWithCounter(
        BIZ_ID,
        {
          customer: { name: 'FY 27-28 Second Customer', phone: '9846000000', stateCode: '32' },
          items: [{ id: 'p2', name: 'Microtek Inverter', qty: 1, rate: 7500, gstRate: 18 }],
          paymentStatus: 'Paid',
          paymentMode: 'UPI',
          invoiceDate: '2027-04-02',
          dueDate: '2027-04-02',
        },
        { uid: 'cashier_user' },
        { dbInstance: dbCashier }
      );

      assert.strictEqual(apr2Invoice.invoiceNumber, 'TPS/2027-28/002', 'Second invoice of FY 2027-28 is TPS/2027-28/002');

      const fy27Counter = await getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2027-28'));
      assert.strictEqual(fy27Counter.data().lastSeq, 2, 'FY 27-28 counter is at 2');

      // Verify that FY 2026-27 counter remained untouched at 115
      const fy26Counter = await getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'));
      assert.strictEqual(fy26Counter.data().lastSeq, 115, 'FY 26-27 counter remained untouched at 115');
    })();

  } finally {
    await testEnv.cleanup();
  }

  console.log('\n================================================================');
  console.log(`INVOICE CONCURRENCY RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
