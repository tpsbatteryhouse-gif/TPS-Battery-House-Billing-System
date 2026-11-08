import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house-phase6b';
const BIZ_ID = 'tps-battery-house';
const OTHER_BIZ = 'competing-battery-store';

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

async function check(p, desc, shouldSucceed = true) {
  try {
    if (shouldSucceed) {
      await assertSucceeds(p);
      console.log(`  ✓ PASS (ALLOWED): ${desc}`);
    } else {
      await assertFails(p);
      console.log(`  ✓ PASS (DENIED):  ${desc}`);
    }
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc} -> Expected ${shouldSucceed ? 'SUCCESS' : 'PERMISSION_DENIED'}, got: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('PHASE 6B — FIRESTORE RULES DEEP SECURITY & IMMUTABILITY AUDIT');
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
    // 1. Seed members and invoice
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERY HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      // Admin
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_1'), {
        uid: 'admin_1',
        email: 'admin@tps.com',
        displayName: 'Admin User',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'system',
      });

      // Manager
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_1'), {
        uid: 'manager_1',
        email: 'manager@tps.com',
        displayName: 'Manager User',
        role: 'manager',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin_1',
      });

      // Cashier
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_1'), {
        uid: 'cashier_1',
        email: 'cashier@tps.com',
        displayName: 'Cashier User',
        role: 'cashier',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin_1',
      });

      // Seed an existing invoice with businessSnapshot and financialYear
      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_test_001'), {
        id: 'inv_test_001',
        invoiceNumber: 'TPS/24-25/0001',
        invoiceDate: '2024-05-10',
        dueDate: '2024-05-10',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        financialYear: '2024-25',
        customer: { name: 'Test Customer' },
        items: [{ name: 'Battery', rate: 5000, qty: 1, gstRate: 18, amount: 5000 }],
        netPayable: 5900,
        createdAt: '2024-05-10T10:00:00.000Z',
        createdBy: 'admin_1',
        businessSnapshot: {
          businessName: 'TPS BATTERY HOUSE',
          address: 'Main Road',
          gstin: '32DIUPP1211B2ZN',
          phone: '9876543210',
          email: 'tps@gmail.com',
          bankName: 'SBI',
          accountNo: '1234567890',
          ifsc: 'SBIN0001234',
          upiId: 'tps@sbi',
          terms: ['Warranty 24 months', 'Subject to local jurisdiction'],
          footerText: 'Thank you',
          authorizedSignatory: 'Manager',
          city: 'Calicut',
        },
      });

      // Seed counter
      await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2024-25'), {
        lastSeq: 1,
        prefix: 'TPS/24-25/',
        lastInvoiceId: 'inv_test_001',
        lastInvoiceNumber: 'TPS/24-25/0001',
      });

      // Seed reservation
      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_24-25_0001'), {
        invoiceId: 'inv_test_001',
        invoiceNumber: 'TPS/24-25/0001',
        financialYear: '2024-25',
        createdAt: '2024-05-10T10:00:00.000Z',
        createdBy: 'admin_1',
      });
    });

    const adminCtx = testEnv.authenticatedContext('admin_1');
    const adminDb = adminCtx.firestore();

    const managerCtx = testEnv.authenticatedContext('manager_1');
    const managerDb = managerCtx.firestore();

    const cashierCtx = testEnv.authenticatedContext('cashier_1');
    const cashierDb = cashierCtx.firestore();

    console.log('\n--- 1. Testing businessSnapshot Immutability (Terms Tampering) ---');
    // An update that alters the terms text while preserving terms.length (2 items)
    const tamperedTermsPayload = {
      businessSnapshot: {
        businessName: 'TPS BATTERY HOUSE',
        address: 'Main Road',
        gstin: '32DIUPP1211B2ZN',
        phone: '9876543210',
        email: 'tps@gmail.com',
        bankName: 'SBI',
        accountNo: '1234567890',
        ifsc: 'SBIN0001234',
        upiId: 'tps@sbi',
        terms: ['FRAUDULENT: NO WARRANTY AT ALL', 'FRAUDULENT: NO REFUNDS EVER'],
        footerText: 'Thank you',
        authorizedSignatory: 'Manager',
        city: 'Calicut',
      },
    };

    // Before fix, this might succeed if rules only check terms.size() == terms.size()
    console.log('Testing whether tampering terms content (same size) is blocked:');
    await check(
      updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_test_001'), tamperedTermsPayload),
      'Admin cannot modify terms text inside historical businessSnapshot',
      false
    );

    await check(
      updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_test_001'), tamperedTermsPayload),
      'Manager cannot modify terms text inside historical businessSnapshot',
      false
    );

    console.log('\n--- 2. Testing financialYear Immutability ---');
    await check(
      updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_test_001'), {
        financialYear: '2025-26',
      }),
      'Admin cannot alter financialYear on existing invoice',
      false
    );

    console.log('\n--- 2b. Testing admin_guard Strict Validation ---');
    await check(
      setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'admin_guard'), {
        id: 'admin_guard',
        activeAdminCount: -5,
        lastSequence: 1,
      }),
      'Admin cannot write negative activeAdminCount to admin_guard',
      false
    );

    console.log('\n--- 3. Testing Invoice Reservation Permanence ---');
    await check(
      updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_24-25_0001'), {
        invoiceId: 'inv_hijacked_999',
      }),
      'Admin cannot update invoice number reservation',
      false
    );

    await check(
      deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_24-25_0001')),
      'Admin cannot delete invoice number reservation',
      false
    );

    console.log('\n--- 4. Testing Cashier Financial Safeguards ---');
    await check(
      updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_test_001'), {
        notes: 'Cashier note',
      }),
      'Cashier cannot update any invoice',
      false
    );

    await check(
      deleteDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_test_001')),
      'Cashier cannot delete any invoice',
      false
    );

    await check(
      deleteDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_test_001')),
      'Manager cannot delete any invoice',
      false
    );

    await check(
      getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'settings', 'financial_details')),
      'Cashier cannot read restricted financial_details',
      false
    );

    await check(
      getDoc(doc(managerDb, 'businesses', BIZ_ID, 'settings', 'financial_details')),
      'Manager cannot read restricted financial_details',
      false
    );

    console.log('\n--- 5. Testing Tenant Isolation ---');
    await check(
      getDoc(doc(adminDb, 'businesses', OTHER_BIZ, 'invoices', 'inv_test_001')),
      'Admin of Business A cannot read invoices in Business B',
      false
    );

    await check(
      setDoc(doc(adminDb, 'businesses', OTHER_BIZ, 'invoices', 'inv_other_001'), {
        id: 'inv_other_001',
        invoiceNumber: 'OTH/24-25/0001',
        netPayable: 100,
      }),
      'Admin of Business A cannot write invoices into Business B',
      false
    );

  } finally {
    await testEnv.cleanup();
  }

  console.log('\n================================================================');
  console.log(`PHASE 6B AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
