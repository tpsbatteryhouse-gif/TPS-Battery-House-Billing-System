// scratch/investigate_save_permission.mjs
import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  createInvoiceWithCounter,
  initializeInvoiceCounter,
} from '../src/firebase/services/invoiceService.js';
import { PRODUCT_CATEGORIES, normalizeInvoiceItem } from '../src/utils/categories.js';

const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';
const FY = '2026-27';
const PREFIX = 'TPS/2026-27/';

async function run() {
  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8980,
      rules: rulesContent,
    },
  });

  await testEnv.clearFirestore();

  // Seed business and members
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERY HOUSE',
      gstin: '32DIUPP1211B2ZN',
    });
    // Admin
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_uid'), {
      uid: 'admin_uid',
      email: 'admin@tpsbatteryhouse.com',
      displayName: 'Admin User',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
    // Manager (Navaneeth P.P)
    await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_uid'), {
      uid: 'manager_uid',
      email: 'manager@tpsbatteryhouse.com',
      displayName: 'Navaneeth P.P',
      role: 'manager',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin_uid',
    });
  });

  const managerContext = testEnv.authenticatedContext('manager_uid');
  const managerDb = managerContext.firestore();
  const managerUser = { uid: 'manager_uid', email: 'manager@tpsbatteryhouse.com' };

  const adminContext = testEnv.authenticatedContext('admin_uid');
  const adminDb = adminContext.firestore();
  const adminUser = { uid: 'admin_uid', email: 'admin@tpsbatteryhouse.com', role: 'admin' };

  console.log('--- TEST 1: Manager creates invoice WITHOUT counter initialized in Firestore ---');
  const testInvoice = {
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-10',
    paymentStatus: 'Paid',
    paymentMode: 'Cash',
    customer: {
      name: 'Palakkad Auto Electricals',
      stateCode: '32',
    },
    items: [
      normalizeInvoiceItem({
        id: 'item-1',
        name: 'Amaron Current 150Ah Battery',
        category: PRODUCT_CATEGORIES.BATTERY,
        qty: 1,
        rate: 15500,
        gstRate: 28,
        isTaxInclusive: true,
      }),
    ],
    additionalDiscount: 1000,
    scrapExchange: { enabled: true, amount: 1497 },
  };

  try {
    await createInvoiceWithCounter(BIZ_ID, testInvoice, managerUser, {
      dbInstance: managerDb,
      prefix: PREFIX,
    });
    console.log('UNEXPECTED SUCCESS 1');
  } catch (err) {
    console.log('Caught Error 1:', {
      name: err.name,
      code: err.code,
      message: err.message,
    });
  }

  console.log('\n--- TEST 2: Admin initializes counter to seq 8 (so next is 009) ---');
  await initializeInvoiceCounter(BIZ_ID, FY, 8, PREFIX, adminUser, adminDb);
  const counterSnap = await getDoc(doc(adminDb, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
  console.log('Counter initialized:', counterSnap.data());

  console.log('\n--- TEST 3: Manager creates invoice 009 with counter initialized to 8 ---');
  try {
    const res = await createInvoiceWithCounter(BIZ_ID, testInvoice, managerUser, {
      dbInstance: managerDb,
      prefix: PREFIX,
    });
    console.log('SUCCESS 3: Created invoice:', res.invoiceNumber);
  } catch (err) {
    console.log('Caught Error 3:', {
      name: err.name,
      code: err.code,
      message: err.message,
    });
  }

  await testEnv.cleanup();
}

run().catch(console.error);

