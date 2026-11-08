import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// Import production services & categories
import { sanitizeProductForFirestore } from '../src/firebase/services/productService.js';
import {
  isMigrationNeeded,
  MIGRATION_STORAGE_KEY,
  MIGRATION_STATUS_KEY,
} from '../src/firebase/services/catalogMigration.js';
import { normalizeInvoiceItem } from '../src/utils/categories.js';
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

// Mock localStorage for node environment
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
  console.log('PHASE 2A: PRODUCT CATALOG FIRESTORE INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // =================================================================
  // SECTION 1: PRODUCT SANITIZATION & SCHEMA VALIDATION TESTS
  // =================================================================
  console.log('--- Section 1: Product Schema Sanitization & Validation ---');

  // 1.1 Valid Battery Product
  const batteryInput = {
    id: 'prod_bat_01',
    sku: 'EX-INV-150',
    name: 'Exide Inva Tubular 150Ah',
    category: 'battery',
    subcategory: 'tall_tubular',
    brand: 'Exide',
    model: 'IT500',
    description: 'High performance inverter battery',
    specs: { capacityAh: 150, voltage: '12V', warrantyMonths: 48 },
    unit: 'NOS',
    hsn: '8507',
    sellingPrice: 14500,
    costPrice: 11000,
    gstRate: 28,
    isTaxInclusive: true,
    warranty: '48 Months',
    status: 'active',
    active: true,
    extraGarbageField: 'strip-me-out',
  };

  const sanitizedBat = sanitizeProductForFirestore(batteryInput, { uid: 'admin_test' }, false);
  testAssert(sanitizedBat.id === 'prod_bat_01', 'Sanitizer preserves valid ID');
  testAssert(sanitizedBat.sku === 'EX-INV-150', 'Sanitizer preserves valid SKU');
  testAssert(sanitizedBat.category === 'battery', 'Sanitizer validates battery category');
  testAssert(sanitizedBat.specs.capacityAh === 150, 'Sanitizer preserves specs map');
  testAssert(sanitizedBat.sellingPrice === 14500, 'Sanitizer preserves numeric sellingPrice');
  testAssert(sanitizedBat.costPrice === 11000, 'Sanitizer preserves numeric costPrice');
  testAssert(sanitizedBat.gstRate === 28, 'Sanitizer preserves gstRate');
  testAssert(sanitizedBat.isTaxInclusive === true, 'Sanitizer preserves isTaxInclusive boolean');
  testAssert(sanitizedBat.createdBy === 'admin_test', 'Sanitizer attaches createdBy uid on create');
  testAssert(sanitizedBat.extraGarbageField === undefined, 'Sanitizer strips unwhitelisted fields');

  // 1.2 Inverter Category with Inverter Specs
  const inverterInput = {
    id: 'prod_inv_01',
    sku: 'LUM-1100',
    name: 'Luminous Eco Volt Neo 1050',
    category: 'inverter',
    brand: 'Luminous',
    model: 'Neo 1050',
    specs: { vaRating: 900, systemVoltage: '12V', waveForm: 'Pure Sine Wave' },
    unit: 'NOS',
    hsn: '8504',
    sellingPrice: 7200,
    gstRate: 18,
    isTaxInclusive: true,
  };
  const sanitizedInv = sanitizeProductForFirestore(inverterInput, { uid: 'mgr_test' }, false);
  testAssert(sanitizedInv.category === 'inverter', 'Sanitizer accepts inverter category');
  testAssert(sanitizedInv.specs.vaRating === 900, 'Sanitizer preserves inverter specs');
  testAssert(sanitizedInv.costPrice === 0, 'Sanitizer defaults missing costPrice to 0');
  testAssert(sanitizedInv.active === true, 'Sanitizer defaults active to true');

  // 1.3 Solar & Services Categories
  const solarInput = {
    id: 'prod_sol_01',
    sku: 'SOL-PAN-540',
    name: 'Adani 540W Mono PERC Solar Panel',
    category: 'solar',
    unit: 'NOS',
    hsn: '8541',
    sellingPrice: 15500,
    gstRate: 12,
    isTaxInclusive: true,
  };
  const sanitizedSol = sanitizeProductForFirestore(solarInput);
  testAssert(sanitizedSol.category === 'solar', 'Sanitizer accepts solar category');

  const svcInput = {
    id: 'prod_svc_01',
    sku: 'SVC-INST-INV',
    name: 'Inverter + Battery Installation & Wiring Service',
    category: 'services',
    unit: 'JOB',
    hsn: '9987',
    sellingPrice: 1200,
    gstRate: 18,
    isTaxInclusive: true,
  };
  const sanitizedSvc = sanitizeProductForFirestore(svcInput);
  testAssert(sanitizedSvc.category === 'services', 'Sanitizer accepts services category');
  testAssert(sanitizedSvc.unit === 'JOB', 'Sanitizer preserves service unit');

  // 1.4 Schema Error Handling
  let threwName = false;
  try {
    sanitizeProductForFirestore({ id: 'bad', sku: 'bad' });
  } catch {
    threwName = true;
  }
  testAssert(threwName, 'Sanitizer rejects product missing name');

  let threwCat = false;
  try {
    sanitizeProductForFirestore({ id: 'bad', sku: 'bad', name: 'Test', category: 'gadgets', sellingPrice: 100 });
  } catch {
    threwCat = true;
  }
  testAssert(threwCat, 'Sanitizer rejects product with invalid category');

  // 1.5 Update Immutability Check
  const updateInput = {
    id: 'prod_bat_01',
    sku: 'EX-INV-150',
    name: 'Updated Exide Battery Name',
    category: 'battery',
    unit: 'NOS',
    hsn: '8507',
    sellingPrice: 15000,
    gstRate: 28,
    isTaxInclusive: true,
  };
  const sanitizedUpdate = sanitizeProductForFirestore(updateInput, { uid: 'admin_test' }, true);
  testAssert(sanitizedUpdate.updatedBy === 'admin_test', 'Sanitizer attaches updatedBy on update');
  testAssert(sanitizedUpdate.id === 'prod_bat_01', 'Update keeps document id');

  // =================================================================
  // SECTION 2: CATALOG MIGRATION LOGIC & IDEMPOTENCY
  // =================================================================
  console.log('\n--- Section 2: Catalog Migration & Idempotency ---');

  const globalLocalStorage = global.localStorage;
  global.localStorage = new MockLocalStorage();

  // Test 2.1: Migration not needed if already marked completed
  localStorage.setItem(MIGRATION_STATUS_KEY, 'completed');
  localStorage.setItem(MIGRATION_STORAGE_KEY, JSON.stringify([{ id: 'p1' }]));
  testAssert(isMigrationNeeded() === false, 'isMigrationNeeded returns false when already completed');

  // Test 2.2: Migration needed when not completed and local data exists
  localStorage.removeItem(MIGRATION_STATUS_KEY);
  testAssert(isMigrationNeeded() === true, 'isMigrationNeeded returns true when migration flag absent and data exists');

  // Test 2.3: Preserves existing localStorage catalog data untouched
  const initialLocalData = [
    {
      id: 'bat_01',
      sku: 'BAT-01',
      name: 'Amaron Current 150Ah',
      category: 'battery',
      unit: 'NOS',
      hsn: '8507',
      sellingPrice: 13500,
      gstRate: 28,
      isTaxInclusive: true,
      specs: {},
    },
    {
      id: 'inv_01',
      sku: 'INV-01',
      name: 'Microtek 1150VA',
      category: 'inverter',
      unit: 'NOS',
      hsn: '8504',
      sellingPrice: 6500,
      gstRate: 18,
      isTaxInclusive: true,
      specs: {},
    },
  ];
  localStorage.setItem(MIGRATION_STORAGE_KEY, JSON.stringify(initialLocalData));

  testAssert(
    JSON.parse(localStorage.getItem(MIGRATION_STORAGE_KEY)).length === 2,
    'Local catalog intact before migration'
  );

  // Restore global localStorage
  global.localStorage = globalLocalStorage;

  // =================================================================
  // SECTION 3: INVOICE INTEGRATION & HISTORICAL SNAPSHOT INTEGRITY
  // =================================================================
  console.log('\n--- Section 3: Invoice Snapshot Isolation & GST Math ---');

  // 3.1 Verify adding product creates a decoupled copy
  const catalogItem = {
    id: 'prod_test_snap',
    sku: 'SNAP-01',
    name: 'Exide Inva Snap 150Ah',
    category: 'battery',
    brand: 'Exide',
    model: 'Snap500',
    unit: 'NOS',
    hsn: '8507',
    sellingPrice: 14000,
    costPrice: 10500,
    gstRate: 28,
    isTaxInclusive: true,
    warranty: '48 Months',
    specs: { capacityAh: 150 },
  };

  const invoiceItem = {
    id: `item_snap_${Date.now()}`,
    productId: catalogItem.id,
    sku: catalogItem.sku,
    name: catalogItem.name,
    itemType: 'catalog',
    category: catalogItem.category,
    brand: catalogItem.brand,
    model: catalogItem.model,
    specs: { ...catalogItem.specs },
    hsn: catalogItem.hsn,
    unit: catalogItem.unit,
    qty: 2,
    rate: catalogItem.sellingPrice,
    costPrice: catalogItem.costPrice,
    gstRate: catalogItem.gstRate,
    isTaxInclusive: catalogItem.isTaxInclusive,
    warranty: catalogItem.warranty,
    serialNumbers: ['SN-001', 'SN-002'],
    remarks: '',
  };

  const normalized = normalizeInvoiceItem(invoiceItem);
  testAssert(normalized.name === catalogItem.name, 'Normalized invoice item captures catalog product name');
  testAssert(normalized.rate === 14000, 'Normalized invoice item captures rate');
  testAssert(normalized.qty === 2, 'Normalized item preserves qty');

  // 3.2 Mutate original catalog item to simulate price/name change in live catalog
  catalogItem.name = 'Exide Inva Snap MODIFIED 150Ah';
  catalogItem.sellingPrice = 19999;
  catalogItem.gstRate = 18;

  // Verify historical invoice item was NOT mutated
  testAssert(normalized.name === 'Exide Inva Snap 150Ah', 'Invoice item name remains completely decoupled from catalog edit');
  testAssert(normalized.rate === 14000, 'Invoice item rate remains completely decoupled from catalog edit');
  testAssert(normalized.gstRate === 28, 'Invoice item gstRate remains completely decoupled from catalog edit');

  // 3.3 Verify GST calculation accuracy on snapshot
  const mockInvoice = {
    invoiceNumber: 'TPS/2026-27/001',
    items: [normalized],
    discount: { type: 'percentage', value: 0 },
    roundOff: 0,
    advancePaid: 0,
    customer: { state: 'Kerala', stateCode: '32' },
  };
  const totals = calculateInvoiceTotals(mockInvoice, '32');
  testAssert(totals.netPayable === 28000, 'Grand total matches 2 * 14000 inclusive rate');
  testAssert(totals.totalCgst > 0 && totals.totalSgst > 0, 'Intra-state Kerala splits into CGST and SGST');
  testAssert(totals.totalIgst === 0, 'No IGST on intra-state supply');

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
    // Seed fixtures bypassing rules
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Business
      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERYS HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      // Members: Admin, Manager, Cashier, Disabled
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
        displayName: 'Terminated User',
        role: 'manager',
        status: 'disabled',
        createdAt: new Date(),
        createdBy: 'admin_user',
      });
    });

    // 4.1 Admin Product CRUD
    console.log('\n[4.1 Admin Product Permissions]');
    const adminCtx = testEnv.authenticatedContext('admin_user', { email: 'admin@tps.com' });
    const adminDb = adminCtx.firestore();

    const validProdPayload = {
      id: 'bat_exide_150',
      sku: 'EX-INV-150',
      name: 'Exide Inva Tubular 150Ah',
      category: 'battery',
      subcategory: 'tall_tubular',
      brand: 'Exide',
      model: 'IT500',
      description: 'Reliable inverter battery',
      specs: { capacityAh: 150, voltage: '12V' },
      unit: 'NOS',
      hsn: '8507',
      sellingPrice: 14500,
      costPrice: 11000,
      gstRate: 28,
      isTaxInclusive: true,
      warranty: '48 Months',
      status: 'active',
      active: true,
      createdAt: new Date(),
      createdBy: 'admin_user',
    };

    await checkPass(
      assertSucceeds(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'), validProdPayload)),
      'Admin can create valid product document in Firestore'
    );

    await checkPass(
      assertSucceeds(getDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'))),
      'Admin can read product document'
    );

    await checkPass(
      assertSucceeds(
        updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'), {
          sellingPrice: 15000,
          updatedAt: new Date(),
          updatedBy: 'admin_user',
        })
      ),
      'Admin can update product pricing'
    );

    // 4.2 Manager Product CRUD
    console.log('\n[4.2 Manager Product Permissions]');
    const mgrCtx = testEnv.authenticatedContext('manager_user', { email: 'manager@tps.com' });
    const mgrDb = mgrCtx.firestore();

    const mgrProdPayload = {
      id: 'inv_lum_1050',
      sku: 'LUM-1050',
      name: 'Luminous Eco Volt Neo 1050',
      category: 'inverter',
      brand: 'Luminous',
      model: 'Neo 1050',
      specs: { vaRating: 900 },
      unit: 'NOS',
      hsn: '8504',
      sellingPrice: 7200,
      gstRate: 18,
      isTaxInclusive: true,
      status: 'active',
      active: true,
      createdAt: new Date(),
      createdBy: 'manager_user',
    };

    await checkPass(
      assertSucceeds(setDoc(doc(mgrDb, 'businesses', BIZ_ID, 'products', 'inv_lum_1050'), mgrProdPayload)),
      'Manager can create valid product document'
    );

    await checkPass(
      assertSucceeds(getDoc(doc(mgrDb, 'businesses', BIZ_ID, 'products', 'inv_lum_1050'))),
      'Manager can read product document'
    );

    await checkPass(
      assertSucceeds(
        updateDoc(doc(mgrDb, 'businesses', BIZ_ID, 'products', 'inv_lum_1050'), {
          name: 'Luminous Eco Volt Neo 1050 VA (Upgraded)',
          updatedAt: new Date(),
          updatedBy: 'manager_user',
        })
      ),
      'Manager can update product document'
    );

    await checkPass(
      assertSucceeds(deleteDoc(doc(mgrDb, 'businesses', BIZ_ID, 'products', 'inv_lum_1050'))),
      'Manager can delete product document'
    );

    // 4.3 Cashier Read-Only Access
    console.log('\n[4.3 Cashier Read-Only Permissions]');
    const cashierCtx = testEnv.authenticatedContext('cashier_user', { email: 'cashier@tps.com' });
    const cashierDb = cashierCtx.firestore();

    await checkPass(
      assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'))),
      'Cashier CAN read product catalog item'
    );

    await checkPass(
      assertFails(
        setDoc(doc(cashierDb, 'businesses', BIZ_ID, 'products', 'prod_cashier_bad'), {
          ...validProdPayload,
          id: 'prod_cashier_bad',
          createdBy: 'cashier_user',
        })
      ),
      'Cashier CANNOT create product (Forbidden)'
    );

    await checkPass(
      assertFails(
        updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'), {
          sellingPrice: 9999,
        })
      ),
      'Cashier CANNOT update product (Forbidden)'
    );

    await checkPass(
      assertFails(deleteDoc(doc(cashierDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'))),
      'Cashier CANNOT delete product (Forbidden)'
    );

    // 4.4 Unauthenticated and Disabled Users Access
    console.log('\n[4.4 Unauthenticated & Disabled User Protection]');
    const unauthCtx = testEnv.unauthenticatedContext();
    const unauthDb = unauthCtx.firestore();

    await checkPass(
      assertFails(getDoc(doc(unauthDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'))),
      'Unauthenticated user CANNOT read product'
    );

    await checkPass(
      assertFails(setDoc(doc(unauthDb, 'businesses', BIZ_ID, 'products', 'hacker_prod'), validProdPayload)),
      'Unauthenticated user CANNOT create product'
    );

    const disabledCtx = testEnv.authenticatedContext('disabled_user', { email: 'disabled@tps.com' });
    const disabledDb = disabledCtx.firestore();

    await checkPass(
      assertFails(getDoc(doc(disabledDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'))),
      'Disabled user CANNOT read product'
    );

    await checkPass(
      assertFails(setDoc(doc(disabledDb, 'businesses', BIZ_ID, 'products', 'disabled_prod'), validProdPayload)),
      'Disabled user CANNOT create product'
    );

    // 4.5 Cross-Business Isolation
    console.log('\n[4.5 Cross-Business Isolation]');
    await checkPass(
      assertFails(getDoc(doc(adminDb, 'businesses', 'other-unknown-biz', 'products', 'bat_exide_150'))),
      'Member cannot access other business products collection'
    );

    // 4.6 Schema Validation Enforcement at Rules Level
    console.log('\n[4.6 Schema Validation Rules Enforcement]');
    // Missing required field (sellingPrice)
    const missingPrice = { ...validProdPayload, id: 'bad_p1' };
    delete missingPrice.sellingPrice;
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bad_p1'), missingPrice)),
      'Rules reject product missing sellingPrice'
    );

    // Invalid category
    const badCategory = { ...validProdPayload, id: 'bad_p2', category: 'smartphones' };
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bad_p2'), badCategory)),
      'Rules reject product with invalid category'
    );

    // Disallowed extra field
    const disallowedField = { ...validProdPayload, id: 'bad_p3', secretInternalCode: 'xyz123' };
    await checkPass(
      assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bad_p3'), disallowedField)),
      'Rules reject product with disallowed extra fields'
    );

    // Immutability on update: trying to alter SKU
    await checkPass(
      assertFails(
        updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'), {
          sku: 'ALTERED-SKU-VALUE',
        })
      ),
      'Rules reject changing immutable SKU field on update'
    );

    // Immutability on update: trying to alter createdBy
    await checkPass(
      assertFails(
        updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'), {
          createdBy: 'impostor_uid',
        })
      ),
      'Rules reject changing immutable createdBy field on update'
    );

    // Admin deletion of created product
    await checkPass(
      assertSucceeds(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'bat_exide_150'))),
      'Admin can delete product document'
    );

  } finally {
    await testEnv.cleanup();
  }

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n================================================================');
  console.log(`TOTAL PHASE 2A TESTS: ${passed + failed}`);
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

