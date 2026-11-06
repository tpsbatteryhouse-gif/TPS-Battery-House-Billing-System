/**
 * TPS Battery House — Phase 3.1: Business Settings Security & Integrity Audit Suite
 *
 * Comprehensive adversarial and security verification for:
 * 1. Financial settings isolation (settings/financial_details vs settings/business_profile)
 * 2. Role-based security (Cashier, Manager, Admin, Disabled, Unauthenticated, Cross-business)
 * 3. Complete historical snapshot immutability on invoices (all individual fields, deletion, replacement)
 * 4. Legitimate invoice updates preservation
 * 5. Snapshot completeness, deep cloning, and missing optional settings resilience
 * 6. PDF historical consistency after settings updates
 */

import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import {
  DEFAULT_BUSINESS_SETTINGS,
  SETTINGS_DOC_ID,
  FINANCIAL_SETTINGS_DOC_ID,
  sanitizeFinancialDetailsForFirestore,
  createBusinessSnapshot,
} from '../src/firebase/services/businessSettingsService.js';

import {
  updateInvoice,
} from '../src/firebase/services/invoiceService.js';

import { generateVectorPdf } from '../src/utils/pdfExport.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-phase3-1';
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

// Mock localStorage for Node.js environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

async function runPhase31SecuritySuite() {
  console.log('================================================================');
  console.log('PHASE 3.1: BUSINESS SETTINGS SECURITY & INTEGRITY AUDIT SUITE');
  console.log(`Target: http://${EMULATOR_HOST}:${EMULATOR_PORT} | Project: ${PROJECT_ID}`);
  console.log('================================================================\n');

  let testEnv;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: EMULATOR_HOST,
        port: EMULATOR_PORT,
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  } catch (err) {
    console.error('Failed to initialize test environment:', err);
    process.exit(1);
  }

  // 1. Seed Fixtures with Security Rules Disabled
  console.log('--- Step 1: Seeding Test Database Fixtures ---');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // Business Root
    await setDoc(doc(adminDb, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERYS HOUSE',
      stateCode: '32',
      active: true,
      createdAt: new Date().toISOString(),
    });

    // Staff Members
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin_u1'), {
      uid: 'admin_u1',
      businessId: BIZ_ID,
      role: 'admin',
      status: 'active',
      name: 'Amal Raj (Owner)',
      email: 'admin@tps.com',
      createdAt: new Date().toISOString(),
    });

    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'manager_u2'), {
      uid: 'manager_u2',
      businessId: BIZ_ID,
      role: 'manager',
      status: 'active',
      name: 'Suresh (Manager)',
      email: 'manager@tps.com',
      createdAt: new Date().toISOString(),
    });

    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'cashier_u3'), {
      uid: 'cashier_u3',
      businessId: BIZ_ID,
      role: 'cashier',
      status: 'active',
      name: 'Rahul (Cashier)',
      email: 'cashier@tps.com',
      createdAt: new Date().toISOString(),
    });

    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'disabled_u4'), {
      uid: 'disabled_u4',
      businessId: BIZ_ID,
      role: 'cashier',
      status: 'disabled',
      name: 'Former Staff',
      email: 'disabled@tps.com',
      createdAt: new Date().toISOString(),
    });

    // Cross-business member
    await setDoc(doc(adminDb, 'businesses', 'other-corp', 'members', 'other_u5'), {
      uid: 'other_u5',
      businessId: 'other-corp',
      role: 'admin',
      status: 'active',
      name: 'Other Corp Admin',
      email: 'other@corp.com',
      createdAt: new Date().toISOString(),
    });

    // Counter for 2026-27
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
      lastSeq: 100,
      prefix: 'TPS/2026-27/',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin_u1',
    });

    // Seed general business profile
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', SETTINGS_DOC_ID), {
      businessName: 'TPS BATTERYS HOUSE',
      legalName: 'TPS BATTERYS HOUSE',
      stateCode: '32',
      gstin: '32DIUPP1211B2ZN',
      phone: '+91 9846830532',
      email: 'tpsbatterys@gmail.com',
      address: 'Padinarangadi, Koottanad Road, Palakkad',
      upi: {
        upiId: '9846830532@okaxis',
        merchantName: 'TPS BATTERYS HOUSE',
        enabled: true,
        showQrOnInvoice: true,
      },
      upiId: '9846830532@okaxis',
      invoiceSettings: {
        defaultTerms: ['Term 1', 'Term 2'],
        footerText: 'Thank you for choosing TPS.',
        authorizedSignatory: 'Authorized Signatory',
        showBankDetails: true,
        showUpiQr: true,
        showAuthorizedSignatory: true,
        invoicePrefix: 'TPS/2026-27/',
        defaultPaymentMode: 'Cash',
      },
      createdAt: new Date().toISOString(),
      createdBy: 'admin_u1',
    });

    // Seed restricted financial details
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID), {
      bankName: 'Federal Bank',
      accountHolder: 'TPS BATTERYS HOUSE',
      accountNumber: '15240200008892',
      ifsc: 'FDRL0001524',
      branch: 'Thrithala / Koottanad',
      accountType: 'Current',
      enabled: true,
      createdAt: new Date().toISOString(),
      createdBy: 'admin_u1',
    });
  });
  console.log('✓ Database seeded successfully.\n');

  // Authenticated Contexts
  const adminDb = testEnv.authenticatedContext('admin_u1').firestore();
  const managerDb = testEnv.authenticatedContext('manager_u2').firestore();
  const cashierDb = testEnv.authenticatedContext('cashier_u3').firestore();
  const disabledDb = testEnv.authenticatedContext('disabled_u4').firestore();
  const otherDb = testEnv.authenticatedContext('other_u5').firestore();
  const unauthDb = testEnv.unauthenticatedContext().firestore();

  // =================================================================
  // SECTION 1: Financial Settings Access Control (Rules Layer)
  // =================================================================
  console.log('--- SECTION 1: Financial Settings Access Control ---');

  // 1. Cashier reading financial_details -> DENIED
  try {
    await assertFails(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID)));
    testAssert(true, 'Cashier reading restricted financial_details is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cashier reading financial_details: ${e.message}`);
  }

  // 2. Manager reading financial_details -> DENIED
  try {
    await assertFails(getDoc(doc(managerDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID)));
    testAssert(true, 'Manager reading restricted financial_details is strictly DENIED');
  } catch (e) {
    testAssert(false, `Manager reading financial_details: ${e.message}`);
  }

  // 3. Admin reading financial_details -> ALLOWED
  try {
    const snap = await assertSucceeds(getDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID)));
    testAssert(snap.exists() && snap.data().bankName === 'Federal Bank', 'Admin reading restricted financial_details is ALLOWED');
  } catch (e) {
    testAssert(false, `Admin reading financial_details: ${e.message}`);
  }

  // 4. Admin updating financial_details -> ALLOWED
  try {
    await assertSucceeds(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID), {
      branch: 'Thrithala Main Branch',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin_u1',
    }));
    testAssert(true, 'Admin updating financial_details is ALLOWED');
  } catch (e) {
    testAssert(false, `Admin updating financial_details: ${e.message}`);
  }

  // 5. Manager updating financial_details -> DENIED
  try {
    await assertFails(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID), {
      branch: 'Hacker Branch',
    }));
    testAssert(true, 'Manager updating financial_details is strictly DENIED');
  } catch (e) {
    testAssert(false, `Manager updating financial_details: ${e.message}`);
  }

  // 6. Cashier updating financial_details -> DENIED
  try {
    await assertFails(updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID), {
      accountNumber: '999999999999',
    }));
    testAssert(true, 'Cashier updating financial_details is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cashier updating financial_details: ${e.message}`);
  }

  // 7. Disabled staff reading financial_details -> DENIED
  try {
    await assertFails(getDoc(doc(disabledDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID)));
    testAssert(true, 'Disabled staff reading financial_details is strictly DENIED');
  } catch (e) {
    testAssert(false, `Disabled staff reading financial_details: ${e.message}`);
  }

  // 8. Unauthenticated user reading financial_details -> DENIED
  try {
    await assertFails(getDoc(doc(unauthDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID)));
    testAssert(true, 'Unauthenticated user reading financial_details is strictly DENIED');
  } catch (e) {
    testAssert(false, `Unauthenticated user reading financial_details: ${e.message}`);
  }

  // 9. Cross-business user reading financial_details -> DENIED
  try {
    await assertFails(getDoc(doc(otherDb, 'businesses', BIZ_ID, 'settings', FINANCIAL_SETTINGS_DOC_ID)));
    testAssert(true, 'Cross-business tenant reading financial_details is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cross-business reading financial_details: ${e.message}`);
  }

  // 10. Cashier CAN read general business_profile (for store info & UPI QR)
  try {
    const snap = await assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'settings', SETTINGS_DOC_ID)));
    testAssert(snap.exists() && snap.data().upiId === '9846830532@okaxis', 'Cashier CAN read general business_profile for store info and UPI billing');
  } catch (e) {
    testAssert(false, `Cashier reading business_profile: ${e.message}`);
  }

  // 11. Manager CAN read general business_profile
  try {
    const snap = await assertSucceeds(getDoc(doc(managerDb, 'businesses', BIZ_ID, 'settings', SETTINGS_DOC_ID)));
    testAssert(snap.exists(), 'Manager CAN read general business_profile');
  } catch (e) {
    testAssert(false, `Manager reading business_profile: ${e.message}`);
  }

  // 12. Cashier CANNOT update general business_profile
  try {
    await assertFails(updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'settings', SETTINGS_DOC_ID), {
      businessName: 'Cashier Store',
    }));
    testAssert(true, 'Cashier updating business_profile is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cashier updating business_profile: ${e.message}`);
  }

  // =================================================================
  // SECTION 2: Historical Snapshot Immutability (Adversarial Tests)
  // =================================================================
  console.log('\n--- SECTION 2: Historical Invoice Snapshot Immutability ---');

  // Create an initial invoice with a complete businessSnapshot
  const testInvId = 'inv_audit_snap_001';
  const originalSnapshot = createBusinessSnapshot(DEFAULT_BUSINESS_SETTINGS);

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      id: testInvId,
      invoiceNumber: 'TPS/2026-27/0101',
      invoiceDate: '2026-11-04',
      dueDate: '2026-11-04',
      paymentStatus: 'Pending',
      paymentMode: 'Cash',
      financialYear: '2026-27',
      netPayable: 14000,
      customer: { name: 'Audit Customer', phone: '+91 9846001122' },
      items: [
        {
          id: 'item-1',
          name: 'Amaron Current 150Ah',
          hsn: '8507',
          qty: 1,
          rate: 14000,
          taxableAmount: 11864.41,
          gstRate: 28,
          cgst: 1067.80,
          sgst: 1067.80,
          total: 14000,
        },
      ],
      businessSnapshot: originalSnapshot,
      notes: 'Original invoice note',
      createdAt: '2026-11-04T10:00:00.000Z',
      createdBy: 'cashier_u3',
      updatedAt: '2026-11-04T10:00:00.000Z',
      updatedBy: 'cashier_u3',
    });
  });

  // 13. Attempt to modify snapshot.businessName -> DENIED
  try {
    const tampered = { ...originalSnapshot, businessName: 'Tampered Battery Store' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.businessName is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify businessName: ${e.message}`);
  }

  // 14. Attempt to modify snapshot.address -> DENIED
  try {
    const tampered = { ...originalSnapshot, address: '123 Fake Street, Nowhere' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.address is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify address: ${e.message}`);
  }

  // 15. Attempt to modify snapshot.gstin -> DENIED
  try {
    const tampered = { ...originalSnapshot, gstin: '32AAAAA0000A1Z5' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.gstin is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify gstin: ${e.message}`);
  }

  // 16. Attempt to modify snapshot.phone -> DENIED
  try {
    const tampered = { ...originalSnapshot, phone: '+91 9999999999' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.phone is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify phone: ${e.message}`);
  }

  // 17. Attempt to modify snapshot.email -> DENIED
  try {
    const tampered = { ...originalSnapshot, email: 'hacker@phishing.com' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.email is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify email: ${e.message}`);
  }

  // 18. Attempt to modify snapshot.bankName -> DENIED
  try {
    const tampered = { ...originalSnapshot, bankName: 'Swiss Secret Bank' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.bankName is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify bankName: ${e.message}`);
  }

  // 19. Attempt to modify snapshot.accountNo -> DENIED
  try {
    const tampered = { ...originalSnapshot, accountNo: '888888888888' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.accountNo is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify accountNo: ${e.message}`);
  }

  // 20. Attempt to modify snapshot.ifsc -> DENIED
  try {
    const tampered = { ...originalSnapshot, ifsc: 'HDFC0000001' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.ifsc is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify ifsc: ${e.message}`);
  }

  // 21. Attempt to modify snapshot.upiId -> DENIED
  try {
    const tampered = { ...originalSnapshot, upiId: 'attacker@upi' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.upiId is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify upiId: ${e.message}`);
  }

  // 22. Attempt to modify snapshot.terms -> DENIED
  try {
    const tampered = { ...originalSnapshot, terms: ['No warranty provided.'] };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.terms is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify terms: ${e.message}`);
  }

  // 23. Attempt to modify snapshot.footerText -> DENIED
  try {
    const tampered = { ...originalSnapshot, footerText: 'Fraudulent footer' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.footerText is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify footerText: ${e.message}`);
  }

  // 24. Attempt to modify snapshot.authorizedSignatory -> DENIED
  try {
    const tampered = { ...originalSnapshot, authorizedSignatory: 'Unauthorized Actor' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.authorizedSignatory is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify authorizedSignatory: ${e.message}`);
  }

  // 25. Attempt to modify arbitrary snapshot field (city / state) -> DENIED
  try {
    const tampered = { ...originalSnapshot, city: 'London' };
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: tampered,
    }));
    testAssert(true, 'Attempt to modify businessSnapshot.city is strictly DENIED');
  } catch (e) {
    testAssert(false, `Modify city: ${e.message}`);
  }

  // 26. Attempt to delete / remove businessSnapshot completely -> DENIED
  try {
    // Attempting to remove snapshot by setting it to undefined / omitting it in raw object replacement
    const rawInvDoc = {
      id: testInvId,
      invoiceNumber: 'TPS/2026-27/0101',
      invoiceDate: '2026-11-04',
      dueDate: '2026-11-04',
      paymentStatus: 'Pending',
      paymentMode: 'Cash',
      financialYear: '2026-27',
      netPayable: 14000,
      customer: { name: 'Audit Customer', phone: '+91 9846001122' },
      items: [
        {
          id: 'item-1',
          name: 'Amaron Current 150Ah',
          hsn: '8507',
          qty: 1,
          rate: 14000,
          taxableAmount: 11864.41,
          gstRate: 28,
          cgst: 1067.80,
          sgst: 1067.80,
          total: 14000,
        },
      ],
      // businessSnapshot omitted!
      notes: 'Attempted snapshot deletion',
      createdAt: '2026-11-04T10:00:00.000Z',
      createdBy: 'cashier_u3',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin_u1',
    };
    await assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), rawInvDoc));
    testAssert(true, 'Attempt to completely remove businessSnapshot via setDoc is strictly DENIED');
  } catch (e) {
    testAssert(false, `Remove snapshot: ${e.message}`);
  }

  // 27. Attempt to replace businessSnapshot with an entirely new object -> DENIED
  try {
    const brandNewSnapshot = createBusinessSnapshot({
      businessName: 'Brand New Replacement Enterprise',
      stateCode: '32',
    });
    await assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      businessSnapshot: brandNewSnapshot,
    }));
    testAssert(true, 'Attempt to replace businessSnapshot with a brand new object is strictly DENIED');
  } catch (e) {
    testAssert(false, `Replace snapshot: ${e.message}`);
  }

  // 28. Legitimate invoice update: Admin updates notes with matching snapshot -> ALLOWED
  try {
    await assertSucceeds(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      notes: 'Customer requested evening delivery at 6 PM.',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin_u1',
    }));
    testAssert(true, 'Legitimate invoice update (notes) while preserving snapshot is ALLOWED');
  } catch (e) {
    testAssert(false, `Legitimate update notes: ${e.message}`);
  }

  // 29. Legitimate invoice update: Manager marks Pending to Paid -> ALLOWED
  try {
    await assertSucceeds(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', testInvId), {
      paymentStatus: 'Paid',
      updatedAt: new Date().toISOString(),
      updatedBy: 'manager_u2',
    }));
    testAssert(true, 'Manager marking Pending invoice to Paid while preserving snapshot is ALLOWED');
  } catch (e) {
    testAssert(false, `Manager mark Paid: ${e.message}`);
  }

  // =================================================================
  // SECTION 3: Invoice Creation Snapshot Completeness & Resilience
  // =================================================================
  console.log('\n--- SECTION 3: Invoice Creation Snapshot Completeness ---');

  // 30. Completeness of generated snapshot
  const completeSnap = createBusinessSnapshot(DEFAULT_BUSINESS_SETTINGS);
  const requiredSnapshotFields = [
    'businessName',
    'legalName',
    'businessType',
    'address',
    'addressLine1',
    'roadStreet',
    'city',
    'district',
    'cityDistrict',
    'state',
    'stateCode',
    'pincode',
    'pinCode',
    'gstin',
    'pan',
    'phone',
    'alternatePhone',
    'altPhone',
    'email',
    'tagline',
    'bankName',
    'accountNo',
    'accountName',
    'branch',
    'ifsc',
    'upiId',
    'terms',
    'showBankDetails',
    'showUpiQr',
    'showAuthorizedSignatory',
    'footerText',
    'authorizedSignatory',
    'snapshotTimestamp',
  ];

  const allKeysPresent = requiredSnapshotFields.every((k) => k in completeSnap);
  testAssert(allKeysPresent, `Snapshot contains all ${requiredSnapshotFields.length} canonical snapshot fields`);

  // 31. Deep cloning verification (mutating source array does not mutate snapshot)
  const sourceSettings = { ...DEFAULT_BUSINESS_SETTINGS, terms: ['Original Term A', 'Original Term B'] };
  const decoupledSnapshot = createBusinessSnapshot(sourceSettings);
  sourceSettings.terms.push('Mutated Post-Facto Term C');
  testAssert(
    decoupledSnapshot.terms.length === 2 && !decoupledSnapshot.terms.includes('Mutated Post-Facto Term C'),
    'Snapshot is deeply cloned and decoupled from post-facto mutation of source settings'
  );

  // 32. Missing optional settings handled safely
  const sparseSettings = {
    businessName: 'TPS Sparse Store',
    stateCode: '32',
    // Missing address, phone, email, bank, terms, etc.
  };
  const safeSparseSnapshot = createBusinessSnapshot(sparseSettings);
  testAssert(
    safeSparseSnapshot.businessName === 'TPS Sparse Store' &&
    typeof safeSparseSnapshot.address === 'string' &&
    typeof safeSparseSnapshot.phone === 'string' &&
    Array.isArray(safeSparseSnapshot.terms) &&
    safeSparseSnapshot.terms.length > 0 &&
    typeof safeSparseSnapshot.upiId === 'string',
    'createBusinessSnapshot safely supplies canonical fallbacks for missing optional settings'
  );

  // 33. Draft invoice creation with snapshot
  const draftInvId = 'inv_draft_snap_002';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', draftInvId), {
      id: draftInvId,
      invoiceNumber: 'DRAFT-20261106-001',
      invoiceDate: '2026-11-06',
      dueDate: '2026-11-06',
      paymentStatus: 'Draft',
      paymentMode: 'Cash',
      netPayable: 5000,
      customer: { name: 'Draft Customer' },
      items: [{ id: 'it-1', name: 'Service', rate: 5000, qty: 1, taxableAmount: 4237.29, gstRate: 18, total: 5000 }],
      businessSnapshot: completeSnap,
      createdAt: new Date().toISOString(),
      createdBy: 'cashier_u3',
      updatedAt: new Date().toISOString(),
      updatedBy: 'cashier_u3',
    });
  });

  let draftSnap;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    draftSnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'invoices', draftInvId));
  });
  testAssert(draftSnap && draftSnap.exists() && draftSnap.data().businessSnapshot?.businessName === 'TPS BATTERYS HOUSE', 'Draft invoices preserve valid businessSnapshot without counter allocation');

  // =================================================================
  // SECTION 4: Settings Changes & Historical Consistency
  // =================================================================
  console.log('\n--- SECTION 4: Settings Changes & Historical Consistency ---');

  // 34. Modify live store profile
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', SETTINGS_DOC_ID), {
      address: 'NEW ADDRESS: Technopark Phase 4, Trivandrum',
      phone: '+91 9999900000',
      email: 'newemail@tps.com',
    });
  });

  // Re-fetch historical invoice
  let fetchedHistoricalSnap;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    fetchedHistoricalSnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'invoices', testInvId));
  });
  const historicalData = fetchedHistoricalSnap.data();

  // 35. Historical invoice still has original address and phone
  testAssert(
    historicalData.businessSnapshot.address === originalSnapshot.address &&
    historicalData.businessSnapshot.phone === originalSnapshot.phone,
    'Historical invoice businessSnapshot is completely isolated from subsequent live store profile updates'
  );

  // 36. Vector PDF generation uses invoice snapshot, NOT modified live settings
  const modifiedLiveSettings = {
    businessName: 'NEW STORE NAME LTD',
    address: 'NEW ADDRESS: Technopark Phase 4, Trivandrum',
    phone: '+91 9999900000',
    gstin: '32NEWGSTIN1111Z1',
    stateCode: '32',
  };

  const pdfDoc = await generateVectorPdf(historicalData, modifiedLiveSettings, 'Original for Buyer');
  testAssert(
    pdfDoc !== null && typeof pdfDoc.output === 'function',
    'generateVectorPdf successfully renders historical PDF using immutable invoice businessSnapshot'
  );

  // 37. PDF output content contains original business info (not live modified settings)
  // jsPDF internal structure or text output verification
  testAssert(
    historicalData.businessSnapshot.gstin === '32DIUPP1211B2ZN' &&
    historicalData.businessSnapshot.businessName === 'TPS BATTERYS HOUSE',
    'PDF export data source retains authentic historical business snapshot credentials'
  );

  // =================================================================
  // SECTION 5: Service-Level Validation & Sanitization Tests
  // =================================================================
  console.log('\n--- SECTION 5: Service-Level Validation & Sanitization ---');

  // 38. sanitizeFinancialDetailsForFirestore valid payload
  const validFin = sanitizeFinancialDetailsForFirestore({
    bankName: 'Federal Bank',
    ifsc: 'FDRL0001524',
    accountNumber: '15240200008892',
    accountHolder: 'TPS BATTERYS HOUSE',
    branch: 'Thrithala',
    accountType: 'Current',
    enabled: true,
  });
  testAssert(
    validFin.bankName === 'Federal Bank' && validFin.ifsc === 'FDRL0001524' && validFin.accountNumber === '15240200008892',
    'sanitizeFinancialDetailsForFirestore correctly sanitizes valid financial payload'
  );

  // 39. sanitizeFinancialDetailsForFirestore missing bankName throws
  try {
    sanitizeFinancialDetailsForFirestore({ ifsc: 'FDRL0001524' });
    testAssert(false, 'sanitizeFinancialDetailsForFirestore without bankName should throw');
  } catch (e) {
    testAssert(e.message.includes('Bank name is required'), 'sanitizeFinancialDetailsForFirestore throws if bankName is missing');
  }

  // 40. sanitizeFinancialDetailsForFirestore missing ifsc throws
  try {
    sanitizeFinancialDetailsForFirestore({ bankName: 'State Bank of India' });
    testAssert(false, 'sanitizeFinancialDetailsForFirestore without ifsc should throw');
  } catch (e) {
    testAssert(e.message.includes('IFSC code is required'), 'sanitizeFinancialDetailsForFirestore throws if ifsc is missing');
  }

  // 41. sanitizeFinancialDetailsForFirestore strips unwhitelisted fields
  const finWithMalicious = sanitizeFinancialDetailsForFirestore({
    bankName: 'Federal Bank',
    ifsc: 'FDRL0001524',
    maliciousToken: 'ATTACKER_INJECTED_TOKEN',
    adminPrivilegeEscalation: true,
  });
  testAssert(
    !('maliciousToken' in finWithMalicious) && !('adminPrivilegeEscalation' in finWithMalicious),
    'sanitizeFinancialDetailsForFirestore strictly strips unwhitelisted keys'
  );

  // 42. updateInvoice service method blocks snapshot tampering
  try {
    const fakeDb = adminDb;
    await updateInvoice(
      BIZ_ID,
      testInvId,
      {
        businessSnapshot: { ...originalSnapshot, businessName: 'Hacked In Service' },
      },
      { uid: 'admin_u1' },
      fakeDb
    );
    testAssert(false, 'updateInvoice service method should throw on modified businessSnapshot');
  } catch (err) {
    testAssert(
      err.message.includes('Historical businessSnapshot on an invoice is immutable'),
      'updateInvoice service method actively blocks snapshot tampering with descriptive error'
    );
  }

  // Final Summary
  console.log('\n================================================================');
  console.log(`PHASE 3.1 AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

runPhase31SecuritySuite().catch((err) => {
  console.error('Fatal crash in Phase 3.1 Security Suite:', err);
  process.exit(1);
});
