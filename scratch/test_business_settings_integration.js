/**
 * TPS Battery House — Phase 3: Business Profile & Bank Settings Firestore Integration Suite
 *
 * Covers:
 * 1. Security rules schema validation for settings/business_profile
 * 2. Role-Based Access Control (Admin, Manager, Cashier, Disabled, Unauthenticated, Cross-business)
 * 3. Immutable audit fields (createdAt, createdBy) protection
 * 4. Service methods: getBusinessSettings, updateBusinessSettings, initializeBusinessSettings
 * 5. Migration idempotency: local data migration without overwriting remote data
 * 6. Historical invoice immutability: businessSnapshot decoupling and PDF/preview preservation
 * 7. Real-time listener synchronization
 */

import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import {
  DEFAULT_BUSINESS_SETTINGS,
  SETTINGS_DOC_ID,
  sanitizeBusinessSettingsForFirestore,
  normalizeBusinessSettings,
  getBusinessSettings,
  updateBusinessSettings,
  initializeBusinessSettings,
  migrateBusinessSettings,
  subscribeToBusinessSettings,
} from '../src/firebase/services/businessSettingsService.js';

import {
  createInvoiceWithCounter,
  getInvoice,
} from '../src/firebase/services/invoiceService.js';

import { generateVectorPdf } from '../src/utils/pdfExport.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-phase3';
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

// Mock localStorage for Node.js test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

