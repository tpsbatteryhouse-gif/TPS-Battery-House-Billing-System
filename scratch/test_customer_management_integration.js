import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Production imports
import { sanitizeCustomerForFirestore } from '../src/firebase/services/customerService.js';
import {
  isCustomerMigrationNeeded,
  getStableCustomerId,
  extractLocalCustomers,
  CUSTOMER_STORAGE_KEY,
  CUSTOMER_MIGRATION_STATUS_KEY,
} from '../src/firebase/services/customerMigration.js';
import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';

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

async function checkPass(p, desc) {
  try {
    await p;
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc} -> ${err.message}`);
    failed++;
  }
}

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('PHASE 2B: CUSTOMER MANAGEMENT FIRESTORE INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // =================================================================
  // SECTION 1: CUSTOMER SCHEMA SANITIZATION & VALIDATION TESTS
  // =================================================================
  console.log('--- Section 1: Customer Schema Sanitization & Validation ---');

  // 1.1 Valid B2B Customer
  const b2bInput = {
    id: 'cust_b2b_01',
    name: 'Green Valley Agro Farm',
    phone: '9847334455',
    address: 'Kudallur, Anakkara Road',
    shippingAddress: 'Kudallur Warehouse, Anakkara Road',
    city: 'Anakkara',
    district: 'Palakkad',
    state: 'Kerala',
    stateCode: '32',
    pincode: '679551',
    gstin: '32AABCG9981A1Z4',
    arbitraryGarbageField: 'malicious_injection',
  };

  const sanitizedB2B = sanitizeCustomerForFirestore(b2bInput, { uid: 'admin_test' }, false);
  testAssert(sanitizedB2B.id === 'cust_b2b_01', 'Sanitizer preserves valid customer ID');
  testAssert(sanitizedB2B.name === 'Green Valley Agro Farm', 'Sanitizer preserves customer name');
  testAssert(sanitizedB2B.stateCode === '32', 'Sanitizer preserves stateCode');
  testAssert(sanitizedB2B.gstin === '32AABCG9981A1Z4', 'Sanitizer preserves and uppercases GSTIN');
  testAssert(sanitizedB2B.pan === 'AABCG9981A', 'Sanitizer auto-derives 10-digit PAN from 15-char GSTIN');
  testAssert(sanitizedB2B.shippingAddress === 'Kudallur Warehouse, Anakkara Road', 'Sanitizer preserves shippingAddress');
  testAssert(sanitizedB2B.createdBy === 'admin_test', 'Sanitizer attaches createdBy uid on create');
  testAssert(sanitizedB2B.arbitraryGarbageField === undefined, 'Sanitizer strips unwhitelisted fields');

  // 1.2 Valid B2C Customer without GSTIN
  const b2cInput = {
    id: 'cust_b2c_01',
    name: 'Rajesh K.',
    phone: '9876543210',
    city: 'Thrithala',
    district: 'Palakkad',
  };
  const sanitizedB2C = sanitizeCustomerForFirestore(b2cInput, { uid: 'mgr_test' }, false);
  testAssert(sanitizedB2C.name === 'Rajesh K.', 'Sanitizer preserves retail customer name');
  testAssert(sanitizedB2C.stateCode === '32', 'Sanitizer defaults missing stateCode to Kerala (32)');
  testAssert(sanitizedB2C.phone === '9876543210', 'Sanitizer preserves phone');

  // 1.3 Schema Error Handling
  let threwName = false;
  try {
    sanitizeCustomerForFirestore({ phone: '9847000000' });
  } catch {
    threwName = true;
  }
  testAssert(threwName, 'Sanitizer rejects customer missing required name');

  let threwOversizedName = false;
  try {
    sanitizeCustomerForFirestore({ name: 'A'.repeat(151), stateCode: '32' });
  } catch {
    threwOversizedName = true;
  }
  testAssert(threwOversizedName, 'Sanitizer rejects customer with name exceeding 150 characters');

  // 1.4 Update Immutability
  const updateInput = {
    id: 'cust_b2b_01',
    name: 'Green Valley Agro Farm (Updated)',
    phone: '9847334499',
    stateCode: '32',
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'original_creator',
  };
  const sanitizedUpdate = sanitizeCustomerForFirestore(updateInput, { uid: 'admin_test' }, true);
  testAssert(sanitizedUpdate.updatedBy === 'admin_test', 'Sanitizer attaches updatedBy on update');
  testAssert(sanitizedUpdate.createdAt === '2026-10-01T00:00:00.000Z', 'Sanitizer preserves original createdAt on update');
  testAssert(sanitizedUpdate.createdBy === 'original_creator', 'Sanitizer preserves original createdBy on update');

  // =================================================================
  // SECTION 2: CUSTOMER MIGRATION, DEDUPLICATION & IDEMPOTENCY
  // =================================================================
  console.log('\n--- Section 2: Customer Migration & Deduplication ---');

  // 2.1 Stable Customer ID generation
  const idFromGstin = getStableCustomerId({ gstin: '32AABCG9981A1Z4', name: 'Green Valley' });
  testAssert(idFromGstin === 'cust_gstin_32AABCG9981A1Z4', 'Stable ID uses GSTIN when available');

  const idFromPhone = getStableCustomerId({ phone: '+91 9847334455', name: 'Rajesh K.' });
  testAssert(idFromPhone === 'cust_ph_9847334455', 'Stable ID uses 10-digit phone when no GSTIN');

  const idFromName = getStableCustomerId({ name: 'Walk-in Retail Buyer' });
  testAssert(idFromName.startsWith('cust_nm_walk_in'), 'Stable ID falls back to clean slugged name');

  // 2.2 Local Storage Migration Check
  const origLocal = global.localStorage;
  global.localStorage = new MockLocalStorage();

  localStorage.setItem(CUSTOMER_MIGRATION_STATUS_KEY, 'completed');
  testAssert(isCustomerMigrationNeeded() === false, 'isCustomerMigrationNeeded returns false when completed');

  localStorage.removeItem(CUSTOMER_MIGRATION_STATUS_KEY);
  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify([{ name: 'Test Client' }]));
  testAssert(isCustomerMigrationNeeded() === true, 'isCustomerMigrationNeeded returns true when flag absent');

  // 2.3 Extraction & Deduplication from historical invoices
  localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  localStorage.setItem('tps_invoice_records', JSON.stringify([
    {
      invoiceNumber: 'INV-1',
      customer: { name: 'Customer A', phone: '9846001122', gstin: '32AABCA1111A1Z1', city: 'Pattambi' },
    },
    {
      invoiceNumber: 'INV-2',
      customer: { name: 'Customer A', phone: '9846001122', gstin: '32AABCA1111A1Z1', address: 'Main Street' },
    },
    {
      invoiceNumber: 'INV-3',
      customer: { name: 'Customer B', phone: '9447556677' },
    },
  ]));

  const extracted = extractLocalCustomers();
  testAssert(extracted.length === 2, 'Deduplicates duplicate invoice customers into unique profiles');
  const mergedCustA = extracted.find((c) => c.gstin === '32AABCA1111A1Z1');
  testAssert(mergedCustA.city === 'Pattambi' && mergedCustA.address === 'Main Street', 'Merged profile preserves fields across repeat invoices');
  testAssert(JSON.parse(localStorage.getItem('tps_invoice_records')).length === 3, 'Invoice records in localStorage remain 100% intact');

  global.localStorage = origLocal;

  // =================================================================
  // SECTION 3: INVOICE INTEGRATION & INDEPENDENT SNAPSHOT SAFETY
  // =================================================================
  console.log('\n--- Section 3: Invoice Customer Snapshot Isolation & GST Math ---');

  // 3.1 Selecting customer copies into active invoice
  const customerProfile = {
    id: 'cust_001',
    name: 'Urjaamithra Power Systems',
    phone: '9846830532',
    address: 'Padinarangadi, Koottanad Road',
    city: 'Thrithala',
    district: 'Palakkad',
    state: 'Kerala',
    stateCode: '32',
    pincode: '679552',
    gstin: '32AABCU9603R1ZM',
    pan: 'AABCU9603R',
  };

  const invoiceDraft = {
    invoiceNumber: 'TPS/2026-27/050',
    customer: { ...customerProfile },
    items: [
      {
        id: 'item-1',
        name: 'Exide Inva Tubular 150Ah',
        hsn: '8507',
        qty: 1,
        rate: 14500,
        gstRate: 28,
        isTaxInclusive: true,
      },
    ],
  };

  testAssert(invoiceDraft.customer.name === 'Urjaamithra Power Systems', 'Invoice captures selected customer name');
  testAssert(invoiceDraft.customer.gstin === '32AABCU9603R1ZM', 'Invoice captures selected customer GSTIN');

  // 3.2 Mutate original customer profile (simulate editing customer in directory)
  customerProfile.name = 'Urjaamithra Power Systems (RENAMED / ALTERED)';
  customerProfile.phone = '9000000000';
  customerProfile.gstin = '32AABCO9999Z1Z9';

  // Verify historical invoice snapshot did NOT change
  testAssert(invoiceDraft.customer.name === 'Urjaamithra Power Systems', 'Invoice customer name remains completely decoupled from directory edit');
  testAssert(invoiceDraft.customer.phone === '9846830532', 'Invoice customer phone remains completely decoupled from directory edit');
  testAssert(invoiceDraft.customer.gstin === '32AABCU9603R1ZM', 'Invoice customer GSTIN remains completely decoupled from directory edit');

  // 3.3 GST calculation with customer stateCode
  const keralaTotals = calculateInvoiceTotals(invoiceDraft, '32');
  testAssert(keralaTotals.totalCgst > 0 && keralaTotals.totalSgst > 0 && keralaTotals.totalIgst === 0, 'Intra-state customer (stateCode 32) splits into CGST & SGST');

  // Inter-state supply
  const interstateInvoice = {
    ...invoiceDraft,
    customer: { ...invoiceDraft.customer, stateCode: '33', state: 'Tamil Nadu' },
  };
  const interstateTotals = calculateInvoiceTotals(interstateInvoice, '32');
  testAssert(interstateTotals.totalIgst > 0 && interstateTotals.totalCgst === 0 && interstateTotals.totalSgst === 0, 'Inter-state customer (stateCode 33) applies IGST');

  // =================================================================
  // SECTION 4: LIVE FIRESTORE EMULATOR & SECURITY RULES TESTS
  // =================================================================
  console.log('\n--- Section 4: Live Firestore Emulator & Security Rules ---');

  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
    },
  });

  try {
    // Seed test fixtures
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERYS HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_user'), {
        uid: 'admin_user',
        email: 'admin@tps.com',
        displayName: 'Store Admin',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'system',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_user'), {
        uid: 'manager_user',
        email: 'manager@tps.com',
        displayName: 'Store Manager',
        role: 'manager',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'admin_user',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_user'), {
        uid: 'cashier_user',
        email: 'cashier@tps.com',
        displayName: 'Store Cashier',
        role: 'cashier',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'admin_user',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'disabled_user'), {
        uid: 'disabled_user',
        email: 'disabled@tps.com',
        displayName: 'Terminated Staff',
        role: 'manager',
        status: 'disabled',
        createdAt: new Date(),
        createdBy: 'admin_user',
      });
    });

    const validCustomerPayload = {
      id: 'cust_live_01',
      name: 'Kerala Agro Enterprises',
      phone: '9847112233',
      address: 'Main Bazaar Road',
      city: 'Thrithala',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679534',
      gstin: '32AABCK1234D1Z5',
      pan: 'AABCK1234D',
      createdAt: new Date(),
      createdBy: 'admin_user',
    };

    // 4.1 Admin Customer Permissions
    console.log('\n[4.1 Admin Customer Permissions]');
    const adminCtx = testEnv.authenticatedContext('admin_user', { email: 'admin@tps.com' });
    const adminDb = adminCtx.firestore();

    await checkPass(
      assertSucceeds(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'), validCustomerPayload)),
      'Admin can create customer document in Firestore'
    );

    await checkPass(
      assertSucceeds(getDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'))),
      'Admin can read customer document'
    );

    await checkPass(
      assertSucceeds(
        updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'), {
          phone: '9847999888',
          updatedAt: new Date(),
          updatedBy: 'admin_user',
        })
      ),
      'Admin can update customer phone'
    );

    // 4.2 Manager Customer Permissions
    console.log('\n[4.2 Manager Customer Permissions]');
    const mgrCtx = testEnv.authenticatedContext('manager_user', { email: 'manager@tps.com' });
    const mgrDb = mgrCtx.firestore();

    const mgrCustomerPayload = {
      id: 'cust_mgr_01',
      name: 'Pattambi Solar Works',
      stateCode: '32',
      phone: '9447000111',
      city: 'Pattambi',
      createdAt: new Date(),
      createdBy: 'manager_user',
    };

    await checkPass(
      assertSucceeds(setDoc(doc(mgrDb, 'businesses', BIZ_ID, 'customers', 'cust_mgr_01'), mgrCustomerPayload)),
      'Manager can create valid customer document'
    );

    await checkPass(
      assertSucceeds(getDoc(doc(mgrDb, 'businesses', BIZ_ID, 'customers', 'cust_mgr_01'))),
      'Manager can read customer document'
    );

    await checkPass(
      assertSucceeds(
        updateDoc(doc(mgrDb, 'businesses', BIZ_ID, 'customers', 'cust_mgr_01'), {
          name: 'Pattambi Solar Works & Contracting',
          updatedAt: new Date(),
          updatedBy: 'manager_user',
        })
      ),
      'Manager can update customer document'
    );

    await checkPass(
      assertSucceeds(deleteDoc(doc(mgrDb, 'businesses', BIZ_ID, 'customers', 'cust_mgr_01'))),
      'Manager can delete customer document'
    );

    // 4.3 Cashier Read-Only Customer Permissions
    console.log('\n[4.3 Cashier Read-Only Customer Permissions]');
    const cashierCtx = testEnv.authenticatedContext('cashier_user', { email: 'cashier@tps.com' });
    const cashierDb = cashierCtx.firestore();

    await checkPass(
      assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'))),
      'Cashier CAN read customer document'
    );

    await checkPass(
      assertFails(
        setDoc(doc(cashierDb, 'businesses', BIZ_ID, 'customers', 'cust_cashier_bad'), {
          ...validCustomerPayload,
          id: 'cust_cashier_bad',
          createdBy: 'cashier_user',
        })
      ),
      'Cashier CANNOT create customer document (Forbidden)'
    );

    await checkPass(
      assertFails(
        updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'), {
          phone: '9999999999',
        })
      ),
      'Cashier CANNOT update customer document (Forbidden)'
    );

    await checkPass(
      assertFails(deleteDoc(doc(cashierDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'))),
      'Cashier CANNOT delete customer document (Forbidden)'
    );

    // 4.4 Unauthenticated and Disabled Users
    console.log('\n[4.4 Unauthenticated & Disabled User Protection]');
    const unauthCtx = testEnv.unauthenticatedContext();
    const unauthDb = unauthCtx.firestore();

    await checkPass(
      assertFails(getDoc(doc(unauthDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'))),
      'Unauthenticated visitor CANNOT read customer document'
    );

    await checkPass(
      assertFails(setDoc(doc(unauthDb, 'businesses', BIZ_ID, 'customers', 'hacker_cust'), validCustomerPayload)),
      'Unauthenticated visitor CANNOT create customer'
    );

    const disabledCtx = testEnv.authenticatedContext('disabled_user', { email: 'disabled@tps.com' });
    const disabledDb = disabledCtx.firestore();

    await checkPass(
      assertFails(getDoc(doc(disabledDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'))),
      'Disabled user CANNOT read customer document'
    );

    await checkPass(
      assertFails(setDoc(doc(disabledDb, 'businesses', BIZ_ID, 'customers', 'disabled_cust'), validCustomerPayload)),
      'Disabled user CANNOT create customer'
    );

    // 4.5 Cross-Business Isolation
    console.log('\n[4.5 Cross-Business Tenant Isolation]');
    await checkPass(
      assertFails(getDoc(doc(adminDb, 'businesses', 'other-unknown-biz', 'customers', 'cust_live_01'))),
      'Member cannot access other business customers collection'
    );

    // 4.6 Schema Validation Enforcement at Rules Level
    console.log('\n[4.6 Schema Validation Enforcement at Rules Level]');
    // Missing required field (name)
    const missingName = { ...validCustomerPayload, id: 'bad_c1' };
    delete missingName.name;
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'bad_c1'), missingName)),
      'Rules reject customer missing required name'
    );

    // Missing required field (stateCode)
    const missingStateCode = { ...validCustomerPayload, id: 'bad_c2' };
    delete missingStateCode.stateCode;
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'bad_c2'), missingStateCode)),
      'Rules reject customer missing required stateCode'
    );

    // Disallowed extra field
    const disallowedField = { ...validCustomerPayload, id: 'bad_c3', illegalField: 'secret_info' };
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'bad_c3'), disallowedField)),
      'Rules reject customer with disallowed extra fields'
    );

    // ID path mismatch
    const idMismatch = { ...validCustomerPayload, id: 'cust_mismatch_id' };
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'different_doc_id'), idMismatch)),
      'Rules reject customer payload id mismatch with document path'
    );

    // Immutability on update: attempting to alter createdBy
    await checkPass(
      assertFails(
        updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'), {
          createdBy: 'forged_user_id',
        })
      ),
      'Rules reject changing immutable createdBy field on update'
    );

    // Admin deletion of created customer
    await checkPass(
      assertSucceeds(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'customers', 'cust_live_01'))),
      'Admin can delete customer document'
    );

  } finally {
    await testEnv.cleanup();
  }

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n================================================================');
  console.log(`TOTAL PHASE 2B TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
