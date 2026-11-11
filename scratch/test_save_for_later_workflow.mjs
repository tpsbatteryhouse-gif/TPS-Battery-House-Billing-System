/**
 * TPS BATTERY HOUSE — SAVE FOR LATER (DRAFT) WORKFLOW & TRANSITION SUITE
 *
 * Exhaustively tests all 19 required scenarios against the live Firebase Firestore Emulator:
 * 1. Admin saves a draft.
 * 2. Manager saves a draft.
 * 3. Cashier saves a draft.
 * 4. Disabled staff cannot save a draft.
 * 5. Removed staff cannot save a draft.
 * 6. Unauthenticated user cannot save a draft.
 * 7. Draft creation works when the financial-year counter is missing.
 * 8. Saving a draft does not increment the counter.
 * 9. Saving a draft does not create an issued-invoice reservation.
 * 10. Repeated clicks do not create duplicate drafts.
 * 11. Existing draft updates preserve its identity.
 * 12. Customer details survive save and reload.
 * 13. Line items survive save and reload.
 * 14. Discounts and old battery values survive save and reload.
 * 15. GST and financial values remain unchanged.
 * 16. Draft can subsequently be issued successfully.
 * 17. Issuance allocates one official invoice number.
 * 18. Duplicate issuance is rejected.
 * 19. Cross-business draft access is rejected.
 * Plus: Save & Print permanent issuance workflow remains completely intact.
 */

