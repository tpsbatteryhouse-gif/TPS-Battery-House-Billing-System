/**
 * TPS Battery House — Phase 4: Staff Management & Administration Integration Suite
 *
 * Comprehensive adversarial and security verification for:
 * 1. Admin staff listing vs Manager/Cashier/Unauth denial
 * 2. Pending registration creation by newly authenticated Google users
 * 3. Anti-self-approval and anti-pre-approval defences
 * 4. Admin approval with role assignment (Cashier, Manager, Admin)
 * 5. Admin rejection with reason logging
 * 6. Self-escalation and self-promotion prevention
 * 7. Last-admin protection (demotion and disabling safeguards)
 * 8. Account deactivation: immediate read and write denial
 * 9. Account reactivation: immediate access restoration
 * 10. Cross-business tenant isolation
 * 11. Tamper-evident, immutable audit trail (update/delete blocked)
 * 12. Historical invoice integrity and preservation
 */

import fs from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

import {
  countActiveAdmins,
  approveStaffMember,
  rejectStaffRegistration,
  updateStaffRole,
  updateStaffStatus,
  registerStaffMemberDirectly,
  listStaffAuditLogs,
} from '../src/firebase/services/staffService.js';

import { ROLES, ACCOUNT_STATUS } from '../src/utils/permissions.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = `tps-battery-staff-${Date.now()}`;
const BIZ_ID = 'tps-battery-house';
const OTHER_BIZ_ID = 'other-solar-house';

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

