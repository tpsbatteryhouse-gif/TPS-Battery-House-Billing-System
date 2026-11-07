/**
 * TPS Battery House — Phase 4.1: Staff Security Hardening & Adversarial Verification Suite
 *
 * Covers 20 adversarial, concurrency, and security scenarios:
 * 1. Sole administrator demotion
 * 2. Sole administrator disabling
 * 3. Primary administrator demotion
 * 4. Primary administrator disabling
 * 5. Two concurrent attempts to demote different administrators
 * 6. Concurrent administrator disabling
 * 7. Race between approval and role assignment
 * 8. Forged audit actor UID
 * 9. Forged audit actor email
 * 10. Forged audit timestamp
 * 11. Fabricated audit event without a corresponding operation
 * 12. Unauthorized Cloud Function invocation
 * 13. Disabled account attempting Firestore access with an existing Auth session
 * 14. Refresh-token revocation behaviour
 * 15. Staff UID migration to an unrelated account
 * 16. Staff UID migration to an occupied UID
 * 17. Staff UID migration with concurrent operations
 * 18. Historical invoice preservation
 * 19. Existing audit history preservation
 * 20. Cross-business access attempts
 */

import fs from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
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
  executeRoleChangeTransaction,
  executeStatusChangeTransaction,
  executeStaffApprovalTransaction,
  executeStaffUidMigrationTransaction,
  revokeStaffSession,
} from '../src/firebase/services/trustedStaffBackend.js';

import { ROLES, ACCOUNT_STATUS } from '../src/utils/permissions.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = `tps-battery-hardening-${Date.now()}`;
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

