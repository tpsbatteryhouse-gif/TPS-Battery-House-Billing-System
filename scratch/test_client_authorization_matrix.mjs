import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { createInvoiceWithCounter } from '../src/firebase/services/invoiceService.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';
const OTHER_BIZ_ID = 'unauthorized-other-business';

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
  console.log('PHASE 5.2 — CLIENT-SIDE FIRESTORE AUTHORIZATION MATRIX SUITE');
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
    // SEEDING FIXTURES (Admin Context for Setup Only)
    // -------------------------------------------------------------
    console.log('--- Step 0: Seeding Database Fixtures for 7 Identities ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Business Doc
      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERY HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      // 1. Admin
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'user_admin'), {
        uid: 'user_admin',
        email: 'admin@tps.com',
        displayName: 'Store Admin',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
      });

      // 2. Manager
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'user_manager'), {
        uid: 'user_manager',
        email: 'manager@tps.com',
        displayName: 'Store Manager',
        role: 'manager',
        status: 'active',
        createdAt: new Date(),
      });

      // 3. Cashier
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'user_cashier'), {
        uid: 'user_cashier',
        email: 'cashier@tps.com',
        displayName: 'Store Cashier',
        role: 'cashier',
        status: 'active',
        createdAt: new Date(),
      });

      // 4. Pending
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'user_pending'), {
        uid: 'user_pending',
        email: 'pending@tps.com',
        displayName: 'Pending Applicant',
        role: 'cashier',
        status: 'pending',
        createdAt: new Date(),
      });

      // 5. Disabled
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'user_disabled'), {
        uid: 'user_disabled',
        email: 'disabled@tps.com',
        displayName: 'Terminated Employee',
        role: 'cashier',
        status: 'disabled',
        createdAt: new Date(),
      });

      // 6. Removed: No doc in members for 'user_removed'

      // Pre-existing Product
      await setDoc(doc(db, 'businesses', BIZ_ID, 'products', 'prod_100'), {
        id: 'prod_100',
        sku: 'SKU-AMR-100',
        name: 'Amaron Current 150Ah',
        category: 'battery',
        specs: { capacity: '150Ah' },
        unit: 'NOS',
        hsn: '8507',
        sellingPrice: 14000,
        costPrice: 10500,
        gstRate: 28,
        isTaxInclusive: false,
        status: 'active',
        active: true,
      });

      // Pre-existing Customer
      await setDoc(doc(db, 'businesses', BIZ_ID, 'customers', 'cust_100'), {
        id: 'cust_100',
        name: 'Rahul Varma',
        phone: '9847000000',
        stateCode: '32',
      });

      // Pre-existing Invoices
      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), {
        id: 'inv_draft',
        invoiceNumber: 'TPS/2026-27/001',
        invoiceDate: '2026-11-01',
        dueDate: '2026-11-01',
        paymentStatus: 'Draft',
        paymentMode: 'Cash',
        customer: { name: 'Rahul Varma' },
        items: [{ id: 'p1', name: 'Battery', qty: 1, rate: 10000, gstRate: 28 }],
        netPayable: 12800,
        createdAt: '2026-11-01T10:00:00.000Z',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), {
        id: 'inv_paid',
        invoiceNumber: 'TPS/2026-27/002',
        invoiceDate: '2026-11-02',
        dueDate: '2026-11-02',
        paymentStatus: 'Paid',
        paymentMode: 'Bank Transfer',
        customer: { name: 'Rahul Varma' },
        items: [{ id: 'p1', name: 'Battery', qty: 1, rate: 10000, gstRate: 28 }],
        netPayable: 12800,
        createdAt: '2026-11-02T10:00:00.000Z',
      });

      // Counter document
      await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
        lastSeq: 2,
        prefix: 'TPS/2026-27/',
      });

      // Number Reservation
      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_001'), {
        invoiceNumber: 'TPS/2026-27/001',
        invoiceId: 'inv_draft',
        createdAt: new Date(),
      });

      // Settings
      await setDoc(doc(db, 'businesses', BIZ_ID, 'settings', 'business_profile'), {
        businessName: 'TPS Battery House',
        stateCode: '32',
        address: 'Thrissur, Kerala',
        phone: '9846830532',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'settings', 'financial_details'), {
        bankName: 'State Bank of India',
        accountNo: '123456789012',
        ifsc: 'SBIN0001234',
        branch: 'Thrissur Main',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'settings', 'admin_config'), {
        primaryAdminUid: 'user_admin',
        activeAdminCount: 1,
      });

      // Audit Log
      await setDoc(doc(db, 'businesses', BIZ_ID, 'staff_audit_logs', 'log_001'), {
        action: 'INIT',
        performedBy: 'user_admin',
        timestamp: new Date(),
      });

      // Foreign business doc
      await setDoc(doc(db, 'businesses', OTHER_BIZ_ID), {
        businessName: 'Competitor Batteries',
      });
      await setDoc(doc(db, 'businesses', OTHER_BIZ_ID, 'products', 'foreign_prod'), {
        name: 'Foreign Battery',
      });
    });

    console.log('Seeding completed successfully.\n');

    // Setup 7 Client Contexts
    const ctxAdmin = testEnv.authenticatedContext('user_admin');
    const ctxManager = testEnv.authenticatedContext('user_manager');
    const ctxCashier = testEnv.authenticatedContext('user_cashier');
    const ctxPending = testEnv.authenticatedContext('user_pending');
    const ctxDisabled = testEnv.authenticatedContext('user_disabled');
    const ctxRemoved = testEnv.authenticatedContext('user_removed');
    const ctxUnauth = testEnv.unauthenticatedContext();

    const dbAdmin = ctxAdmin.firestore();
    const dbManager = ctxManager.firestore();
    const dbCashier = ctxCashier.firestore();
    const dbPending = ctxPending.firestore();
    const dbDisabled = ctxDisabled.firestore();
    const dbRemoved = ctxRemoved.firestore();
    const dbUnauth = ctxUnauth.firestore();

    // -------------------------------------------------------------
    // COLLECTION 1: PRODUCTS
    // -------------------------------------------------------------
    console.log('--- 1. Products Collection Authorization ---');
    await check(getDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'products', 'prod_100')), 'Admin can read product', true);
    await check(getDoc(doc(dbManager, 'businesses', BIZ_ID, 'products', 'prod_100')), 'Manager can read product', true);
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'products', 'prod_100')), 'Cashier can read product', true);
    await check(getDoc(doc(dbPending, 'businesses', BIZ_ID, 'products', 'prod_100')), 'Pending cannot read product', false);
    await check(getDoc(doc(dbDisabled, 'businesses', BIZ_ID, 'products', 'prod_100')), 'Disabled cannot read product', false);
    await check(getDoc(doc(dbRemoved, 'businesses', BIZ_ID, 'products', 'prod_100')), 'Removed cannot read product', false);
    await check(getDoc(doc(dbUnauth, 'businesses', BIZ_ID, 'products', 'prod_100')), 'Unauthenticated cannot read product', false);

    const validAdminProd = {
      id: 'prod_admin_001',
      sku: 'SKU-ADM-001',
      name: 'Admin Exide 150Ah',
      category: 'battery',
      specs: {},
      unit: 'NOS',
      hsn: '8507',
      sellingPrice: 12500,
      gstRate: 28,
      isTaxInclusive: false,
      status: 'active',
    };
    await check(setDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'products', 'prod_admin_001'), validAdminProd), 'Admin can create product', true);

    const validMgrProd = {
      id: 'prod_mgr_001',
      sku: 'SKU-MGR-001',
      name: 'Manager Luminous 1100VA',
      category: 'inverter',
      specs: {},
      unit: 'NOS',
      hsn: '8504',
      sellingPrice: 8500,
      gstRate: 18,
      isTaxInclusive: false,
      status: 'active',
    };
    await check(setDoc(doc(dbManager, 'businesses', BIZ_ID, 'products', 'prod_mgr_001'), validMgrProd), 'Manager can create product', true);
    await check(setDoc(doc(dbCashier, 'businesses', BIZ_ID, 'products', 'prod_cashier_001'), validMgrProd), 'Cashier cannot create product', false);

    // -------------------------------------------------------------
    // COLLECTION 2: CUSTOMERS
    // -------------------------------------------------------------
    console.log('\n--- 2. Customers Collection Authorization ---');
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'customers', 'cust_100')), 'Cashier can read customer', true);
    await check(getDoc(doc(dbPending, 'businesses', BIZ_ID, 'customers', 'cust_100')), 'Pending cannot read customer', false);
    await check(getDoc(doc(dbDisabled, 'businesses', BIZ_ID, 'customers', 'cust_100')), 'Disabled cannot read customer', false);

    const validCustomer = {
      id: 'cust_new_mgr',
      name: 'Suresh Kumar',
      stateCode: '32',
      phone: '9846000000',
      address: 'Kalyan Nagar, Thrissur',
    };
    await check(setDoc(doc(dbManager, 'businesses', BIZ_ID, 'customers', 'cust_new_mgr'), validCustomer), 'Manager can create customer', true);
    await check(setDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'customers', 'cust_new_adm'), { ...validCustomer, id: 'cust_new_adm' }), 'Admin can create customer', true);
    await check(setDoc(doc(dbCashier, 'businesses', BIZ_ID, 'customers', 'cust_cashier'), { ...validCustomer, id: 'cust_cashier' }), 'Cashier cannot create customer (Manager/Admin role required)', false);
    await check(setDoc(doc(dbPending, 'businesses', BIZ_ID, 'customers', 'cust_pending'), { ...validCustomer, id: 'cust_pending' }), 'Pending cannot create customer', false);
    await check(setDoc(doc(dbUnauth, 'businesses', BIZ_ID, 'customers', 'cust_unauth'), { ...validCustomer, id: 'cust_unauth' }), 'Unauthenticated cannot create customer', false);

    // -------------------------------------------------------------
    // COLLECTION 3: INVOICES (READ)
    // -------------------------------------------------------------
    console.log('\n--- 3. Invoice Reads Authorization ---');
    await check(getDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Admin can read invoice', true);
    await check(getDoc(doc(dbManager, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Manager can read invoice', true);
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Cashier can read invoice', true);
    await check(getDoc(doc(dbPending, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Pending cannot read invoice', false);
    await check(getDoc(doc(dbDisabled, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Disabled cannot read invoice', false);
    await check(getDoc(doc(dbRemoved, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Removed cannot read invoice', false);
    await check(getDoc(doc(dbUnauth, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Unauthenticated cannot read invoice', false);

    // -------------------------------------------------------------
    // COLLECTION 4: INVOICE CREATION (Client Transaction Contract)
    // -------------------------------------------------------------
    console.log('\n--- 4. Invoice Creation Contract (Atomic Transaction) ---');
    const invoicePayload = {
      customer: { name: 'Customer Cashier Txn', phone: '9846000000', stateCode: '32' },
      items: [{ id: 'p1', name: 'Battery 150Ah', qty: 1, rate: 10000, gstRate: 28, isTaxInclusive: false }],
      paymentStatus: 'Paid',
      paymentMode: 'Cash',
      invoiceDate: '2026-11-03',
      dueDate: '2026-11-03',
    };

    const cashierCreatedInvoice = await createInvoiceWithCounter(
      BIZ_ID,
      invoicePayload,
      { uid: 'user_cashier' },
      { dbInstance: dbCashier }
    );
    assert(cashierCreatedInvoice && cashierCreatedInvoice.invoiceNumber, 'Cashier created invoice via Client SDK transaction');
    console.log(`  ✓ PASS (ALLOWED): Cashier created invoice ${cashierCreatedInvoice.invoiceNumber} with atomic counter`);
    passed++;

    // Direct write bypass prevention: Attempting to write an invoice directly without atomic transaction
    const directBypass = setDoc(doc(dbCashier, 'businesses', BIZ_ID, 'invoices', 'inv_bypass_001'), {
      id: 'inv_bypass_001',
      invoiceNumber: 'TPS/2026-27/999',
      invoiceDate: '2026-11-03',
      dueDate: '2026-11-03',
      paymentStatus: 'Paid',
      paymentMode: 'Cash',
      customer: { name: 'Bypass Cust' },
      items: [{ id: '1', name: 'Batt', qty: 1 }],
      netPayable: 1000,
      createdAt: new Date().toISOString(),
    });
    await check(directBypass, 'Direct invoice write without counter reservation fails rules', false);

    // -------------------------------------------------------------
    // COLLECTION 5: INVOICE UPDATES & IMMUTABILITY
    // -------------------------------------------------------------
    console.log('\n--- 5. Invoice Updates & Immutability ---');
    // Cashier cannot update an invoice once created
    await check(updateDoc(doc(dbCashier, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), { paymentMode: 'UPI' }), 'Cashier cannot update invoice', false);

    // Manager can update Draft invoice
    await check(updateDoc(doc(dbManager, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), { paymentMode: 'Credit' }), 'Manager can update Draft invoice', true);

    // Manager CANNOT modify Paid or Cancelled invoice
    await check(updateDoc(doc(dbManager, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), { paymentMode: 'Cash' }), 'Manager cannot modify Paid invoice', false);

    // Admin can update Paid invoice (reconciliation / correction)
    await check(updateDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), { notes: 'Reconciled by Admin' }), 'Admin can update Paid invoice notes', true);

    // Snapshot Immutability: Nobody can mutate createdAt or invoiceNumber
    await check(updateDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), { invoiceNumber: 'TPS/2026-27/999' }), 'Admin cannot modify invoiceNumber (immutable)', false);
    await check(updateDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), { createdAt: '1970-01-01' }), 'Admin cannot modify createdAt (immutable)', false);

    // -------------------------------------------------------------
    // COLLECTION 6: INVOICE DELETION
    // -------------------------------------------------------------
    console.log('\n--- 6. Invoice Deletion Authorization ---');
    await check(deleteDoc(doc(dbCashier, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Cashier cannot delete invoice', false);
    await check(deleteDoc(doc(dbManager, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Manager cannot delete invoice', false);
    await check(deleteDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'invoices', 'inv_draft')), 'Admin can delete invoice', true);

    // -------------------------------------------------------------
    // COLLECTION 7: COUNTERS
    // -------------------------------------------------------------
    console.log('\n--- 7. Counters Security ---');
    // Non-admin cannot arbitrary write or reset counter
    await check(setDoc(doc(dbCashier, 'businesses', BIZ_ID, 'counters', 'invoices_2027-28'), { lastSeq: 0 }), 'Cashier cannot initialize new counter', false);
    await check(setDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'counters', 'invoices_2027-28'), { lastSeq: 0, prefix: 'TPS/2027-28/' }), 'Admin can initialize new counter', true);

    // -------------------------------------------------------------
    // COLLECTION 8: NUMBER RESERVATIONS (IMMUTABLE)
    // -------------------------------------------------------------
    console.log('\n--- 8. Number Reservations Immutability ---');
    // Cannot update or delete reservation (prevents reuse of deleted invoice numbers)
    await check(updateDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_001'), { invoiceId: 'hacked' }), 'Admin cannot update number reservation', false);
    await check(deleteDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_001')), 'Admin cannot delete number reservation (permanent tombstone)', false);

    // -------------------------------------------------------------
    // COLLECTION 9: BUSINESS SETTINGS
    // -------------------------------------------------------------
    console.log('\n--- 9. Business Settings Authorization ---');
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'settings', 'business_profile')), 'Cashier can read business profile', true);
    await check(updateDoc(doc(dbCashier, 'businesses', BIZ_ID, 'settings', 'business_profile'), { address: 'Tampered' }), 'Cashier cannot update business profile', false);
    await check(updateDoc(doc(dbManager, 'businesses', BIZ_ID, 'settings', 'business_profile'), { address: 'New Address' }), 'Manager cannot update business profile (Admin only)', false);
    await check(updateDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'settings', 'business_profile'), { address: 'HQ Thrissur' }), 'Admin can update business profile', true);

    // -------------------------------------------------------------
    // COLLECTION 10: FINANCIAL SETTINGS & ADMIN CONFIG
    // -------------------------------------------------------------
    console.log('\n--- 10. Financial Details & Admin Config Authorization ---');
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'settings', 'financial_details')), 'Cashier cannot read financial details', false);
    await check(getDoc(doc(dbManager, 'businesses', BIZ_ID, 'settings', 'financial_details')), 'Manager cannot read financial details', false);
    await check(getDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'settings', 'financial_details')), 'Admin can read financial details', true);

    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'settings', 'admin_config')), 'Cashier cannot read admin config', false);
    await check(getDoc(doc(dbManager, 'businesses', BIZ_ID, 'settings', 'admin_config')), 'Manager cannot read admin config', false);
    await check(getDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'settings', 'admin_config')), 'Admin can read admin config', true);

    // Non-admin cannot write admin config
    await check(setDoc(doc(dbCashier, 'businesses', BIZ_ID, 'settings', 'admin_config'), { primaryAdminUid: 'user_cashier' }), 'Cashier cannot write admin config', false);
    await check(setDoc(doc(dbManager, 'businesses', BIZ_ID, 'settings', 'admin_config'), { primaryAdminUid: 'user_manager' }), 'Manager cannot write admin config', false);
    await check(setDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'settings', 'admin_config'), { primaryAdminUid: 'user_admin' }), 'Admin direct client write to admin_config is blocked (trusted backend only)', false);

    // -------------------------------------------------------------
    // COLLECTION 11: STAFF MEMBERSHIP (Self-Privilege Escalation Prevention)
    // -------------------------------------------------------------
    console.log('\n--- 11. Staff Membership & Privilege Escalation Prevention ---');
    // Cashier cannot read other members
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'members', 'user_admin')), 'Cashier cannot read other member document', false);
    // Cashier can read own member document
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'members', 'user_cashier')), 'Cashier can read own member document', true);
    // Cashier cannot self-escalate role to admin
    await check(updateDoc(doc(dbCashier, 'businesses', BIZ_ID, 'members', 'user_cashier'), { role: 'admin' }), 'Cashier cannot self-escalate role to admin', false);
    // Cashier cannot self-reactivate if disabled
    await check(updateDoc(doc(dbDisabled, 'businesses', BIZ_ID, 'members', 'user_disabled'), { status: 'active' }), 'Disabled cannot self-reactivate', false);
    // Manager cannot promote self or others to admin
    await check(updateDoc(doc(dbManager, 'businesses', BIZ_ID, 'members', 'user_manager'), { role: 'admin' }), 'Manager cannot promote self to admin', false);

    // -------------------------------------------------------------
    // COLLECTION 12: STAFF AUDIT LOGS (IMMUTABILITY)
    // -------------------------------------------------------------
    console.log('\n--- 12. Staff Audit Logs Immutability ---');
    await check(getDoc(doc(dbCashier, 'businesses', BIZ_ID, 'staff_audit_logs', 'log_001')), 'Cashier cannot read audit logs', false);
    await check(getDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'staff_audit_logs', 'log_001')), 'Admin can read audit logs', true);
    await check(updateDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'staff_audit_logs', 'log_001'), { action: 'TAMPERED' }), 'Admin cannot update audit logs (strictly immutable)', false);
    await check(deleteDoc(doc(dbAdmin, 'businesses', BIZ_ID, 'staff_audit_logs', 'log_001')), 'Admin cannot delete audit logs (strictly immutable)', false);

    // -------------------------------------------------------------
    // CROSS-TENANT ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 13. Cross-Tenant Data Isolation ---');
    await check(getDoc(doc(dbAdmin, 'businesses', OTHER_BIZ_ID, 'products', 'foreign_prod')), 'Admin of TPS cannot read foreign business product', false);
    await check(setDoc(doc(dbAdmin, 'businesses', OTHER_BIZ_ID, 'products', 'hacked_prod'), { name: 'Hack' }), 'Admin of TPS cannot write foreign business product', false);
    await check(getDoc(doc(dbCashier, 'businesses', OTHER_BIZ_ID, 'products', 'foreign_prod')), 'Cashier of TPS cannot read foreign business product', false);

  } finally {
    await testEnv.cleanup();
  }

  console.log('\n================================================================');
  console.log(`CLIENT AUTHORIZATION MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
