import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { createInvoiceWithCounter } from '../src/firebase/services/invoiceService.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';

async function main() {
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

  console.log('--- Setting up Base Membership & Business ---');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERY HOUSE',
      gstin: '32DIUPP1211B2ZN',
    });

    // Admin member
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_uid'), {
      uid: 'admin_uid',
      email: 'admin@tps.com',
      displayName: 'TPS Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });

    // Manager member (Store Manager like Navaneeth P.P in UI)
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_uid'), {
      uid: 'manager_uid',
      email: 'manager@tps.com',
      displayName: 'Navaneeth P.P',
      role: 'manager',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });

    // Cashier member
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_uid'), {
      uid: 'cashier_uid',
      email: 'cashier@tps.com',
      displayName: 'Billing Cashier',
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });
  });

  const managerContext = testEnv.authenticatedContext('manager_uid', { email: 'manager@tps.com' });
  const managerDb = managerContext.firestore();
  const managerUser = { uid: 'manager_uid', email: 'manager@tps.com' };

  const validInvoiceData = {
    customer: {
      name: 'Sujith Kumar P.',
      phone: '9846112244',
      address: 'Padinarangadi Temple Road',
      stateCode: '32',
    },
    items: [
      {
        id: 'item-1',
        name: 'Luminous Eco Volt Neo 1050 Pure Sine Wave',
        category: 'inverter',
        qty: 2,
        rate: 6800,
        gstRate: 18,
        isTaxInclusive: true,
        unit: 'Nos',
        hsn: '8504',
      },
    ],
    invoiceDate: '2026-11-09',
    paymentStatus: 'Pending',
    paymentMode: 'Cash',
  };

  console.log('\n--- TEST SCENARIO 1: Manager creates invoice when counter does NOT exist ---');
  try {
    await createInvoiceWithCounter(BIZ_ID, validInvoiceData, managerUser, {
      dbInstance: managerDb,
      prefix: 'TPS/2026-27/',
    });
    console.log('Scenario 1 Result: UNEXPECTED SUCCESS');
  } catch (err) {
    console.log('Scenario 1 Result: FAILED (as expected):', err.code, err.message);
  }

  console.log('\n--- TEST SCENARIO 1B: Admin creates invoice when counter does NOT exist ---');
  const adminContext = testEnv.authenticatedContext('admin_uid', { email: 'admin@tps.com' });
  const adminDb = adminContext.firestore();
  const adminUser = { uid: 'admin_uid', email: 'admin@tps.com' };
  try {
    await createInvoiceWithCounter(BIZ_ID, validInvoiceData, adminUser, {
      dbInstance: adminDb,
      prefix: 'TPS/2026-27/',
    });
    console.log('Scenario 1B Result: UNEXPECTED SUCCESS');
  } catch (err) {
    console.log('Scenario 1B Result: FAILED (as expected):', err.code, err.message);
  }

  console.log('\n--- TEST SCENARIO 2: Initializing counter as Administrator ---');
  try {
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 6,
      prefix: 'TPS/2026-27/',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin_uid',
      lastInvoiceId: 'inv-init-0',
      lastInvoiceNumber: 'TPS/2026-27/006',
    });
    console.log('Scenario 2 Result: Admin counter initialization SUCCESS');
  } catch (err) {
    console.log('Scenario 2 Result: Admin counter initialization FAILED:', err.code, err.message);
  }

  console.log('\n--- TEST SCENARIO 3: Manager creates invoice with existing valid counter ---');
  try {
    const res = await createInvoiceWithCounter(BIZ_ID, validInvoiceData, managerUser, {
      dbInstance: managerDb,
      prefix: 'TPS/2026-27/',
    });
    console.log('Scenario 3 Result: SUCCESS! Created invoiceNumber:', res.invoiceNumber);
  } catch (err) {
    console.log('Scenario 3 Result: FAILED:', err.code, err.message);
  }

  console.log('\n--- TEST SCENARIO 4: Legacy counter exists with desynchronized lastSeq ---');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices'), {
      lastSeq: 100,
      prefix: 'TPS/2026-27/',
    });
  });

  try {
    await createInvoiceWithCounter(BIZ_ID, validInvoiceData, managerUser, {
      dbInstance: managerDb,
      prefix: 'TPS/2026-27/',
    });
    console.log('Scenario 4 Result: UNEXPECTED SUCCESS');
  } catch (err) {
    console.log('Scenario 4 Result: FAILED with permission-denied due to legacy counter desync:', err.code, err.message);
  }

  await testEnv.cleanup();
}

main().catch(console.error);