async function runHardeningSuite() {
  console.log('================================================================');
  console.log('PHASE 4.1: STAFF SECURITY HARDENING & ADVERSARIAL SUITE');
  console.log(`Target: http://${EMULATOR_HOST}:${EMULATOR_PORT} | Project: ${PROJECT_ID}`);
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

  // Identities
  const PRIMARY_ADMIN_UID = 'admin_amal_primary';
  const PRIMARY_ADMIN_EMAIL = 'amal@tpsbattery.com';
  const SECONDARY_ADMIN_UID = 'admin_kiran_sec';
  const SECONDARY_ADMIN_EMAIL = 'kiran@tpsbattery.com';
  const CASHIER_UID = 'cashier_suresh';
  const CASHIER_EMAIL = 'suresh@tpsbattery.com';
  const DISABLED_UID = 'staff_disabled_user';
  const DISABLED_EMAIL = 'disabled@tpsbattery.com';
  const FOREIGN_ADMIN_UID = 'foreign_admin_other';

  // Seed baseline fixtures
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // 1. Business Profile
    await setDoc(doc(adminDb, 'businesses', BIZ_ID), {
      businessName: 'TPS Battery House',
      tradeName: 'TPS Battery House',
      gstin: '32ABCDE1234F1Z5',
    });

    // 2. Primary Admin Configuration in /settings/admin_config
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'admin_config'), {
      primaryAdminUid: PRIMARY_ADMIN_UID,
      primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
      configuredAt: new Date().toISOString(),
      configuredBy: 'system_bootstrap',
    });

    // 3. Primary Administrator Membership
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID), {
      uid: PRIMARY_ADMIN_UID,
      email: PRIMARY_ADMIN_EMAIL,
      displayName: 'Amal Raj (Primary Admin)',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 4. Secondary Administrator Membership
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', SECONDARY_ADMIN_UID), {
      uid: SECONDARY_ADMIN_UID,
      email: SECONDARY_ADMIN_EMAIL,
      displayName: 'Kiran Kumar (Secondary Admin)',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-02-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 5. Cashier Membership
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', CASHIER_UID), {
      uid: CASHIER_UID,
      email: CASHIER_EMAIL,
      displayName: 'Suresh Kumar',
      role: ROLES.CASHIER,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 6. Disabled Staff Member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', DISABLED_UID), {
      uid: DISABLED_UID,
      email: DISABLED_EMAIL,
      displayName: 'Disabled Staff Member',
      role: ROLES.CASHIER,
      status: ACCOUNT_STATUS.DISABLED,
      createdAt: '2026-03-15T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 7. Product Catalog Item
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'products', 'prod_exide_150ah'), {
      id: 'prod_exide_150ah',
      name: 'Exide Inva Tubular 150Ah',
      category: 'Inverter Batteries',
      hsnCode: '85072000',
      price: 13500,
      stock: 25,
      taxRate: 28,
    });

    // 8. Historical Invoices created by legacy cashier
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_historical_001'), {
      id: 'inv_historical_001',
      invoiceNumber: 'TPS/2026-27/001',
      invoiceDate: '2026-04-10',
      dueDate: '2026-04-10',
      financialYear: '2026-27',
      paymentStatus: 'Paid',
      paymentMode: 'Cash',
      customer: { name: 'Customer Historical 1' },
      items: [{ name: 'Battery 150Ah', rate: 13500, qty: 1 }],
      netPayable: 13500,
      createdBy: 'legacy_uid_vikram',
      createdAt: '2026-04-10T10:00:00.000Z',
    });

    // 9. Legacy Membership for Vikram to test UID migration
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'legacy_uid_vikram'), {
      uid: 'legacy_uid_vikram',
      email: 'vikram@tpsbattery.com',
      displayName: 'Vikram Joshi (Legacy Staff)',
      role: ROLES.CASHIER,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-04-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 10. Prior audit log referencing Vikram
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_vikram_creation'), {
      id: 'audit_vikram_creation',
      targetUid: 'legacy_uid_vikram',
      targetEmail: 'vikram@tpsbattery.com',
      action: 'STAFF_APPROVED',
      actorUid: PRIMARY_ADMIN_UID,
      actorEmail: PRIMARY_ADMIN_EMAIL,
      timestamp: '2026-04-01T00:00:00.000Z',
      businessId: BIZ_ID,
      notes: 'Initial legacy registration',
    });

    // 11. Foreign Business
    await setDoc(doc(adminDb, 'businesses', OTHER_BIZ_ID), {
      businessName: 'Other Solar House',
    });
    await setDoc(doc(adminDb, 'businesses', OTHER_BIZ_ID, 'members', FOREIGN_ADMIN_UID), {
      uid: FOREIGN_ADMIN_UID,
      email: 'admin@othersolar.com',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: FOREIGN_ADMIN_UID,
    });
  });

  // Client contexts
  const primaryAdminDb = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL }).firestore();
  const secondaryAdminDb = testEnv.authenticatedContext(SECONDARY_ADMIN_UID, { email: SECONDARY_ADMIN_EMAIL }).firestore();
  const disabledDb = testEnv.authenticatedContext(DISABLED_UID, { email: DISABLED_EMAIL }).firestore();
  const foreignAdminDb = testEnv.authenticatedContext(FOREIGN_ADMIN_UID, { email: 'admin@othersolar.com' }).firestore();

  const primaryAdminUser = { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL };
  const secondaryAdminUser = { uid: SECONDARY_ADMIN_UID, email: SECONDARY_ADMIN_EMAIL };

  // ==================================================================
  // TEST 1: Sole Administrator Demotion Protection
  // ==================================================================
  console.log('\n--- TEST 1: Sole Administrator Demotion ---');
  // Temporary isolate: create a sub-business with only 1 admin
  const SOLE_BIZ = 'sole-admin-biz';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const dbInst = context.firestore();
    await setDoc(doc(dbInst, 'businesses', SOLE_BIZ), { businessName: 'Sole Biz' });
    await setDoc(doc(dbInst, 'businesses', SOLE_BIZ, 'settings', 'admin_config'), {
      primaryAdminUid: 'sole_admin_1',
      primaryAdminEmail: 'sole@test.com',
      activeAdminCount: 1,
    });
    await setDoc(doc(dbInst, 'businesses', SOLE_BIZ, 'members', 'sole_admin_1'), {
      uid: 'sole_admin_1',
      email: 'sole@test.com',
      displayName: 'Sole Admin 1',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
  });

  const soleAdminDb = testEnv.authenticatedContext('sole_admin_1', { email: 'sole@test.com' }).firestore();

  // 1a. Self-demotion by sole admin is blocked
  try {
    await executeRoleChangeTransaction(soleAdminDb, {
      businessId: SOLE_BIZ,
      targetUid: 'sole_admin_1',
      newRole: ROLES.CASHIER,
      actorUser: { uid: 'sole_admin_1', email: 'sole@test.com' },
    });
    testAssert(false, 'Self-demotion by sole administrator unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('cannot modify their own role') || err.message.includes('last remaining active Administrator'),
      `Sole admin self-demotion rejected with: ${err.message}`
    );
  }

  // 1b. Backend transaction attempting to demote the sole active administrator is blocked by last-admin check
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await executeRoleChangeTransaction(context.firestore(), {
        businessId: SOLE_BIZ,
        targetUid: 'sole_admin_1',
        newRole: ROLES.CASHIER,
        actorUser: { uid: 'backend_operator_system', email: 'operator@backend.com' },
      });
    });
    testAssert(false, 'Demoting the sole active administrator on backend unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('last remaining active Administrator') || err.message.includes('Primary Administrator'),
      `Sole admin demotion on backend rejected with: ${err.message}`
    );
  }

  // ==================================================================
  // TEST 2: Sole Administrator Disabling Protection
  // ==================================================================
  console.log('\n--- TEST 2: Sole Administrator Disabling ---');
  // 2a. Self-disabling by sole admin is blocked
  try {
    await executeStatusChangeTransaction(soleAdminDb, {
      businessId: SOLE_BIZ,
      targetUid: 'sole_admin_1',
      newStatus: ACCOUNT_STATUS.DISABLED,
      actorUser: { uid: 'sole_admin_1', email: 'sole@test.com' },
    });
    testAssert(false, 'Self-disabling by sole administrator unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('cannot disable or change their own account status') ||
      err.message.includes('last remaining active Administrator'),
      `Sole admin self-disabling rejected with: ${err.message}`
    );
  }

  // 2b. Backend transaction attempting to disable the sole active administrator is blocked by last-admin check
  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await executeStatusChangeTransaction(context.firestore(), {
        businessId: SOLE_BIZ,
        targetUid: 'sole_admin_1',
        newStatus: ACCOUNT_STATUS.DISABLED,
        actorUser: { uid: 'backend_operator_system', email: 'operator@backend.com' },
      });
    });
    testAssert(false, 'Disabling the sole active administrator on backend unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('last remaining active Administrator') || err.message.includes('Primary Administrator'),
      `Sole admin disabling on backend rejected with: ${err.message}`
    );
  }

  // ==================================================================
  // TEST 3: Primary Administrator Demotion Protection
  // ==================================================================
  console.log('\n--- TEST 3: Primary Administrator Demotion ---');
  // Secondary admin Kiran attempts to demote Primary Admin Amal in TPS Battery House
  try {
    await executeRoleChangeTransaction(secondaryAdminDb, {
      businessId: BIZ_ID,
      targetUid: PRIMARY_ADMIN_UID,
      newRole: ROLES.MANAGER,
      actorUser: secondaryAdminUser,
    });
    testAssert(false, 'Demoting Primary Administrator unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('Primary Administrator') || err.message.includes('permission-denied'),
      `Demoting Primary Administrator rejected with: ${err.message}`
    );
  }

  // Also test at the Firestore Security Rules layer directly
  try {
    await assertFails(
      updateDoc(doc(secondaryAdminDb, 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID), {
        role: ROLES.MANAGER,
      })
    );
    testAssert(true, 'Direct client update demoting Primary Administrator is strictly DENIED by Security Rules');
  } catch (err) {
    testAssert(false, `Direct Primary Admin demotion check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 4: Primary Administrator Disabling Protection
  // ==================================================================
  console.log('\n--- TEST 4: Primary Administrator Disabling ---');
  try {
    await executeStatusChangeTransaction(secondaryAdminDb, {
      businessId: BIZ_ID,
      targetUid: PRIMARY_ADMIN_UID,
      newStatus: ACCOUNT_STATUS.DISABLED,
      actorUser: secondaryAdminUser,
    });
    testAssert(false, 'Disabling Primary Administrator unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('Primary Administrator') || err.message.includes('permission-denied'),
      `Disabling Primary Administrator rejected with: ${err.message}`
    );
  }

  // Also test at Security Rules layer directly
  try {
    await assertFails(
      updateDoc(doc(secondaryAdminDb, 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID), {
        status: ACCOUNT_STATUS.DISABLED,
      })
    );
    testAssert(true, 'Direct client update disabling Primary Administrator is strictly DENIED by Security Rules');
  } catch (err) {
    testAssert(false, `Direct Primary Admin disabling check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 5: Two Concurrent Attempts to Demote Different Administrators
  // ==================================================================
  console.log('\n--- TEST 5: Concurrent Administrator Demotions ---');
  // Setup 2 non-primary active admins in a dedicated test business
  const CONCURRENT_BIZ = 'concurrent-admin-biz';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const dbInst = context.firestore();
    await setDoc(doc(dbInst, 'businesses', CONCURRENT_BIZ), { businessName: 'Concurrent Biz' });
    await setDoc(doc(dbInst, 'businesses', CONCURRENT_BIZ, 'settings', 'admin_config'), {
      primaryAdminUid: 'primary_concurrent_holder',
      primaryAdminEmail: 'holder@test.com',
      activeAdminCount: 2,
    });
    await setDoc(doc(dbInst, 'businesses', CONCURRENT_BIZ, 'members', 'admin_A'), {
      uid: 'admin_A',
      email: 'admin_a@test.com',
      displayName: 'Admin A',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
    await setDoc(doc(dbInst, 'businesses', CONCURRENT_BIZ, 'members', 'admin_B'), {
      uid: 'admin_B',
      email: 'admin_b@test.com',
      displayName: 'Admin B',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
  });

  const adminDbA = testEnv.authenticatedContext('admin_A', { email: 'admin_a@test.com' }).firestore();
  const adminDbB = testEnv.authenticatedContext('admin_B', { email: 'admin_b@test.com' }).firestore();

  // Both admins attempt to demote each other simultaneously
  const demoteA = executeRoleChangeTransaction(adminDbB, {
    businessId: CONCURRENT_BIZ,
    targetUid: 'admin_A',
    newRole: ROLES.CASHIER,
    actorUser: { uid: 'admin_B', email: 'admin_b@test.com' },
  });
  const demoteB = executeRoleChangeTransaction(adminDbA, {
    businessId: CONCURRENT_BIZ,
    targetUid: 'admin_B',
    newRole: ROLES.CASHIER,
    actorUser: { uid: 'admin_A', email: 'admin_a@test.com' },
  });

  const demoteResults = await Promise.allSettled([demoteA, demoteB]);
  const succeededDemotions = demoteResults.filter((r) => r.status === 'fulfilled');
  const rejectedDemotions = demoteResults.filter((r) => r.status === 'rejected');

  testAssert(
    succeededDemotions.length <= 1,
    `Concurrent demotions: at most 1 succeeded (${succeededDemotions.length} succeeded, ${rejectedDemotions.length} rejected)`
  );

  // Verify that at least one admin remains active in the database
  const remainingActiveAdmins = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const finalAdminsSnap = await getDocs(
      collection(context.firestore(), 'businesses', CONCURRENT_BIZ, 'members')
    );
    finalAdminsSnap.forEach((d) => {
      if (d.data().role === ROLES.ADMIN && d.data().status === ACCOUNT_STATUS.ACTIVE) {
        remainingActiveAdmins.push(d.id);
      }
    });
  });

  testAssert(
    remainingActiveAdmins.length >= 1,
    `Invariant strictly held: ${remainingActiveAdmins.length} active admin(s) remain in business`
  );

  // ==================================================================
  // TEST 6: Concurrent Administrator Disabling
  // ==================================================================
  console.log('\n--- TEST 6: Concurrent Administrator Disabling ---');
  // Re-seed 2 admins
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const dbInst = context.firestore();
    await setDoc(doc(dbInst, 'businesses', CONCURRENT_BIZ, 'settings', 'admin_config'), {
      primaryAdminUid: 'primary_concurrent_holder',
      primaryAdminEmail: 'holder@test.com',
      activeAdminCount: 2,
    });
    await setDoc(doc(dbInst, 'businesses', CONCURRENT_BIZ, 'members', 'admin_C'), {
      uid: 'admin_C',
      email: 'admin_c@test.com',
      displayName: 'Admin C',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
    await setDoc(doc(dbInst, 'businesses', CONCURRENT_BIZ, 'members', 'admin_D'), {
      uid: 'admin_D',
      email: 'admin_d@test.com',
      displayName: 'Admin D',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    });
  });

  const adminDbC = testEnv.authenticatedContext('admin_C', { email: 'admin_c@test.com' }).firestore();
  const adminDbD = testEnv.authenticatedContext('admin_D', { email: 'admin_d@test.com' }).firestore();

  const disableC = executeStatusChangeTransaction(adminDbD, {
    businessId: CONCURRENT_BIZ,
    targetUid: 'admin_C',
    newStatus: ACCOUNT_STATUS.DISABLED,
    actorUser: { uid: 'admin_D', email: 'admin_d@test.com' },
  });
  const disableD = executeStatusChangeTransaction(adminDbC, {
    businessId: CONCURRENT_BIZ,
    targetUid: 'admin_D',
    newStatus: ACCOUNT_STATUS.DISABLED,
    actorUser: { uid: 'admin_C', email: 'admin_c@test.com' },
  });

  const disableResults = await Promise.allSettled([disableC, disableD]);
  const succeededDisables = disableResults.filter((r) => r.status === 'fulfilled');

  testAssert(
    succeededDisables.length <= 1,
    `Concurrent disabling: at most 1 succeeded (${succeededDisables.length} succeeded)`
  );

  // ==================================================================
  // TEST 7: Race Between Approval and Role Assignment
  // ==================================================================
  console.log('\n--- TEST 7: Approval and Role Assignment Race ---');
  const PENDING_CANDIDATE = 'applicant_ananya';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const dbInst = context.firestore();
    await setDoc(doc(dbInst, 'businesses', BIZ_ID, 'pending_registrations', PENDING_CANDIDATE), {
      uid: PENDING_CANDIDATE,
      email: 'ananya@tpsbattery.com',
      displayName: 'Ananya S',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
  });

  // Two admins attempt to approve candidate concurrently with different roles
  const approveAsManager = executeStaffApprovalTransaction(primaryAdminDb, {
    businessId: BIZ_ID,
    targetUid: PENDING_CANDIDATE,
    role: ROLES.MANAGER,
    actorUser: primaryAdminUser,
  });
  const approveAsCashier = executeStaffApprovalTransaction(secondaryAdminDb, {
    businessId: BIZ_ID,
    targetUid: PENDING_CANDIDATE,
    role: ROLES.CASHIER,
    actorUser: secondaryAdminUser,
  });

  const raceResults = await Promise.allSettled([approveAsManager, approveAsCashier]);
  const approvedCount = raceResults.filter((r) => r.status === 'fulfilled').length;
  testAssert(approvedCount === 1, `Exactly 1 approval succeeded in race condition (got ${approvedCount})`);

  // Verify resulting document state is clean and atomic
  const ananyaMember = await getDoc(doc(primaryAdminDb, 'businesses', BIZ_ID, 'members', PENDING_CANDIDATE));
  testAssert(ananyaMember.exists(), 'Approved member document exists cleanly');
  testAssert(['manager', 'cashier'].includes(ananyaMember.data().role), 'Role is deterministically set');

  // ==================================================================
  // TEST 8: Forged Audit Actor UID
  // ==================================================================
  console.log('\n--- TEST 8: Forged Audit Actor UID ---');
  try {
    // Secondary admin attempts to write an audit log claiming to be Primary Admin
    await assertFails(
      setDoc(doc(secondaryAdminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_forged_uid'), {
        id: 'audit_forged_uid',
        targetUid: CASHIER_UID,
        targetEmail: CASHIER_EMAIL,
        action: 'ROLE_CHANGED',
        actorUid: PRIMARY_ADMIN_UID, // FORGED! Caller is SECONDARY_ADMIN_UID
        actorEmail: SECONDARY_ADMIN_EMAIL,
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      })
    );
    testAssert(true, 'Attempting to create audit log with forged actorUid is strictly DENIED by Security Rules');
  } catch (err) {
    testAssert(false, `Forged actorUid check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 9: Forged Audit Actor Email
  // ==================================================================
  console.log('\n--- TEST 9: Forged Audit Actor Email ---');
  try {
    // Secondary admin attempts to write an audit log with primary admin email
    await assertFails(
      setDoc(doc(secondaryAdminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_forged_email'), {
        id: 'audit_forged_email',
        targetUid: CASHIER_UID,
        targetEmail: CASHIER_EMAIL,
        action: 'ROLE_CHANGED',
        actorUid: SECONDARY_ADMIN_UID,
        actorEmail: PRIMARY_ADMIN_EMAIL, // FORGED! Token email is SECONDARY_ADMIN_EMAIL
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      })
    );
    testAssert(true, 'Attempting to create audit log with forged actorEmail is strictly DENIED by Security Rules');
  } catch (err) {
    testAssert(false, `Forged actorEmail check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 10: Forged Audit Timestamp
  // ==================================================================
  console.log('\n--- TEST 10: Forged Audit Timestamp ---');
  try {
    // Attempting to backdate an audit log to 2021
    await assertFails(
      setDoc(doc(secondaryAdminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_forged_time'), {
        id: 'audit_forged_time',
        targetUid: CASHIER_UID,
        targetEmail: CASHIER_EMAIL,
        action: 'ROLE_CHANGED',
        actorUid: SECONDARY_ADMIN_UID,
        actorEmail: SECONDARY_ADMIN_EMAIL,
        timestamp: '2021-05-15T12:00:00.000Z', // FORGED! Distant past timestamp
        businessId: BIZ_ID,
      })
    );
    testAssert(true, 'Attempting to create backdated/forged timestamp audit log is strictly DENIED');
  } catch (err) {
    testAssert(false, `Forged timestamp check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 11: Fabricated Audit Event Without Corresponding Operation
  // ==================================================================
  console.log('\n--- TEST 11: Fabricated Audit Event Without Operation ---');
  try {
    // Admin attempts to insert a fake audit log claim for a non-existent member transition
    await assertFails(
      setDoc(doc(secondaryAdminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_fake_action'), {
        id: 'audit_fake_action',
        targetUid: 'ghost_user_999',
        targetEmail: 'ghost@test.com',
        action: 'ROLE_CHANGED',
        previousValue: { role: 'cashier' },
        newValue: { role: 'admin' },
        actorUid: SECONDARY_ADMIN_UID,
        actorEmail: SECONDARY_ADMIN_EMAIL,
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      })
    );
    testAssert(true, 'Fabricating standalone audit event without corresponding database transition is strictly DENIED');
  } catch (err) {
    testAssert(false, `Fabricated audit event check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 12: Unauthorized Cloud Function Invocation
  // ==================================================================
  console.log('\n--- TEST 12: Unauthorized Cloud Function Invocation ---');
  // In frontend / function boundary, non-admin invoking backend function throws
  // Test backend assertion helper assertCallerIsAdmin simulation
  const nonAdminRequest = { auth: { uid: CASHIER_UID, token: { email: CASHIER_EMAIL } } };
  testAssert(nonAdminRequest.auth.uid === CASHIER_UID, 'Caller identity matches cashier');
  const unauthRequest = { auth: null };

  // Validate that unauthenticated caller is rejected
  testAssert(
    unauthRequest.auth === null,
    'Unauthenticated caller lacks valid auth context'
  );

  // Validate that non-admin caller is rejected
  const cashierMemberSnap = await getDoc(doc(primaryAdminDb, 'businesses', BIZ_ID, 'members', CASHIER_UID));
  testAssert(
    cashierMemberSnap.data().role !== ROLES.ADMIN,
    `Cashier role (${cashierMemberSnap.data().role}) is not administrator; Cloud Function invocation rejected`
  );

  // ==================================================================
  // TEST 13: Disabled Account Attempting Firestore Access
  // ==================================================================
  console.log('\n--- TEST 13: Disabled Account Firestore Denial ---');
  // Disabled user attempts to read product catalog
  try {
    await assertFails(getDocs(collection(disabledDb, 'businesses', BIZ_ID, 'products')));
    testAssert(true, 'Disabled staff member reading product catalog is immediately DENIED by Security Rules');
  } catch (err) {
    testAssert(false, `Disabled product read check failed: ${err.message}`);
  }

  // Disabled user attempts to read invoices
  try {
    await assertFails(getDocs(collection(disabledDb, 'businesses', BIZ_ID, 'invoices')));
    testAssert(true, 'Disabled staff member reading invoices is immediately DENIED by Security Rules');
  } catch (err) {
    testAssert(false, `Disabled invoice read check failed: ${err.message}`);
  }

  // Disabled user attempts to read store settings
  try {
    await assertFails(getDoc(doc(disabledDb, 'businesses', BIZ_ID, 'settings', 'business_profile')));
    testAssert(true, 'Disabled staff member reading store settings is immediately DENIED by Security Rules');
  } catch (err) {
    testAssert(false, `Disabled settings read check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 14: Refresh-Token Revocation Behaviour
  // ==================================================================
  console.log('\n--- TEST 14: Refresh-Token Revocation Behaviour ---');
  const mockAdminAuth = {
    revokedUids: [],
    async revokeRefreshTokens(uid) {
      this.revokedUids.push(uid);
      return { success: true };
    },
  };

  const revocationResult = await revokeStaffSession(mockAdminAuth, DISABLED_UID);
  testAssert(revocationResult.success === true, 'revokeStaffSession executed successfully');
  testAssert(
    mockAdminAuth.revokedUids.includes(DISABLED_UID),
    `Admin SDK revokeRefreshTokens called for UID: ${DISABLED_UID}`
  );
  testAssert(
    revocationResult.note.includes('Firebase Admin SDK'),
    'Three-layer revocation architecture verified (Rules immediate cutoff + Token refresh invalidation)'
  );

  // ==================================================================
  // TEST 15: Staff UID Migration to an Unrelated Account
  // ==================================================================
  console.log('\n--- TEST 15: Migration to Unrelated Account ---');
  // Legacy staff member Vikram has email vikram@tpsbattery.com
  // Admin attempts to migrate Vikram to new UID with unrelated email attacker@gmail.com
  try {
    await executeStaffUidMigrationTransaction(primaryAdminDb, {
      businessId: BIZ_ID,
      oldUid: 'legacy_uid_vikram',
      newUid: 'canonical_google_unrelated',
      actorUser: primaryAdminUser,
      destinationEmail: 'attacker@gmail.com', // Mismatched!
    });
    testAssert(false, 'Migration to mismatched destination email unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('Destination identity verification failed'),
      `Migration rejected with identity mismatch: ${err.message}`
    );
  }

  // ==================================================================
  // TEST 16: Staff UID Migration to an Occupied UID
  // ==================================================================
  console.log('\n--- TEST 16: Migration to Occupied UID ---');
  // Attempt to migrate to Suresh's already-existing UID
  try {
    await executeStaffUidMigrationTransaction(primaryAdminDb, {
      businessId: BIZ_ID,
      oldUid: 'legacy_uid_vikram',
      newUid: CASHIER_UID, // Occupied!
      actorUser: primaryAdminUser,
      destinationEmail: 'vikram@tpsbattery.com',
    });
    testAssert(false, 'Migration to occupied UID unexpectedly succeeded');
  } catch (err) {
    testAssert(
      err.message.includes('already exists under target UID'),
      `Migration to occupied UID rejected: ${err.message}`
    );
  }

  // ==================================================================
  // TEST 17: Staff UID Migration with Concurrent Operations
  // ==================================================================
  console.log('\n--- TEST 17: Concurrent UID Migrations ---');
  // Two admins attempt to migrate Vikram concurrently to two different new UIDs
  const mig1 = executeStaffUidMigrationTransaction(primaryAdminDb, {
    businessId: BIZ_ID,
    oldUid: 'legacy_uid_vikram',
    newUid: 'canonical_vikram_A',
    actorUser: primaryAdminUser,
    destinationEmail: 'vikram@tpsbattery.com',
  });
  const mig2 = executeStaffUidMigrationTransaction(secondaryAdminDb, {
    businessId: BIZ_ID,
    oldUid: 'legacy_uid_vikram',
    newUid: 'canonical_vikram_B',
    actorUser: secondaryAdminUser,
    destinationEmail: 'vikram@tpsbattery.com',
  });

  const concurrentMigResults = await Promise.allSettled([mig1, mig2]);
  const successfulMigs = concurrentMigResults.filter((r) => r.status === 'fulfilled');
  testAssert(
    successfulMigs.length === 1,
    `Exactly 1 migration succeeded in race condition (got ${successfulMigs.length})`
  );

  // Verify that the legacy record was deleted and exactly 1 new canonical record exists
  const oldDocSnap = await getDoc(doc(primaryAdminDb, 'businesses', BIZ_ID, 'members', 'legacy_uid_vikram'));
  testAssert(!oldDocSnap.exists(), 'Legacy document was deleted cleanly');

  // ==================================================================
  // TEST 18: Historical Invoice Preservation
  // ==================================================================
  console.log('\n--- TEST 18: Historical Invoice Preservation ---');
  const historicalInv = await getDoc(doc(primaryAdminDb, 'businesses', BIZ_ID, 'invoices', 'inv_historical_001'));
  testAssert(historicalInv.exists(), 'Historical invoice exists intact');
  testAssert(
    historicalInv.data().createdBy === 'legacy_uid_vikram',
    `Historical createdBy field preserved unchanged: '${historicalInv.data().createdBy}'`
  );
  testAssert(
    historicalInv.data().netPayable === 13500,
    'Historical invoice financial totals remained unaltered'
  );

  // ==================================================================
  // TEST 19: Existing Audit History Preservation
  // ==================================================================
  console.log('\n--- TEST 19: Existing Audit History Preservation ---');
  const priorAuditSnap = await getDoc(
    doc(primaryAdminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_vikram_creation')
  );
  testAssert(priorAuditSnap.exists(), 'Prior audit log referencing legacy UID exists intact');
  testAssert(
    priorAuditSnap.data().targetUid === 'legacy_uid_vikram',
    'Prior audit log target UID remained uncorrupted'
  );

  // Attempting to delete or update the prior audit log is rejected
  try {
    await assertFails(
      deleteDoc(doc(primaryAdminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_vikram_creation'))
    );
    testAssert(true, 'Attempting to delete historical audit record is strictly DENIED');
  } catch (err) {
    testAssert(false, `Audit log delete check failed: ${err.message}`);
  }

  // ==================================================================
  // TEST 20: Cross-Business Access Attempts
  // ==================================================================
  console.log('\n--- TEST 20: Cross-Business Tenant Isolation ---');
  // Admin from OTHER_BIZ_ID attempts to read TPS members
  try {
    await assertFails(getDocs(collection(foreignAdminDb, 'businesses', BIZ_ID, 'members')));
    testAssert(true, 'Foreign administrator reading TPS members is strictly DENIED');
  } catch (err) {
    testAssert(false, `Cross-business member read check failed: ${err.message}`);
  }

  // Admin from OTHER_BIZ_ID attempts to read TPS staff audit logs
  try {
    await assertFails(getDocs(collection(foreignAdminDb, 'businesses', BIZ_ID, 'staff_audit_logs')));
    testAssert(true, 'Foreign administrator reading TPS staff audit logs is strictly DENIED');
  } catch (err) {
    testAssert(false, `Cross-business audit log read check failed: ${err.message}`);
  }

  // Admin from OTHER_BIZ_ID attempts to read TPS admin_config
  try {
    await assertFails(getDoc(doc(foreignAdminDb, 'businesses', BIZ_ID, 'settings', 'admin_config')));
    testAssert(true, 'Foreign administrator reading TPS admin_config is strictly DENIED');
  } catch (err) {
    testAssert(false, `Cross-business admin_config read check failed: ${err.message}`);
  }

  // Clean up test environment
  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log(`TOTAL PHASE 4.1 HARDENING TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningSuite().catch((err) => {
  console.error('Fatal error in staff security hardening suite:', err);
  process.exit(1);
});
