import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, runTransaction } from 'firebase/firestore';
import { sanitizeInvoiceForFirestore } from '../src/firebase/services/invoiceService.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house';
const BIZ_ID = 'tps-battery-house';

let passed = 0;
let failed = 0;

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

async function runEmulatorTestSuite() {
  console.log('================================================================');
  console.log('LIVE FIRESTORE EMULATOR TEST SUITE — TPS BATTERY HOUSE');
  console.log(`Target: http://${EMULATOR_HOST}:${EMULATOR_PORT} | Project: ${PROJECT_ID}`);
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

  await testEnv.clearFirestore();

  try {
    // -------------------------------------------------------------
    // SEEDING TEST FIXTURES (Bypassing rules using admin context)
    // -------------------------------------------------------------
    console.log('--- Step 1: Seeding Test Database Fixtures ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Business metadata
      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERYS HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      // Staff Members
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_1'), {
        uid: 'admin_1',
        email: 'admin@tps.com',
        displayName: 'Store Administrator',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'system',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'manager_1'), {
        uid: 'manager_1',
        email: 'manager@tps.com',
        displayName: 'Store Manager',
        role: 'manager',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'admin_1',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'cashier_1'), {
        uid: 'cashier_1',
        email: 'cashier@tps.com',
        displayName: 'Counter Cashier',
        role: 'cashier',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'admin_1',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'disabled_staff'), {
        uid: 'disabled_staff',
        email: 'disabled@tps.com',
        displayName: 'Ex Staff',
        role: 'cashier',
        status: 'disabled',
        createdAt: new Date(),
        createdBy: 'admin_1',
      });

      // Invoices
      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), {
        id: 'inv_draft',
        invoiceNumber: 'TPS/2026-27/001',
        invoiceDate: '2026-11-03',
        dueDate: '2026-11-03',
        paymentStatus: 'Draft',
        paymentMode: 'Cash',
        customer: { name: 'Customer Draft' },
        items: [{ id: 'item-1', name: 'Battery', qty: 1 }],
        netPayable: 10000,
        createdAt: '2026-11-03T10:00:00.000Z',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_pending'), {
        id: 'inv_pending',
        invoiceNumber: 'TPS/2026-27/002',
        invoiceDate: '2026-11-03',
        dueDate: '2026-11-03',
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        customer: { name: 'Customer Pending' },
        items: [{ id: 'item-2', name: 'Inverter', qty: 1 }],
        netPayable: 20000,
        createdAt: '2026-11-03T10:00:00.000Z',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), {
        id: 'inv_paid',
        invoiceNumber: 'TPS/2026-27/003',
        invoiceDate: '2026-11-03',
        dueDate: '2026-11-03',
        paymentStatus: 'Paid',
        paymentMode: 'Bank Transfer',
        customer: { name: 'Customer Paid' },
        items: [{ id: 'item-3', name: 'Solar Module', qty: 1 }],
        netPayable: 30000,
        createdAt: '2026-11-03T10:00:00.000Z',
      });

      await setDoc(doc(db, 'businesses', BIZ_ID, 'invoices', 'inv_cancelled'), {
        id: 'inv_cancelled',
        invoiceNumber: 'TPS/2026-27/004',
        invoiceDate: '2026-11-03',
        dueDate: '2026-11-03',
        paymentStatus: 'Cancelled',
        paymentMode: 'Cash',
        customer: { name: 'Customer Cancelled' },
        items: [{ id: 'item-4', name: 'Service Call', qty: 1 }],
        netPayable: 5000,
        createdAt: '2026-11-03T10:00:00.000Z',
      });

      // Initialized counter for FY 2026-27
      await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27'), {
        lastSeq: 49,
        prefix: 'TPS/2026-27/',
      });

      // Another business for cross-tenant isolation test
      await setDoc(doc(db, 'businesses', 'other-business', 'members', 'other_admin'), {
        uid: 'other_admin',
        email: 'other@biz.com',
        displayName: 'Other Business Admin',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: 'system',
      });

      console.log('✓ Database seeded successfully.\n');
    });

    // Client Contexts
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const adminDb = testEnv.authenticatedContext('admin_1').firestore();
    const managerDb = testEnv.authenticatedContext('manager_1').firestore();
    const cashierDb = testEnv.authenticatedContext('cashier_1').firestore();
    const disabledDb = testEnv.authenticatedContext('disabled_staff').firestore();
    const unapprovedDb = testEnv.authenticatedContext('stranger_google_uid').firestore();
    const otherBizDb = testEnv.authenticatedContext('other_admin').firestore();

    // -------------------------------------------------------------
    // SCENARIO 1: Unauthenticated Visitor
    // -------------------------------------------------------------
    console.log('--- SCENARIO 1: Unauthenticated Visitor ---');
    await checkPass(assertFails(getDoc(doc(unauthDb, 'businesses', BIZ_ID, 'members', 'admin_1'))), 'Unauthenticated user CANNOT read members');
    await checkPass(assertFails(getDoc(doc(unauthDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'))), 'Unauthenticated user CANNOT read invoices');
    await checkPass(assertFails(setDoc(doc(unauthDb, 'businesses', BIZ_ID, 'invoices', 'hack_inv'), { netPayable: 1 })), 'Unauthenticated user CANNOT create invoice');

    // -------------------------------------------------------------
    // SCENARIO 2: Unapproved Google User & Disabled Members
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Unapproved User & Disabled Staff ---');
    // Unapproved user checking own doc returns null (no doc), but is allowed getDoc
    await checkPass(assertSucceeds(getDoc(doc(unapprovedDb, 'businesses', BIZ_ID, 'members', 'stranger_google_uid'))), 'Unapproved user CAN query own member doc (for status verification)');
    await checkPass(assertFails(getDoc(doc(unapprovedDb, 'businesses', BIZ_ID, 'members', 'admin_1'))), 'Unapproved user CANNOT read another member doc');
    await checkPass(assertFails(getDoc(doc(unapprovedDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'))), 'Unapproved user CANNOT read business invoices');

    // Disabled staff member
    await checkPass(assertFails(getDoc(doc(disabledDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'))), 'Disabled staff CANNOT read invoices');
    await checkPass(assertFails(setDoc(doc(disabledDb, 'businesses', BIZ_ID, 'invoices', 'new_inv'), { netPayable: 1 })), 'Disabled staff CANNOT write invoices');

    // -------------------------------------------------------------
    // SCENARIO 3: Admin Self-Membership & Staff Management
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Admin Self-Lookup & Staff Management ---');
    await checkPass(assertSucceeds(getDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin_1'))), 'Admin CAN read own membership document');
    await checkPass(assertSucceeds(getDocs(collection(adminDb, 'businesses', BIZ_ID, 'members'))), 'Admin CAN list all staff members');
    
    // Admin creates new staff member
    await checkPass(assertSucceeds(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'new_staff_01'), {
      uid: 'new_staff_01',
      email: 'newbie@tps.com',
      displayName: 'New Staff',
      role: 'cashier',
      status: 'active',
      createdAt: new Date(),
      createdBy: 'admin_1',
    })), 'Admin CAN register new staff member');

    // Admin self-promotion prevention: Cannot create doc with uid == auth.uid
    await checkPass(assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin_1'), {
      uid: 'admin_1',
      email: 'admin@tps.com',
      displayName: 'Admin Tamper',
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
      createdBy: 'admin_1',
    })), 'Admin CANNOT self-create or self-escalate membership (uid != auth.uid enforced)');

    // Admin self-deletion prevention
    await checkPass(assertFails(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin_1'))), 'Admin CANNOT delete own membership record (lockout protection)');
    await checkPass(assertSucceeds(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'new_staff_01'))), 'Admin CAN delete other staff membership');

    // Non-admin listing staff protection
    await checkPass(assertFails(getDocs(collection(cashierDb, 'businesses', BIZ_ID, 'members'))), 'Cashier CANNOT list staff members (PII protection)');
    await checkPass(assertFails(getDocs(collection(managerDb, 'businesses', BIZ_ID, 'members'))), 'Manager CANNOT list staff members (PII protection)');

    // -------------------------------------------------------------
    // SCENARIO 4: Cashier Invoice Permissions
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Cashier Invoice Permissions ---');
    await checkPass(assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_draft'))), 'Cashier CAN read invoices');

    // Cashier creating valid invoice atomically with counter update
    await checkPass(assertSucceeds(runTransaction(cashierDb, async (txn) => {
      const counterRef = doc(cashierDb, 'businesses', BIZ_ID, 'counters', 'invoices_2026-27');
      await txn.get(counterRef);
      txn.update(counterRef, {
        lastSeq: 50,
        prefix: 'TPS/2026-27/',
        lastInvoiceId: 'inv_cashier_01',
        lastInvoiceNumber: 'TPS/2026-27/050',
        updatedAt: new Date().toISOString(),
        updatedBy: 'cashier_1',
      });
      txn.set(doc(cashierDb, 'businesses', BIZ_ID, 'invoice_numbers', 'TPS_2026-27_050'), {
        invoiceId: 'inv_cashier_01',
        invoiceNumber: 'TPS/2026-27/050',
        financialYear: '2026-27',
        createdAt: new Date().toISOString(),
        createdBy: 'cashier_1',
      });
      const validPayload = sanitizeInvoiceForFirestore({
        id: 'inv_cashier_01',
        invoiceNumber: 'TPS/2026-27/050',
        financialYear: '2026-27',
        invoiceDate: '2026-11-03',
        dueDate: '2026-11-03',
        paymentStatus: 'Paid',
        paymentMode: 'Cash',
        customer: { name: 'Counter Customer' },
        items: [{ id: 'item-c1', name: 'Tall Tubular Battery', qty: 1, sellingPrice: 14800, gstRate: 28, isTaxInclusive: true }],
        netPayable: 14800,
        createdAt: new Date().toISOString(),
      }, { uid: 'cashier_1' });
      txn.set(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_cashier_01'), validPayload);
    })), 'Cashier CAN create valid customer invoice');

    // Cashier CANNOT update or delete
    await checkPass(assertFails(updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), {
      notes: 'Cashier trying to update draft',
    })), 'Cashier CANNOT update draft invoice');

    await checkPass(assertFails(updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_pending'), {
      notes: 'Cashier trying to update pending',
    })), 'Cashier CANNOT update pending invoice');

    await checkPass(assertFails(updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), {
      notes: 'Cashier trying to update paid',
    })), 'Cashier CANNOT update paid invoice');

    await checkPass(assertFails(deleteDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_cashier_01'))), 'Cashier CANNOT delete invoice');

    // -------------------------------------------------------------
    // SCENARIO 5: Manager Invoice Permissions & Protections
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Manager Invoice Permissions & Finalized Invoice Protections ---');
    await checkPass(assertSucceeds(getDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_draft'))), 'Manager CAN read invoices');

    // Manager updating Draft invoice
    await checkPass(assertSucceeds(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_draft'), {
      notes: 'Manager updated notes on draft',
    })), 'Manager CAN update draft invoice');

    // Manager updating Pending invoice without changing totals
    await checkPass(assertSucceeds(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_pending'), {
      notes: 'Manager updated remarks',
    })), 'Manager CAN update pending invoice meta');

    // Manager finalizing Pending -> Paid WITH identical financial details
    await checkPass(assertSucceeds(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_pending'), {
      paymentStatus: 'Paid',
      netPayable: 20000,
      items: [{ id: 'item-2', name: 'Inverter', qty: 1 }],
    })), 'Manager CAN finalize Pending to Paid with exact matching financial details');

    // Reset inv_pending back for tamper test
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'invoices', 'inv_pending'), {
        paymentStatus: 'Pending',
      });
    });

    // Manager finalizing Pending -> Paid WHILE ALTERING netPayable (Tampering) -> BLOCKED
    await checkPass(assertFails(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_pending'), {
      paymentStatus: 'Paid',
      netPayable: 15000, // Reduced from 20000
      items: [{ id: 'item-2', name: 'Inverter', qty: 1 }],
    })), 'Manager CANNOT alter netPayable when finalizing an issued (Pending) invoice');

    // Manager finalizing Pending -> Paid WHILE ALTERING line items (Tampering) -> BLOCKED
    await checkPass(assertFails(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_pending'), {
      paymentStatus: 'Paid',
      netPayable: 20000,
      items: [{ id: 'item-2', name: 'Cheaper Item', qty: 1 }],
    })), 'Manager CANNOT alter line items when finalizing an issued (Pending) invoice');

    // Manager CANNOT edit Paid invoice
    await checkPass(assertFails(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), {
      notes: 'Manager trying to alter paid invoice',
    })), 'Manager CANNOT modify finalized/Paid invoice (Locked)');

    // Manager CANNOT edit Cancelled invoice
    await checkPass(assertFails(updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_cancelled'), {
      notes: 'Manager trying to alter cancelled invoice',
    })), 'Manager CANNOT modify Cancelled invoice (Locked)');

    // Manager CANNOT delete invoices
    await checkPass(assertFails(deleteDoc(doc(managerDb, 'businesses', BIZ_ID, 'invoices', 'inv_draft'))), 'Manager CANNOT delete invoices');

    // -------------------------------------------------------------
    // SCENARIO 6: Administrator Authorized Corrections
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Administrator Authorized Corrections ---');
    // Admin CAN update Paid invoice
    await checkPass(assertSucceeds(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), {
      notes: 'Admin corrected notes on paid invoice',
    })), 'Admin CAN update Paid invoice (authorized administrative correction)');

    // Admin CAN update Cancelled invoice
    await checkPass(assertSucceeds(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_cancelled'), {
      notes: 'Admin updated cancelled reason',
    })), 'Admin CAN update Cancelled invoice (authorized correction)');

    // Admin CAN delete invoice
    await checkPass(assertSucceeds(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_cancelled'))), 'Admin CAN permanently delete invoice');

    // Immutable field tampering rejected even for Admin
    await checkPass(assertFails(updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'), {
      invoiceNumber: 'TAMPERED/NUM/001',
    })), 'Admin CANNOT change sequential invoiceNumber (Immutable)');

    // -------------------------------------------------------------
    // SCENARIO 7: Cross-Business Isolation
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Cross-Business Tenant Isolation ---');
    await checkPass(assertFails(getDoc(doc(otherBizDb, 'businesses', BIZ_ID, 'invoices', 'inv_paid'))), 'User from other-business CANNOT read TPS Battery House invoices');
    await checkPass(assertFails(setDoc(doc(otherBizDb, 'businesses', BIZ_ID, 'invoices', 'bad_inv'), { netPayable: 1 })), 'User from other-business CANNOT write TPS Battery House invoices');
    await checkPass(assertFails(getDoc(doc(adminDb, 'businesses', 'other-business', 'members', 'other_admin'))), 'TPS Admin CANNOT read other-business member data');

    // -------------------------------------------------------------
    // SCENARIO 8: Schema & Field Validations
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Schema & Field Validation Enforcement ---');
    // Disallowed extra field
    await checkPass(assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_bad_1'), {
      id: 'inv_bad_1',
      invoiceNumber: 'TPS/2026-27/099',
      invoiceDate: '2026-11-03',
      dueDate: '2026-11-03',
      paymentStatus: 'Draft',
      paymentMode: 'Cash',
      customer: { name: 'Customer' },
      items: [{ name: 'Item', qty: 1 }],
      netPayable: 100,
      maliciousField: 'exploit',
    })), 'Arbitrary unwhitelisted fields are rejected');

    // Invalid payment status
    await checkPass(assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_bad_2'), {
      id: 'inv_bad_2',
      invoiceNumber: 'TPS/2026-27/098',
      invoiceDate: '2026-11-03',
      dueDate: '2026-11-03',
      paymentStatus: 'UNKNOWN_STATUS',
      paymentMode: 'Cash',
      customer: { name: 'Customer' },
      items: [{ name: 'Item', qty: 1 }],
      netPayable: 100,
    })), 'Invalid paymentStatus rejected');

    // Negative netPayable
    await checkPass(assertFails(setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_bad_3'), {
      id: 'inv_bad_3',
      invoiceNumber: 'TPS/2026-27/097',
      invoiceDate: '2026-11-03',
      dueDate: '2026-11-03',
      paymentStatus: 'Draft',
      paymentMode: 'Cash',
      customer: { name: 'Customer' },
      items: [{ name: 'Item', qty: 1 }],
      netPayable: -500,
    })), 'Negative netPayable rejected');

    console.log('\n================================================================');
    console.log(`EMULATOR TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } finally {
    await testEnv.cleanup();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runEmulatorTestSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});