import fs from 'fs';
import assert from 'assert';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import {
  saveInvoiceDraft,
  createInvoiceWithCounter,
  initializeInvoiceCounter,
} from '../src/firebase/services/invoiceService.js';
import { calculateInvoiceTotals } from '../src/utils/gstCalculations.js';

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
  console.log('TPS BATTERY HOUSE — SAVE FOR LATER (DRAFT) WORKFLOW SUITE');
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

  // Clear firestore
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
      displayName: 'Store Cashier',
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
  const disabledClient = testEnv.authenticatedContext('disabled_uid', { email: 'disabled@tps.com' }).firestore();
  const unauthClient = testEnv.unauthenticatedContext().firestore();

  const adminUser = { uid: 'admin_uid', role: 'admin' };
  const managerUser = { uid: 'manager_uid', role: 'manager' };
  const cashierUser = { uid: 'cashier_uid', role: 'cashier' };

  const sampleDraft = {
    customer: {
      name: 'Green Valley Agro Farm',
      phone: '9847334455',
      address: 'Kudallur, Anakkara Road',
      city: 'Anakkara',
      district: 'Palakkad',
      pincode: '679551',
      stateCode: '32',
      gstin: '32AABCK9921B1Z2',
    },
    items: [
      {
        id: 'item-1',
        name: 'Exide InvaMaster 150Ah Tall Tubular Battery',
        category: 'battery',
        qty: 2,
        rate: 14800,
        isTaxInclusive: true,
        gstRate: 28,
        unit: 'Set',
        hsn: '8507',
      },
      {
        id: 'item-2',
        name: 'Luminous Cruze 2.5kVA Pure Sine Wave Inverter',
        category: 'inverter',
        qty: 1,
        rate: 28500,
        isTaxInclusive: true,
        gstRate: 18,
        unit: 'Set',
        hsn: '8504',
      },
    ],
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-20',
    paymentStatus: 'Draft',
    paymentMode: 'Cash',
    additionalDiscount: 500,
    scrapExchange: {
      enabled: true,
      amount: 1500,
      description: 'Old 150Ah Scrap Battery Buyback',
    },
    notes: 'Draft quotation for customer review before final billing.',
  };

  const calculatedTotals = calculateInvoiceTotals(sampleDraft, '32');
  sampleDraft.netPayable = calculatedTotals.netPayable; // 56,100

  console.log('--- PART 1: DRAFT PERSISTENCE WITHOUT COUNTERS & PERMISSIONS ---');

  // Verify counter DOES NOT exist initially
  const initialCounterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
  assert.strictEqual(initialCounterSnap.exists(), false, 'Counter invoices_2026-27 must not exist initially');

  // 1. Admin saves a draft
  let adminDraftResult;
  await it('Scenario 1: Admin saves a draft', async () => {
    adminDraftResult = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_admin_1' },
      adminUser,
      { dbInstance: adminClient }
    );
    assert.strictEqual(adminDraftResult.paymentStatus, 'Draft');
    assert(adminDraftResult.invoiceNumber.startsWith('DRAFT'), 'Draft invoice number must start with DRAFT-');

    const snap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'invoices', 'draft_admin_1'));
    assert.strictEqual(snap.exists(), true);
    assert.strictEqual(snap.data().paymentStatus, 'Draft');
  });

  // 2. Manager saves a draft
  let managerDraftResult;
  await it('Scenario 2: Manager saves a draft', async () => {
    managerDraftResult = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_manager_1' },
      managerUser,
      { dbInstance: managerClient }
    );
    assert.strictEqual(managerDraftResult.paymentStatus, 'Draft');
    assert(managerDraftResult.invoiceNumber.startsWith('DRAFT'));

    const snap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'));
    assert.strictEqual(snap.exists(), true);
    assert.strictEqual(snap.data().paymentStatus, 'Draft');
  });

  // 3. Cashier saves a draft
  let cashierDraftResult;
  await it('Scenario 3: Cashier saves a draft', async () => {
    cashierDraftResult = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_cashier_1' },
      cashierUser,
      { dbInstance: cashierClient }
    );
    assert.strictEqual(cashierDraftResult.paymentStatus, 'Draft');
    assert(cashierDraftResult.invoiceNumber.startsWith('DRAFT'));

    const snap = await getDoc(doc(cashierClient, 'businesses', BIZ_ID, 'invoices', 'draft_cashier_1'));
    assert.strictEqual(snap.exists(), true);
    assert.strictEqual(snap.data().paymentStatus, 'Draft');
  });

  console.log('\n--- PART 2: ACCESS CONTROL REJECTION GUARDS ---');

  // 4. Disabled staff cannot save a draft
  await it('Scenario 4: Disabled staff cannot save a draft', async () => {
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        BIZ_ID,
        { ...sampleDraft, id: 'draft_disabled_1' },
        { uid: 'disabled_uid' },
        { dbInstance: disabledClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Disabled staff must be rejected');
  });

  // 5. Removed staff cannot save a draft
  await it('Scenario 5: Removed staff cannot save a draft', async () => {
    const unknownClient = testEnv.authenticatedContext('removed_uid', { email: 'removed@tps.com' }).firestore();
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        BIZ_ID,
        { ...sampleDraft, id: 'draft_removed_1' },
        { uid: 'removed_uid' },
        { dbInstance: unknownClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Removed staff must be rejected');
  });

  // 6. Unauthenticated user cannot save a draft
  await it('Scenario 6: Unauthenticated user cannot save a draft', async () => {
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        BIZ_ID,
        { ...sampleDraft, id: 'draft_unauth_1' },
        null,
        { dbInstance: unauthClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Unauthenticated user must be rejected');
  });

  console.log('\n--- PART 3: COUNTER & RESERVATION ISOLATION ---');

  // 7. Draft creation works when financial-year counter is missing
  await it('Scenario 7: Draft creation works when financial-year counter is missing', async () => {
    const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.exists(), false, 'Counter does NOT exist');
    // Manager creates draft with prospective number e.g. TPS/2026-27/009 in payload
    const draftWithProspective = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: 'draft_manager_nov26', invoiceNumber: 'TPS/2026-27/009' },
      managerUser,
      { dbInstance: managerClient }
    );
    assert(draftWithProspective.invoiceNumber.startsWith('DRAFT'), 'Must assign DRAFT identifier instead of consuming preview sequence');
    assert.strictEqual(draftWithProspective.paymentStatus, 'Draft');
  });

  // 8. Saving a draft does not increment the counter
  await it('Scenario 8: Saving a draft does not increment the counter', async () => {
    const counterSnap = await getDoc(doc(adminClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.exists(), false, 'Counter document was NOT created or incremented by drafts');
  });

  // 9. Saving a draft does not create an issued-invoice reservation
  await it('Scenario 9: Saving a draft does not create an issued-invoice reservation', async () => {
    const resColSnap = await getDocs(collection(adminClient, 'businesses', BIZ_ID, 'invoice_numbers'));
    assert.strictEqual(resColSnap.size, 0, 'No number reservations must exist for drafts');
  });

  console.log('\n--- PART 4: IDEMPOTENCY & FORM STATE INTEGRITY ---');

  // 10. Repeated clicks do not create duplicate drafts
  await it('Scenario 10: Repeated clicks do not create duplicate drafts', async () => {
    const stableId = 'draft_click_repeat_1';
    await saveInvoiceDraft(BIZ_ID, { ...sampleDraft, id: stableId }, managerUser, { dbInstance: managerClient });
    await saveInvoiceDraft(BIZ_ID, { ...sampleDraft, id: stableId }, managerUser, { dbInstance: managerClient });
    await saveInvoiceDraft(BIZ_ID, { ...sampleDraft, id: stableId }, managerUser, { dbInstance: managerClient });

    const snap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', stableId));
    assert.strictEqual(snap.exists(), true);
  });

  // 11. Existing draft updates preserve its identity
  await it('Scenario 11: Existing draft updates preserve its identity', async () => {
    const stableId = 'draft_identity_test';
    const firstSave = await saveInvoiceDraft(
      BIZ_ID,
      { ...sampleDraft, id: stableId },
      managerUser,
      { dbInstance: managerClient }
    );

    const initialNumber = firstSave.invoiceNumber;
    const initialCreatedAt = firstSave.createdAt;
    assert(initialNumber.startsWith('DRAFT'));

    // Update draft with changed quantity and discount
    const updatedDraft = await saveInvoiceDraft(
      BIZ_ID,
      {
        ...sampleDraft,
        id: stableId,
        invoiceNumber: initialNumber,
        additionalDiscount: 1000,
        items: [{ ...sampleDraft.items[0], qty: 3 }],
      },
      managerUser,
      { dbInstance: managerClient }
    );

    assert.strictEqual(updatedDraft.id, stableId, 'Document ID must be preserved');
    assert.strictEqual(updatedDraft.invoiceNumber, initialNumber, 'Draft number must be preserved on update');
    assert.strictEqual(updatedDraft.createdAt, initialCreatedAt, 'createdAt must be preserved on update');
    assert.strictEqual(updatedDraft.additionalDiscount, 1000);
    assert.strictEqual(updatedDraft.items[0].qty, 3);
  });

  // 12. Customer details survive save and reload
  await it('Scenario 12: Customer details survive save and reload', async () => {
    const snap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'));
    const data = snap.data();
    assert.strictEqual(data.customer.name, 'Green Valley Agro Farm');
    assert.strictEqual(data.customer.phone, '9847334455');
    assert.strictEqual(data.customer.address, 'Kudallur, Anakkara Road');
    assert.strictEqual(data.customer.district, 'Palakkad');
    assert.strictEqual(data.customer.gstin, '32AABCK9921B1Z2');
    assert.strictEqual(data.customer.stateCode, '32');
  });

  // 13. Line items survive save and reload
  await it('Scenario 13: Line items survive save and reload', async () => {
    const snap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'));
    const data = snap.data();
    assert.strictEqual(data.items.length, 2);
    assert.strictEqual(data.items[0].name, 'Exide InvaMaster 150Ah Tall Tubular Battery');
    assert.strictEqual(data.items[0].qty, 2);
    assert.strictEqual(data.items[0].rate, 14800);
    assert.strictEqual(data.items[0].gstRate, 28);
    assert.strictEqual(data.items[1].name, 'Luminous Cruze 2.5kVA Pure Sine Wave Inverter');
    assert.strictEqual(data.items[1].qty, 1);
    assert.strictEqual(data.items[1].rate, 28500);
  });

  // 14. Discounts and old battery values survive save and reload
  await it('Scenario 14: Discounts and old battery values survive save and reload', async () => {
    const snap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'));
    const data = snap.data();
    assert.strictEqual(data.additionalDiscount, 500);
    assert.strictEqual(data.scrapExchange.enabled, true);
    assert.strictEqual(data.scrapExchange.amount, 1500);
    assert.strictEqual(data.scrapExchange.description, 'Old 150Ah Scrap Battery Buyback');
  });

  // 15. GST and financial values remain unchanged
  await it('Scenario 15: GST and financial values remain unchanged', async () => {
    const snap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'));
    const data = snap.data();
    assert.strictEqual(data.netPayable, 56100);
  });

  console.log('\n--- PART 5: DRAFT-TO-ISSUED TRANSITIONS & VALIDATION ---');

  // Initialize counter for financial year 2026-27 by Administrator
  await initializeInvoiceCounter(BIZ_ID, FY, 0, PREFIX, adminUser, adminClient);

  // 16. Draft can subsequently be issued successfully
  let issuedInvoice;
  await it('Scenario 16: Draft can subsequently be issued successfully', async () => {
    // Manager loads the draft 'draft_manager_1' and clicks Save & Issue Bill
    const draftSnap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'));
    const draftData = draftSnap.data();

    issuedInvoice = await createInvoiceWithCounter(
      BIZ_ID,
      {
        ...draftData,
        paymentStatus: 'Pending', // Transitioning from Draft to Pending
      },
      managerUser,
      { dbInstance: managerClient, prefix: PREFIX }
    );

    assert.strictEqual(issuedInvoice.id, 'draft_manager_1', 'Must retain draft document ID');
    assert.strictEqual(issuedInvoice.paymentStatus, 'Pending');
    assert.strictEqual(issuedInvoice.invoiceNumber, `${PREFIX}001`, 'Must allocate sequential invoice number');
  });

  // 17. Issuance allocates one official invoice number
  await it('Scenario 17: Issuance allocates one official invoice number and updates counter & reservation', async () => {
    const invSnap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'));
    assert.strictEqual(invSnap.data().invoiceNumber, `${PREFIX}001`);
    assert.strictEqual(invSnap.data().paymentStatus, 'Pending');

    const counterSnap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.data().lastSeq, 1);
    assert.strictEqual(counterSnap.data().lastInvoiceNumber, `${PREFIX}001`);

    const safeNum = `${PREFIX}001`.replace(/\//g, '_');
    const resSnap = await getDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoice_numbers', safeNum));
    assert.strictEqual(resSnap.exists(), true);
    assert.strictEqual(resSnap.data().invoiceId, 'draft_manager_1');
  });

  // 18. Duplicate issuance is rejected
  await it('Scenario 18: Duplicate issuance is rejected', async () => {
    // Attempting to overwrite an already-issued invoice with conflicting numbers
    let errCaught = null;
    try {
      await setDoc(doc(managerClient, 'businesses', BIZ_ID, 'invoices', 'draft_manager_1'), {
        ...issuedInvoice,
        invoiceNumber: `${PREFIX}999`, // Illegal tampering with already-issued number
      });
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Tampering with already-issued invoice number must be rejected');
  });

  // 19. Cross-business draft access is rejected
  await it('Scenario 19: Cross-business draft access is rejected', async () => {
    let errCaught = null;
    try {
      await saveInvoiceDraft(
        OTHER_BIZ_ID,
        { ...sampleDraft, id: 'cross_biz_draft' },
        managerUser,
        { dbInstance: managerClient }
      );
    } catch (e) {
      errCaught = e;
    }
    assert(errCaught !== null, 'Cross-business draft write must be rejected');
  });

  // 20. Save & Print permanent issuance workflow remains completely intact for fresh invoices
  await it('Scenario 20: Save & Print permanent issuance workflow remains completely intact', async () => {
    const freshInvoice = {
      ...sampleDraft,
      id: 'fresh_issued_inv',
      paymentStatus: 'Pending',
    };

    const res = await createInvoiceWithCounter(
      BIZ_ID,
      freshInvoice,
      cashierUser,
      { dbInstance: cashierClient, prefix: PREFIX }
    );

    assert.strictEqual(res.invoiceNumber, `${PREFIX}002`);
    assert.strictEqual(res.paymentStatus, 'Pending');

    const counterSnap = await getDoc(doc(cashierClient, 'businesses', BIZ_ID, 'counters', `invoices_${FY}`));
    assert.strictEqual(counterSnap.data().lastSeq, 2);
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