async function runPhase4StaffSuite() {
  console.log('================================================================');
  console.log('PHASE 4: STAFF MANAGEMENT & ADMINISTRATION INTEGRATION SUITE');
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

  // 1. Seed Test Fixtures with Security Rules Disabled
  console.log('--- Step 1: Seeding Test Database Fixtures ---');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // Primary Business Root
    await setDoc(doc(adminDb, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERYS HOUSE',
      stateCode: '32',
      active: true,
      createdAt: new Date().toISOString(),
    });

    // Secondary Business Tenant
    await setDoc(doc(adminDb, 'businesses', OTHER_BIZ_ID), {
      businessName: 'OTHER SOLAR HOUSE',
      stateCode: '32',
      active: true,
      createdAt: new Date().toISOString(),
    });

    // 1. Primary Store Administrator: Amal Raj (Owner)
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin_amal'), {
      uid: 'admin_amal',
      email: 'amal@tpsbattery.com',
      displayName: 'Amal Raj (Owner)',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'system_init',
    });

    // 2. Store Manager: Suresh Kumar
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'mgr_suresh'), {
      uid: 'mgr_suresh',
      email: 'suresh@tpsbattery.com',
      displayName: 'Suresh Kumar (Manager)',
      role: 'manager',
      status: 'active',
      createdAt: '2026-01-02T00:00:00.000Z',
      createdBy: 'admin_amal',
    });

    // 3. Billing Cashier: Rahul Krishnan
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'cashier_rahul'), {
      uid: 'cashier_rahul',
      email: 'rahul@tpsbattery.com',
      displayName: 'Rahul Krishnan (Cashier)',
      role: 'cashier',
      status: 'active',
      createdAt: '2026-01-03T00:00:00.000Z',
      createdBy: 'admin_amal',
    });

    // 4. Inactive Staff Member: Deepak (Pre-disabled)
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'disabled_deepak'), {
      uid: 'disabled_deepak',
      email: 'deepak@tpsbattery.com',
      displayName: 'Deepak V. (Terminated)',
      role: 'cashier',
      status: 'disabled',
      createdAt: '2026-01-04T00:00:00.000Z',
      createdBy: 'admin_amal',
    });

    // 5. Member of Foreign Tenant
    await setDoc(doc(adminDb, 'businesses', OTHER_BIZ_ID, 'members', 'foreign_user'), {
      uid: 'foreign_user',
      email: 'foreign@othersolar.com',
      displayName: 'Foreign Tenant Admin',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'system_init',
    });

    // Test Catalog Product for read/write verification
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'prod_exide_150'), {
      id: 'prod_exide_150',
      sku: 'BAT-EX-150',
      name: 'Exide Inva Tubular IT500 150Ah',
      category: 'battery',
      specs: { capacity: '150Ah', voltage: '12V' },
      unit: 'Nos',
      hsn: '85072000',
      sellingPrice: 14500,
      gstRate: 28,
      isTaxInclusive: true,
      status: 'active',
    });

    // Baseline historical invoice created by Rahul Krishnan
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_historical_001'), {
      id: 'inv_historical_001',
      invoiceNumber: 'TPS/2026-27/0001',
      invoiceDate: '2026-05-10',
      dueDate: '2026-05-10',
      paymentStatus: 'Paid',
      paymentMode: 'Cash',
      customer: { name: 'Praveen K.', stateCode: '32' },
      items: [
        {
          id: 'item_1',
          name: 'Exide Inva Tubular IT500',
          hsn: '85072000',
          qty: 1,
          rate: 14500,
          amount: 14500,
          gstRate: 28,
          taxableAmount: 11328.13,
          cgstAmount: 1585.94,
          sgstAmount: 1585.94,
          isTaxInclusive: true,
        },
      ],
      netPayable: 14500,
      createdBy: 'cashier_rahul',
      createdAt: '2026-05-10T10:00:00.000Z',
    });
  });
  console.log('✓ Database fixtures seeded successfully.\n');

  // Authenticated Contexts
  const adminContext = testEnv.authenticatedContext('admin_amal', { email: 'amal@tpsbattery.com' });
  const managerContext = testEnv.authenticatedContext('mgr_suresh', { email: 'suresh@tpsbattery.com' });
  const cashierContext = testEnv.authenticatedContext('cashier_rahul', { email: 'rahul@tpsbattery.com' });
  const disabledContext = testEnv.authenticatedContext('disabled_deepak', { email: 'deepak@tpsbattery.com' });
  const foreignContext = testEnv.authenticatedContext('foreign_user', { email: 'foreign@othersolar.com' });
  const unauthContext = testEnv.unauthenticatedContext();
  const newStaffContext = testEnv.authenticatedContext('new_google_user', { email: 'newbie@gmail.com' });

  const adminDb = adminContext.firestore();
  const managerDb = managerContext.firestore();
  const cashierDb = cashierContext.firestore();
  const disabledDb = disabledContext.firestore();
  const foreignDb = foreignContext.firestore();
  const unauthDb = unauthContext.firestore();
  const newStaffDb = newStaffContext.firestore();

  // ------------------------------------------------------------------
  // SECTION 1: Staff Directory & Membership Access Control
  // ------------------------------------------------------------------
  console.log('--- SECTION 1: Staff Directory Access Control ---');

  // 1. Admin staff listing
  try {
    const membersSnap = await assertSucceeds(getDocs(collection(adminDb, 'businesses', BIZ_ID, 'members')));
    testAssert(membersSnap.size >= 4, 'Administrator can list all registered staff members');
  } catch (e) {
    testAssert(false, `Admin listing failed: ${e.message}`);
  }

  // 2. Manager staff listing denied
  try {
    await assertFails(getDocs(collection(managerDb, 'businesses', BIZ_ID, 'members')));
    testAssert(true, 'Store Manager listing staff directory is strictly DENIED');
  } catch (e) {
    testAssert(false, `Manager listing check failed: ${e.message}`);
  }

  // 3. Cashier staff listing denied
  try {
    await assertFails(getDocs(collection(cashierDb, 'businesses', BIZ_ID, 'members')));
    testAssert(true, 'Billing Cashier listing staff directory is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cashier listing check failed: ${e.message}`);
  }

  // 4. Unauthenticated staff listing denied
  try {
    await assertFails(getDocs(collection(unauthDb, 'businesses', BIZ_ID, 'members')));
    testAssert(true, 'Unauthenticated visitor listing staff is strictly DENIED');
  } catch (e) {
    testAssert(false, `Unauth listing check failed: ${e.message}`);
  }

  // 5. Staff reading their own document is allowed
  try {
    const ownDoc = await assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'members', 'cashier_rahul')));
    testAssert(ownDoc.exists() && ownDoc.data().role === 'cashier', 'Cashier reading own membership profile is ALLOWED');
  } catch (e) {
    testAssert(false, `Own doc read failed: ${e.message}`);
  }

  // 6. Cashier reading another staff document is denied
  try {
    await assertFails(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'members', 'mgr_suresh')));
    testAssert(true, 'Cashier reading another staff member profile is strictly DENIED');
  } catch (e) {
    testAssert(false, `Other doc read check failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 2: Pending Access Request Submission
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 2: Pending Access Request Submission ---');

  // 7. Newly authenticated user submitting own request with status: 'pending'
  try {
    await assertSucceeds(
      setDoc(doc(newStaffDb, 'businesses', BIZ_ID, 'pending_registrations', 'new_google_user'), {
        uid: 'new_google_user',
        email: 'newbie@gmail.com',
        displayName: 'New Applicant',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      })
    );
    testAssert(true, 'New user submitting valid pending access request is ALLOWED');
  } catch (e) {
    testAssert(false, `Pending submission failed: ${e.message}`);
  }

  // 8. User attempting to submit with status: 'approved' (pre-approval bypass)
  try {
    const hackerContext = testEnv.authenticatedContext('hacker_user', { email: 'hacker@evil.com' });
    await assertFails(
      setDoc(doc(hackerContext.firestore(), 'businesses', BIZ_ID, 'pending_registrations', 'hacker_user'), {
        uid: 'hacker_user',
        email: 'hacker@evil.com',
        displayName: 'Sneaky Hacker',
        status: 'approved', // FORBIDDEN!
        requestedAt: new Date().toISOString(),
      })
    );
    testAssert(true, 'User submitting pre-approved status is strictly DENIED');
  } catch (e) {
    testAssert(false, `Pre-approval check failed: ${e.message}`);
  }

  // 9. User attempting to forge request for another UID
  try {
    await assertFails(
      setDoc(doc(newStaffDb, 'businesses', BIZ_ID, 'pending_registrations', 'forged_uid_123'), {
        uid: 'forged_uid_123',
        email: 'victim@tps.com',
        displayName: 'Victim',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      })
    );
    testAssert(true, 'User forging access request for another UID is strictly DENIED');
  } catch (e) {
    testAssert(false, `Forged UID check failed: ${e.message}`);
  }

  // 10. User reading their own pending request
  try {
    const reqSnap = await assertSucceeds(
      getDoc(doc(newStaffDb, 'businesses', BIZ_ID, 'pending_registrations', 'new_google_user'))
    );
    testAssert(reqSnap.exists() && reqSnap.data().status === 'pending', 'User reading their own pending registration is ALLOWED');
  } catch (e) {
    testAssert(false, `Own pending read failed: ${e.message}`);
  }

  // 11. User listing all pending registrations is denied
  try {
    await assertFails(getDocs(collection(newStaffDb, 'businesses', BIZ_ID, 'pending_registrations')));
    testAssert(true, 'Non-admin listing pending registrations is strictly DENIED');
  } catch (e) {
    testAssert(false, `Pending listing check failed: ${e.message}`);
  }

  // 12. Admin listing pending registrations is allowed
  try {
    const pendingSnap = await assertSucceeds(getDocs(collection(adminDb, 'businesses', BIZ_ID, 'pending_registrations')));
    testAssert(pendingSnap.size >= 1, 'Administrator listing pending access requests is ALLOWED');
  } catch (e) {
    testAssert(false, `Admin pending listing failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 3: Admin Approval Workflow & Role Assignment
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 3: Staff Approval Workflow & Role Assignment ---');

  // 13. Admin approves pending user as Store Manager via service method
  try {
    const approvedMember = await approveStaffMember(
      BIZ_ID,
      'new_google_user',
      ROLES.MANAGER,
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );
    testAssert(
      approvedMember.role === ROLES.MANAGER && approvedMember.status === ACCOUNT_STATUS.ACTIVE,
      'Administrator successfully approved pending user and assigned Manager role'
    );
  } catch (e) {
    testAssert(false, `Staff approval failed: ${e.message}`);
  }

  // 14. Verify pending registration document marked 'approved'
  try {
    const updatedReq = await getDoc(doc(adminDb, 'businesses', BIZ_ID, 'pending_registrations', 'new_google_user'));
    testAssert(
      updatedReq.data().status === 'approved' && updatedReq.data().assignedRole === ROLES.MANAGER,
      'Pending registration document updated to approved with assignedRole: manager'
    );
  } catch (e) {
    testAssert(false, `Pending doc verification failed: ${e.message}`);
  }

  // 15. Verify newly approved Manager can now read products and invoices
  try {
    const prodSnap = await assertSucceeds(
      getDoc(doc(newStaffDb, 'businesses', BIZ_ID, 'products', 'prod_exide_150'))
    );
    testAssert(prodSnap.exists(), 'Newly approved Manager can immediately access product catalog');
  } catch (e) {
    testAssert(false, `New manager read failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 4: Admin Staff Rejection
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 4: Staff Rejection Workflow ---');

  // Seed another pending applicant: rogue_user
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'pending_registrations', 'rogue_user'), {
      uid: 'rogue_user',
      email: 'rogue@suspicious.com',
      displayName: 'Unknown Applicant',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
  });

  // 16. Admin rejects rogue_user with reason
  try {
    await rejectStaffRegistration(
      BIZ_ID,
      'rogue_user',
      'Identity verification failed. Not an employee.',
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );

    const rejectedDoc = await getDoc(doc(adminDb, 'businesses', BIZ_ID, 'pending_registrations', 'rogue_user'));
    testAssert(
      rejectedDoc.data().status === 'rejected' &&
      rejectedDoc.data().rejectionReason === 'Identity verification failed. Not an employee.',
      'Administrator successfully rejected access request with recorded reason'
    );
  } catch (e) {
    testAssert(false, `Staff rejection failed: ${e.message}`);
  }

  // 17. Verify rejected user cannot access products
  try {
    const rogueContext = testEnv.authenticatedContext('rogue_user', { email: 'rogue@suspicious.com' });
    await assertFails(getDoc(doc(rogueContext.firestore(), 'businesses', BIZ_ID, 'products', 'prod_exide_150')));
    testAssert(true, 'Rejected applicant is strictly DENIED from reading product catalog');
  } catch (e) {
    testAssert(false, `Rejected user check failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 5: Anti-Self-Approval & Privilege Escalation Defenses
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 5: Anti-Self-Approval & Anti-Self-Promotion Defenses ---');

  // 18. Non-admin attempting to create own member doc directly
  try {
    const unapprovedContext = testEnv.authenticatedContext('unapproved_uid', { email: 'unapproved@test.com' });
    await assertFails(
      setDoc(doc(unapprovedContext.firestore(), 'businesses', BIZ_ID, 'members', 'unapproved_uid'), {
        uid: 'unapproved_uid',
        email: 'unapproved@test.com',
        displayName: 'Self Promoter',
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'unapproved_uid',
      })
    );
    testAssert(true, 'Self-provisioning membership document is strictly DENIED');
  } catch (e) {
    testAssert(false, `Self provision check failed: ${e.message}`);
  }

  // 19. Cashier attempting to update own role to 'admin' (privilege self-escalation)
  try {
    await assertFails(
      updateDoc(doc(cashierDb, 'businesses', BIZ_ID, 'members', 'cashier_rahul'), {
        role: 'admin',
      })
    );
    testAssert(true, 'Cashier attempting to self-escalate role to Administrator is strictly DENIED');
  } catch (e) {
    testAssert(false, `Self escalation check failed: ${e.message}`);
  }

  // 20. Store Manager attempting to update other staff role (admin privilege bypass)
  try {
    await assertFails(
      updateDoc(doc(managerDb, 'businesses', BIZ_ID, 'members', 'cashier_rahul'), {
        role: 'manager',
      })
    );
    testAssert(true, 'Store Manager attempting to modify another staff member is strictly DENIED');
  } catch (e) {
    testAssert(false, `Manager staff modify check failed: ${e.message}`);
  }

  // 21. Admin attempting to modify own member doc (rules anti-self-lockout)
  try {
    await assertFails(
      updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin_amal'), {
        displayName: 'Hacked Name',
      })
    );
    testAssert(true, 'Administrator modifying own membership doc is DENIED (enforcing separate admin check)');
  } catch (e) {
    testAssert(false, `Admin self modify check failed: ${e.message}`);
  }

  // 22. Admin attempting to delete own member doc
  try {
    await assertFails(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'admin_amal')));
    testAssert(true, 'Administrator deleting own membership doc is strictly DENIED');
  } catch (e) {
    testAssert(false, `Admin self delete check failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 6: Role Management & Last-Admin Protection
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 6: Role Management & Last-Admin Protection ---');

  // 23. Admin updates Cashier to Store Manager
  try {
    const updated = await updateStaffRole(
      BIZ_ID,
      'cashier_rahul',
      ROLES.MANAGER,
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );
    testAssert(updated.role === ROLES.MANAGER, 'Administrator successfully promoted Cashier to Store Manager');
  } catch (e) {
    testAssert(false, `Role update failed: ${e.message}`);
  }

  // 24. Verify active admin count
  const activeAdminsInitial = await countActiveAdmins(BIZ_ID, adminDb);
  testAssert(activeAdminsInitial === 1, `Currently exactly 1 active Administrator (Amal Raj)`);

  // 25. Attempting to demote Amal Raj (the only active Admin)
  try {
    let threw = false;
    try {
      await updateStaffRole(
        BIZ_ID,
        'admin_amal',
        ROLES.CASHIER,
        { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
        adminDb
      );
    } catch (err) {
      threw = true;
      testAssert(
        err.message.includes('cannot modify their own role') || err.message.includes('last remaining active Administrator'),
        `Self-demotion of only administrator blocked with message: "${err.message}"`
      );
    }
    testAssert(threw, 'Demoting the sole active Administrator was actively blocked');
  } catch (e) {
    testAssert(false, `Last-admin demotion check failed: ${e.message}`);
  }

  // 26. Admin promotes Suresh to Admin, creating a second active Admin
  try {
    await updateStaffRole(
      BIZ_ID,
      'mgr_suresh',
      ROLES.ADMIN,
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );
    const countAfterPromo = await countActiveAdmins(BIZ_ID, adminDb);
    testAssert(countAfterPromo === 2, 'Successfully promoted second administrator (active admins = 2)');
  } catch (e) {
    testAssert(false, `Second admin promotion failed: ${e.message}`);
  }

  // 27. Now that 2 admins exist, Amal can demote Suresh back to Manager safely
  try {
    await updateStaffRole(
      BIZ_ID,
      'mgr_suresh',
      ROLES.MANAGER,
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );
    const countAfterDemote = await countActiveAdmins(BIZ_ID, adminDb);
    testAssert(countAfterDemote === 1, 'Successfully demoted non-sole admin back to Manager');
  } catch (e) {
    testAssert(false, `Safe demotion failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 7: Account Deactivation & Immediate Revocation
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 7: Account Deactivation & Immediate Revocation ---');

  // Currently Rahul is an active Manager. Verify he can read products:
  const rahulCanReadInitial = await assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'products', 'prod_exide_150')));
  testAssert(rahulCanReadInitial.exists(), 'Staff member Rahul can initially access products');

  // 28. Admin deactivates Rahul's account
  try {
    const disabledRahul = await updateStaffStatus(
      BIZ_ID,
      'cashier_rahul',
      ACCOUNT_STATUS.DISABLED,
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );
    testAssert(disabledRahul.status === ACCOUNT_STATUS.DISABLED, 'Administrator successfully deactivated Rahul Krishnan');
  } catch (e) {
    testAssert(false, `Deactivation failed: ${e.message}`);
  }

  // 29. Deactivated staff member IMMEDIATELY denied from reading invoices
  try {
    await assertFails(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_historical_001')));
    testAssert(true, 'Deactivated staff member reading invoice is IMMEDIATELY DENIED');
  } catch (e) {
    testAssert(false, `Deactivated invoice read check failed: ${e.message}`);
  }

  // 30. Deactivated staff member IMMEDIATELY denied from reading products
  try {
    await assertFails(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'products', 'prod_exide_150')));
    testAssert(true, 'Deactivated staff member reading products is IMMEDIATELY DENIED');
  } catch (e) {
    testAssert(false, `Deactivated product read check failed: ${e.message}`);
  }

  // Pre-disabled staff member Deepak reading invoices is strictly DENIED
  try {
    await assertFails(getDoc(doc(disabledDb, 'businesses', BIZ_ID, 'invoices', 'inv_historical_001')));
    testAssert(true, 'Pre-disabled staff member Deepak reading invoices is strictly DENIED');
  } catch (e) {
    testAssert(false, `Pre-disabled read check failed: ${e.message}`);
  }

  // 31. Deactivated staff member IMMEDIATELY denied from creating any invoice
  try {
    await assertFails(
      setDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_illegal_write'), {
        id: 'inv_illegal_write',
        invoiceNumber: 'TPS/2026-27/9999',
        invoiceDate: '2026-05-15',
        dueDate: '2026-05-15',
        paymentStatus: 'Paid',
        paymentMode: 'Cash',
        customer: { name: 'Unauthorized Customer', stateCode: '32' },
        items: [],
        netPayable: 100,
      })
    );
    testAssert(true, 'Deactivated staff member creating an invoice is IMMEDIATELY DENIED');
  } catch (e) {
    testAssert(false, `Deactivated invoice create check failed: ${e.message}`);
  }

  // 32. Attempting to disable the only active Admin is blocked
  try {
    let threw = false;
    try {
      await updateStaffStatus(
        BIZ_ID,
        'admin_amal',
        ACCOUNT_STATUS.DISABLED,
        { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
        adminDb
      );
    } catch (err) {
      threw = true;
      testAssert(
        err.message.includes('cannot disable or change their own account status') ||
        err.message.includes('last remaining active Administrator'),
        `Disabling last administrator blocked with error: "${err.message}"`
      );
    }
    testAssert(threw, 'Disabling the sole active Administrator was actively blocked');
  } catch (e) {
    testAssert(false, `Sole admin disable check failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 8: Staff Reactivation
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 8: Staff Reactivation ---');

  // 33. Admin reactivates Rahul
  try {
    const reactivatedRahul = await updateStaffStatus(
      BIZ_ID,
      'cashier_rahul',
      ACCOUNT_STATUS.ACTIVE,
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );
    testAssert(reactivatedRahul.status === ACCOUNT_STATUS.ACTIVE, 'Administrator successfully reactivated Rahul');
  } catch (e) {
    testAssert(false, `Reactivation failed: ${e.message}`);
  }

  // 34. Verify reactivated staff member can immediately read products and invoices again
  try {
    const restoredDoc = await assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'products', 'prod_exide_150')));
    testAssert(restoredDoc.exists(), 'Reactivated staff member can immediately access catalog again');
  } catch (e) {
    testAssert(false, `Reactivated read check failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 9: Direct Staff Provisioning by Admin
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 9: Direct Staff Provisioning by Admin ---');

  // 35. Admin directly registers a new employee without prior pending request
  try {
    const directMember = await registerStaffMemberDirectly(
      BIZ_ID,
      {
        uid: 'direct_cashier_meera',
        email: 'meera@tpsbattery.com',
        displayName: 'Meera N.',
        role: ROLES.CASHIER,
      },
      { uid: 'admin_amal', email: 'amal@tpsbattery.com' },
      adminDb
    );
    testAssert(directMember.uid === 'direct_cashier_meera', 'Administrator directly provisioned new Cashier Meera');
  } catch (e) {
    testAssert(false, `Direct registration failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 10: Immutable Staff Administrative Audit Trail
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 10: Immutable Staff Audit Trail ---');

  // 36. Admin listing audit logs
  let createdLogId = null;
  try {
    const logs = await listStaffAuditLogs(BIZ_ID, 50, adminDb);
    testAssert(logs.length >= 4, `Administrator successfully retrieved ${logs.length} staff audit log entries`);
    createdLogId = logs[0].id;
  } catch (e) {
    testAssert(false, `Audit log fetch failed: ${e.message}`);
  }

  // 37. Cashier reading audit logs is denied
  try {
    await assertFails(getDocs(collection(cashierDb, 'businesses', BIZ_ID, 'staff_audit_logs')));
    testAssert(true, 'Cashier reading staff audit logs is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cashier audit read check failed: ${e.message}`);
  }

  // 38. Manager reading audit logs is denied
  try {
    await assertFails(getDocs(collection(managerDb, 'businesses', BIZ_ID, 'staff_audit_logs')));
    testAssert(true, 'Store Manager reading staff audit logs is strictly DENIED');
  } catch (e) {
    testAssert(false, `Manager audit read check failed: ${e.message}`);
  }

  // 39. Immutability: Attempting to update an audit log doc (even by Admin) is denied
  try {
    await assertFails(
      updateDoc(doc(adminDb, 'businesses', BIZ_ID, 'staff_audit_logs', createdLogId), {
        notes: 'Tampered notes',
      })
    );
    testAssert(true, 'Attempting to update an audit log record is strictly DENIED (Immutable)');
  } catch (e) {
    testAssert(false, `Audit update check failed: ${e.message}`);
  }

  // 40. Immutability: Attempting to delete an audit log doc (even by Admin) is denied
  try {
    await assertFails(deleteDoc(doc(adminDb, 'businesses', BIZ_ID, 'staff_audit_logs', createdLogId)));
    testAssert(true, 'Attempting to delete an audit log record is strictly DENIED (Un-deletable)');
  } catch (e) {
    testAssert(false, `Audit delete check failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 11: Cross-Business Tenant Isolation
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 11: Cross-Business Tenant Isolation ---');

  // 41. User from OTHER_BIZ_ID reading TPS Battery House members is denied
  try {
    await assertFails(getDocs(collection(foreignDb, 'businesses', BIZ_ID, 'members')));
    testAssert(true, 'Foreign business user reading TPS Battery House members is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cross-business member read check failed: ${e.message}`);
  }

  // 42. User from OTHER_BIZ_ID reading TPS Battery House pending requests is denied
  try {
    await assertFails(getDocs(collection(foreignDb, 'businesses', BIZ_ID, 'pending_registrations')));
    testAssert(true, 'Foreign business user reading TPS pending registrations is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cross-business pending read check failed: ${e.message}`);
  }

  // 43. User from OTHER_BIZ_ID reading TPS Battery House audit logs is denied
  try {
    await assertFails(getDocs(collection(foreignDb, 'businesses', BIZ_ID, 'staff_audit_logs')));
    testAssert(true, 'Foreign business user reading TPS staff audit logs is strictly DENIED');
  } catch (e) {
    testAssert(false, `Cross-business audit read check failed: ${e.message}`);
  }

  // ------------------------------------------------------------------
  // SECTION 12: Historical Invoice Preservation
  // ------------------------------------------------------------------
  console.log('\n--- SECTION 12: Historical Invoice Preservation ---');

  // 44. Disable Deepak (terminated employee) and verify his historical invoice still exists
  try {
    const histSnap = await assertSucceeds(getDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_historical_001')));
    testAssert(
      histSnap.exists() &&
      histSnap.data().createdBy === 'cashier_rahul' &&
      histSnap.data().netPayable === 14500,
      'Historical invoice created by staff remains 100% intact with original audit stamp'
    );
  } catch (e) {
    testAssert(false, `Historical invoice preservation check failed: ${e.message}`);
  }

  // 45. Active cashier can still read the historical invoice
  try {
    const cashierReadHist = await assertSucceeds(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'invoices', 'inv_historical_001')));
    testAssert(cashierReadHist.exists(), 'Active staff member can still read historical invoice');
  } catch (e) {
    testAssert(false, `Active cashier read historical failed: ${e.message}`);
  }

  console.log('\n================================================================');
  console.log(`PHASE 4 STAFF MANAGEMENT INTEGRATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4StaffSuite().catch((err) => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});