async function runBusinessSettingsSuite() {
  console.log('================================================================');
  console.log('PHASE 3: STORE PROFILE & BANK SETTINGS INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
    },
  });

  await testEnv.clearFirestore();

  // Seed business document and staff members with different roles
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    await setDoc(doc(adminDb, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERYS HOUSE',
      gstin: '32DIUPP1211B2ZN',
      stateCode: '32',
    });

    // Admin member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin-uid'), {
      uid: 'admin-uid',
      email: 'admin@tps.com',
      displayName: 'Store Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });

    // Manager member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'manager-uid'), {
      uid: 'manager-uid',
      email: 'manager@tps.com',
      displayName: 'Store Manager',
      role: 'manager',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
    });

    // Cashier member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'cashier-uid'), {
      uid: 'cashier-uid',
      email: 'cashier@tps.com',
      displayName: 'Billing Cashier',
      role: 'cashier',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
    });

    // Disabled staff member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'disabled-uid'), {
      uid: 'disabled-uid',
      email: 'disabled@tps.com',
      displayName: 'Former Staff',
      role: 'cashier',
      status: 'disabled',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
    });

    // Seed FY counter for invoice tests
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 5,
      prefix: 'TPS/2026-27/',
      lastInvoiceId: 'inv_init',
      lastInvoiceNumber: 'TPS/2026-27/005',
      updatedAt: new Date().toISOString(),
    });
  });

  const adminContext = testEnv.authenticatedContext('admin-uid');
  const managerContext = testEnv.authenticatedContext('manager-uid');
  const cashierContext = testEnv.authenticatedContext('cashier-uid');
  const disabledContext = testEnv.authenticatedContext('disabled-uid');
  const crossBizContext = testEnv.authenticatedContext('other-biz-user');
  const unauthContext = testEnv.unauthenticatedContext();

  const adminDb = adminContext.firestore();
  const managerDb = managerContext.firestore();
  const cashierDb = cashierContext.firestore();
  const disabledDb = disabledContext.firestore();
  const unauthDb = unauthContext.firestore();
  const crossBizDb = crossBizContext.firestore();

  const settingsDocRef = (dbInstance) => doc(dbInstance, 'businesses', BIZ_ID, 'settings', SETTINGS_DOC_ID);

  console.log('[SECTION 1: Firestore Security Rules Schema Validation for settings/business_profile]');

  // 1.1 Admin creating valid settings payload
  const validPayload = sanitizeBusinessSettingsForFirestore(DEFAULT_BUSINESS_SETTINGS, { uid: 'admin-uid' }, false);
  await assertSucceeds(
    setDoc(settingsDocRef(adminDb), validPayload),
    'Admin can create valid business settings document'
  );
  testAssert(true, 'Admin can create valid business settings document');

  // 1.2 Reject settings document missing businessName
  const invalidMissingName = { ...validPayload, businessName: '' };
  await assertFails(
    setDoc(settingsDocRef(adminDb), invalidMissingName),
    'Reject business settings missing businessName'
  );
  testAssert(true, 'Reject business settings missing businessName');

  // 1.3 Reject unwhitelisted keys
  const invalidWithMaliciousKey = { ...validPayload, arbitraryHackKey: true };
  await assertFails(
    setDoc(settingsDocRef(adminDb), invalidWithMaliciousKey),
    'Reject settings containing unwhitelisted keys'
  );
  testAssert(true, 'Reject settings containing unwhitelisted keys');

  // 1.4 Reject oversized string fields
  const invalidOversizedName = { ...validPayload, businessName: 'A'.repeat(200) };
  await assertFails(
    setDoc(settingsDocRef(adminDb), invalidOversizedName),
    'Reject settings with oversized businessName (>150 chars)'
  );
  testAssert(true, 'Reject settings with oversized businessName (>150 chars)');

  console.log('\n[SECTION 2: Role-Based Access Control (RBAC) Enforcement]');

  // 2.1 Active members (Admin, Manager, Cashier) can READ settings
  const adminRead = await assertSucceeds(getDoc(settingsDocRef(adminDb)));
  testAssert(adminRead.exists(), 'Admin can read business settings');

  const managerRead = await assertSucceeds(getDoc(settingsDocRef(managerDb)));
  testAssert(managerRead.exists(), 'Manager can read business settings');

  const cashierRead = await assertSucceeds(getDoc(settingsDocRef(cashierDb)));
  testAssert(cashierRead.exists(), 'Cashier can read business settings');

  // 2.2 Unauthenticated user cannot read settings
  await assertFails(getDoc(settingsDocRef(unauthDb)), 'Unauthenticated user denied read access');
  testAssert(true, 'Unauthenticated user denied read access');

  // 2.3 Disabled member cannot read settings
  await assertFails(getDoc(settingsDocRef(disabledDb)), 'Disabled staff member denied read access');
  testAssert(true, 'Disabled staff member denied read access');

  // 2.4 Cross-business user cannot read settings
  await assertFails(getDoc(settingsDocRef(crossBizDb)), 'Cross-business user denied read access');
  testAssert(true, 'Cross-business user denied read access');

  // 2.5 Manager cannot WRITE or UPDATE settings
  await assertFails(
    updateDoc(settingsDocRef(managerDb), { phone: '+91 9999999999' }),
    'Manager strictly denied update access to business settings'
  );
  testAssert(true, 'Manager strictly denied update access to business settings');

  // 2.6 Cashier cannot WRITE or UPDATE settings
  await assertFails(
    updateDoc(settingsDocRef(cashierDb), { phone: '+91 8888888888' }),
    'Cashier strictly denied update access to business settings'
  );
  testAssert(true, 'Cashier strictly denied update access to business settings');

  // 2.7 Unauthenticated user cannot update settings
  await assertFails(
    updateDoc(settingsDocRef(unauthDb), { phone: '+91 7777777777' }),
    'Unauthenticated user strictly denied update access'
  );
  testAssert(true, 'Unauthenticated user strictly denied update access');

  // 2.8 Disabled member cannot update settings
  await assertFails(
    updateDoc(settingsDocRef(disabledDb), { phone: '+91 6666666666' }),
    'Disabled member strictly denied update access'
  );
  testAssert(true, 'Disabled member strictly denied update access');

  // 2.9 Admin CAN update settings
  const updatePayload = {
    phone: '+91 9846830599',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
  };
  await assertSucceeds(
    updateDoc(settingsDocRef(adminDb), updatePayload),
    'Admin can successfully update business settings'
  );
  testAssert(true, 'Admin can successfully update business settings');

  console.log('\n[SECTION 3: Immutable Audit Fields Protection]');

  // 3.1 Admin cannot mutate createdAt on update
  await assertFails(
    updateDoc(settingsDocRef(adminDb), { createdAt: '2020-01-01T00:00:00.000Z' }),
    'Admin cannot tamper with immutable createdAt'
  );
  testAssert(true, 'Admin cannot tamper with immutable createdAt');

  // 3.2 Admin cannot mutate createdBy on update
  await assertFails(
    updateDoc(settingsDocRef(adminDb), { createdBy: 'intruder' }),
    'Admin cannot tamper with immutable createdBy'
  );
  testAssert(true, 'Admin cannot tamper with immutable createdBy');

  console.log('\n[SECTION 4: Business Settings Service & Normalization Architecture]');

  // 4.1 normalizeBusinessSettings handles dual structured sub-objects and flat properties
  const normalized = normalizeBusinessSettings(validPayload);
  testAssert(normalized.bank.bankName === 'Federal Bank', 'Normalized sub-object bank.bankName is accessible');
  testAssert(normalized.bankName === 'Federal Bank', 'Normalized flat property bankName is accessible for legacy code');
  testAssert(normalized.upi.upiId === '9846830532@okaxis', 'Normalized sub-object upi.upiId is accessible');
  testAssert(normalized.upiId === '9846830532@okaxis', 'Normalized flat property upiId is accessible for QR generator');
  testAssert(Array.isArray(normalized.terms) && normalized.terms.length > 0, 'Normalized flat terms array is accessible');

  // 4.2 getBusinessSettings retrieves and normalizes live Firestore data
  const retrieved = await getBusinessSettings(BIZ_ID, adminDb);
  testAssert(retrieved !== null, 'getBusinessSettings successfully returns Firestore document');
  testAssert(retrieved.phone === '+91 9846830599', 'getBusinessSettings reflects latest updated phone number');

  // 4.3 updateBusinessSettings safely updates Firestore document with audit trail
  const updatedDoc = await updateBusinessSettings(
    BIZ_ID,
    {
      ...retrieved,
      email: 'newemail@tpsbatterys.com',
    },
    { uid: 'admin-uid' },
    adminDb
  );
  testAssert(updatedDoc.email === 'newemail@tpsbatterys.com', 'updateBusinessSettings updates email in Firestore');
  testAssert(updatedDoc.updatedBy === 'admin-uid', 'updateBusinessSettings stamps audit updatedBy');

  console.log('\n[SECTION 5: Safe Initialization & Idempotent Migration]');

  // 5.1 Test safe initialization when document does not exist in another business
  const FRESH_BIZ = 'fresh-test-business';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const fDb = context.firestore();
    await setDoc(doc(fDb, 'businesses', FRESH_BIZ), { businessName: 'Fresh Branch' });
    await setDoc(doc(fDb, 'businesses', FRESH_BIZ, 'members', 'admin-uid'), {
      uid: 'admin-uid',
      email: 'admin@tps.com',
      displayName: 'Store Admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
  });

  const freshAdminDb = testEnv.authenticatedContext('admin-uid').firestore();
  const initResult = await initializeBusinessSettings(FRESH_BIZ, null, { uid: 'admin-uid' }, freshAdminDb);
  testAssert(initResult !== null, 'initializeBusinessSettings creates default settings for fresh business');
  testAssert(initResult.businessName === DEFAULT_BUSINESS_SETTINGS.businessName, 'Fresh settings match default businessName');

  // 5.2 Test migration idempotency: remote Firestore data is NOT overwritten if already present
  // Seed distinct remote data in fresh business
  await updateBusinessSettings(
    FRESH_BIZ,
    {
      ...initResult,
      phone: '+91 9999900000',
    },
    { uid: 'admin-uid' },
    freshAdminDb
  );

  // Set different data in mock localStorage
  localStorage.setItem('tps_business_profile', JSON.stringify({
    ...DEFAULT_BUSINESS_SETTINGS,
    phone: '+91 1111100000', // Stale local data
  }));

  const migrationResult = await migrateBusinessSettings(FRESH_BIZ, { uid: 'admin-uid' }, freshAdminDb);
  testAssert(migrationResult.migrated === false, 'Migration reports migrated: false when remote document already exists');
  testAssert(migrationResult.settings.phone === '+91 9999900000', 'Remote Firestore phone (+91 9999900000) was preserved, not overwritten by stale local cache');

  console.log('\n[SECTION 6: Critical Historical Invoice Immutability]');

  // 6.1 Create an invoice for the business and ensure businessSnapshot is stamped
  const invoiceData = {
    invoiceNumber: 'TPS/2026-27/006',
    invoiceDate: '2026-11-04',
    dueDate: '2026-11-04',
    paymentStatus: 'Paid',
    paymentMode: 'Bank Transfer',
    customer: {
      name: 'Kerala Power Substation',
      phone: '9846001122',
      address: 'Near Power Grid',
      city: 'Thrithala',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679552',
    },
    items: [
      {
        id: 'item-inv-1',
        name: 'Amaron Inverter Battery 150Ah',
        quantity: 1,
        sellingPrice: 12500,
        gstRate: 28,
        hsn: '8507',
        isTaxInclusive: true,
      },
    ],
    netPayable: 12500,
  };

  const currentBusinessSettings = await getBusinessSettings(BIZ_ID, adminDb);
  const createdInvoice = await createInvoiceWithCounter(
    BIZ_ID,
    invoiceData,
    { uid: 'admin-uid' },
    { prefix: 'TPS', business: currentBusinessSettings, dbInstance: adminDb }
  );

  testAssert(createdInvoice.businessSnapshot !== undefined, 'New invoice automatically receives stamped businessSnapshot');
  testAssert(createdInvoice.businessSnapshot.businessName === currentBusinessSettings.businessName, 'businessSnapshot records current store name');
  testAssert(createdInvoice.businessSnapshot.bankName === currentBusinessSettings.bankName, 'businessSnapshot records current bank name');
  testAssert(createdInvoice.businessSnapshot.email === 'newemail@tpsbatterys.com', 'businessSnapshot captured email at invoice creation time');

  // 6.2 Admin updates business profile in Firestore (e.g. store rebrands or changes settlement bank)
  await updateBusinessSettings(
    BIZ_ID,
    {
      ...currentBusinessSettings,
      businessName: 'TPS POWER AND BATTERY CORP',
      bank: {
        ...currentBusinessSettings.bank,
        bankName: 'HDFC Bank',
        accountNumber: '999988887777',
      },
      bankName: 'HDFC Bank',
      accountNo: '999988887777',
      email: 'corp@tpspower.com',
    },
    { uid: 'admin-uid' },
    adminDb
  );

  const updatedSettings = await getBusinessSettings(BIZ_ID, adminDb);
  testAssert(updatedSettings.businessName === 'TPS POWER AND BATTERY CORP', 'Live settings updated to new brand');
  testAssert(updatedSettings.bankName === 'HDFC Bank', 'Live settings updated to new bank');

  // 6.3 Verify historical invoice remains completely decoupled and unmodified in Firestore
  const fetchedHistoricalInvoice = await getInvoice(BIZ_ID, createdInvoice.id, adminDb);
  testAssert(
    fetchedHistoricalInvoice.businessSnapshot.businessName === 'TPS BATTERYS HOUSE',
    'Historical invoice businessSnapshot.businessName is UNCHANGED (still "TPS BATTERYS HOUSE")'
  );
  testAssert(
    fetchedHistoricalInvoice.businessSnapshot.bankName === 'Federal Bank',
    'Historical invoice businessSnapshot.bankName is UNCHANGED (still "Federal Bank")'
  );
  testAssert(
    fetchedHistoricalInvoice.businessSnapshot.email === 'newemail@tpsbatterys.com',
    'Historical invoice businessSnapshot.email is UNCHANGED (not affected by live rebrand)'
  );

  // 6.4 Legitimate Admin update to notes on the invoice (preserving snapshot) succeeds
  const legitimateUpdatePayload = {
    ...fetchedHistoricalInvoice,
    notes: 'Warranty card handed over to customer.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
  };
  await assertSucceeds(
    updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', createdInvoice.id), legitimateUpdatePayload),
    'Admin can legitimately update invoice notes while preserving businessSnapshot'
  );
  testAssert(true, 'Admin can legitimately update invoice notes while preserving businessSnapshot');

  // 6.5 Security Rules check: Attempt to mutate businessSnapshot on existing invoice must be REJECTED
  const tamperInvoicePayload = {
    ...fetchedHistoricalInvoice,
    businessSnapshot: {
      ...fetchedHistoricalInvoice.businessSnapshot,
      businessName: 'HACKED BRAND NAME',
    },
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
  };

  await assertFails(
    updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', createdInvoice.id), tamperInvoicePayload),
    'Security rules reject modification of businessSnapshot on existing invoice'
  );
  testAssert(true, 'Security rules reject modification of businessSnapshot on existing invoice');

  // 6.5 Vector PDF generation test: uses invoice.businessSnapshot over live store profile
  const pdfDoc = await generateVectorPdf(fetchedHistoricalInvoice, updatedSettings, 'Original for Buyer');
  testAssert(pdfDoc !== null, 'generateVectorPdf successfully builds PDF from historical invoice');
  testAssert(typeof pdfDoc.output === 'function', 'PDF output function is available');

  console.log('\n[SECTION 7: Real-Time Sync Subscription]');

  // 7.1 Verify subscribeToBusinessSettings emits updates
  let listenerReceived = null;
  const unsubscribe = subscribeToBusinessSettings(
    BIZ_ID,
    (settings) => {
      listenerReceived = settings;
    },
    (err) => {
      console.error('Subscription error:', err);
    },
    adminDb
  );

  // Allow initial snapshot
  await new Promise((r) => setTimeout(r, 100));
  testAssert(listenerReceived !== null, 'Real-time subscription delivers current settings');
  testAssert(listenerReceived.bankName === 'HDFC Bank', 'Real-time subscription reflects live bankName');

  unsubscribe();
  testAssert(true, 'Real-time subscription unsubscribes cleanly');

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runBusinessSettingsSuite().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
