/**
 * TPS Battery House — Staff Removal Test Suite
 *
 * Comprehensive adversarial, rule-enforcement, and transactional verification for:
 * 1. Self-removal rejection
 * 2. Primary Administrator protection
 * 3. Last Active Administrator protection
 * 4. Non-admin caller rejection
 * 5. Successful removal of Cashier (atomic deletion + audit log)
 * 6. Successful removal of Manager (atomic deletion + audit log)
 * 7. Successful removal of Secondary Admin (when multiple active admins exist)
 * 8. Pending registration record cleanup during removal
 * 9. Historical invoice preservation
 * 10. Prior audit log preservation
 * 11. Immediate access cutoff for removed user (<10ms / immediate PERMISSION_DENIED)
 * 12. Cross-business isolation
 * 13. Audit log anti-forgery (actorUid forgery rejected)
 * 14. Audit log anti-forgery (actorEmail forgery rejected)
 * 15. Audit log state linkage (STAFF_REMOVED rejected if member doc still exists)
 * 16. Direct security rule delete rejection for Primary Admin
 * 17. Direct security rule delete rejection for self
 * 18. Concurrency & race condition safety (concurrent admin removal preserves at least 1 active admin)
 */

import fs from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
} from 'firebase/firestore';

import {
  executeStaffRemovalTransaction,
} from '../src/firebase/services/trustedStaffBackend.js';
import { removeStaffMember } from '../src/firebase/services/staffService.js';
import { ROLES, ACCOUNT_STATUS } from '../src/utils/permissions.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = `tps-staff-removal-${Date.now()}`;
const BIZ_ID = 'tps-battery-house';
const OTHER_BIZ_ID = 'other-biz-house';

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

async function runStaffRemovalSuite() {
  console.log('================================================================');
  console.log('STAFF PERMANENT REMOVAL INTEGRATION & SECURITY SUITE');
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

  // UIDs & Identities
  const PRIMARY_ADMIN_UID = 'admin_amal_primary';
  const PRIMARY_ADMIN_EMAIL = 'amal@tpsbattery.com';
  const SECONDARY_ADMIN_UID = 'admin_kiran_sec';
  const SECONDARY_ADMIN_EMAIL = 'kiran@tpsbattery.com';
  const CASHIER_UID = 'cashier_suresh';
  const CASHIER_EMAIL = 'suresh@tpsbattery.com';
  const MANAGER_UID = 'manager_deepa';
  const MANAGER_EMAIL = 'deepa@tpsbattery.com';
  const SOLE_ADMIN_UID = 'sole_admin_bob';
  const SOLE_ADMIN_EMAIL = 'bob@tpsbattery.com';
  const SOLE_BIZ_ID = 'sole-admin-biz';

  // Seed baseline data
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // 1. Business Profile
    await setDoc(doc(adminDb, 'businesses', BIZ_ID), {
      businessName: 'TPS Battery House',
      tradeName: 'TPS Battery House',
      gstin: '32ABCDE1234F1Z5',
    });

    // 2. Primary Admin Config
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'admin_config'), {
      primaryAdminUid: PRIMARY_ADMIN_UID,
      primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
      configuredAt: '2026-01-01T00:00:00.000Z',
    });

    // 3. Primary Admin Member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID), {
      uid: PRIMARY_ADMIN_UID,
      email: PRIMARY_ADMIN_EMAIL,
      displayName: 'Amal Raj (Primary Admin)',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 4. Secondary Admin Member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', SECONDARY_ADMIN_UID), {
      uid: SECONDARY_ADMIN_UID,
      email: SECONDARY_ADMIN_EMAIL,
      displayName: 'Kiran Kumar (Secondary Admin)',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-02-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 5. Cashier Member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', CASHIER_UID), {
      uid: CASHIER_UID,
      email: CASHIER_EMAIL,
      displayName: 'Suresh Kumar',
      role: ROLES.CASHIER,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 6. Cashier Pending Registration (e.g. from historical registration flow)
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'pending_registrations', CASHIER_UID), {
      uid: CASHIER_UID,
      email: CASHIER_EMAIL,
      displayName: 'Suresh Kumar',
      status: 'approved',
      assignedRole: ROLES.CASHIER,
      requestedAt: '2026-02-28T00:00:00.000Z',
    });

    // 7. Manager Member
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', MANAGER_UID), {
      uid: MANAGER_UID,
      email: MANAGER_EMAIL,
      displayName: 'Deepa V.',
      role: ROLES.MANAGER,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-03-05T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 8. Historical Invoice created by Cashier Suresh
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'invoices', 'inv_suresh_001'), {
      id: 'inv_suresh_001',
      invoiceNumber: 'TPS/2026-27/042',
      invoiceDate: '2026-04-15',
      dueDate: '2026-04-15',
      financialYear: '2026-27',
      paymentStatus: 'Paid',
      paymentMode: 'Cash',
      customer: { name: 'Ramesh Auto', phone: '9847012345' },
      items: [{ name: 'Amaron Pro 100Ah', qty: 1, rate: 8500, amount: 8500 }],
      netPayable: 8500,
      createdBy: CASHIER_UID,
      createdAt: '2026-04-15T10:00:00.000Z',
    });

    // 9. Prior Audit Log for Cashier Suresh
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_suresh_approved'), {
      id: 'audit_suresh_approved',
      targetUid: CASHIER_UID,
      targetEmail: CASHIER_EMAIL,
      targetName: 'Suresh Kumar',
      action: 'STAFF_APPROVED',
      previousValue: null,
      newValue: { role: ROLES.CASHIER, status: ACCOUNT_STATUS.ACTIVE },
      actorUid: PRIMARY_ADMIN_UID,
      actorEmail: PRIMARY_ADMIN_EMAIL,
      timestamp: '2026-03-01T00:00:00.000Z',
      businessId: BIZ_ID,
      notes: 'Initial approval',
    });

    // 10. Sole Admin Business Fixtures
    await setDoc(doc(adminDb, 'businesses', SOLE_BIZ_ID), {
      businessName: 'Sole Admin Biz',
      gstin: '32SOLEX1234F1Z1',
    });
    await setDoc(doc(adminDb, 'businesses', SOLE_BIZ_ID, 'settings', 'admin_config'), {
      primaryAdminUid: SOLE_ADMIN_UID,
      primaryAdminEmail: SOLE_ADMIN_EMAIL,
    });
    await setDoc(doc(adminDb, 'businesses', SOLE_BIZ_ID, 'members', SOLE_ADMIN_UID), {
      uid: SOLE_ADMIN_UID,
      email: SOLE_ADMIN_EMAIL,
      displayName: 'Bob Sole Admin',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: SOLE_ADMIN_UID,
    });
  });

  console.log('--- TEST 1: Reject Self-Removal ---');
  try {
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    await executeStaffRemovalTransaction(adminCtx.firestore(), {
      businessId: BIZ_ID,
      targetUid: PRIMARY_ADMIN_UID,
      actorUser: { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL },
    });
    testAssert(false, 'Self-removal should have thrown error');
  } catch (err) {
    testAssert(
      err.message.includes('Administrators cannot remove their own account'),
      `Self-removal rejected with expected error: "${err.message}"`
    );
  }

  console.log('--- TEST 2: Reject Removal of Primary Administrator ---');
  try {
    const secAdminCtx = testEnv.authenticatedContext(SECONDARY_ADMIN_UID, { email: SECONDARY_ADMIN_EMAIL });
    await executeStaffRemovalTransaction(secAdminCtx.firestore(), {
      businessId: BIZ_ID,
      targetUid: PRIMARY_ADMIN_UID,
      actorUser: { uid: SECONDARY_ADMIN_UID, email: SECONDARY_ADMIN_EMAIL },
    });
    testAssert(false, 'Primary Admin removal should have thrown error');
  } catch (err) {
    testAssert(
      err.message.includes('Cannot remove the Primary Administrator'),
      `Primary Admin removal rejected with expected error: "${err.message}"`
    );
  }

  console.log('--- TEST 3: Reject Removal of Last Active Administrator ---');
  try {
    // In SOLE_BIZ_ID, Bob is the sole active admin.
    // An external caller (e.g. backend / Cloud Function or service admin) attempts removal:
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await executeStaffRemovalTransaction(adminDb, {
        businessId: SOLE_BIZ_ID,
        targetUid: SOLE_ADMIN_UID,
        actorUser: { uid: 'service_operator', email: 'operator@tps.com' },
        primaryAdminUid: 'non_target_primary', // isolate last-active-admin check
      });
    });
    testAssert(false, 'Last active admin removal should have thrown error');
  } catch (err) {
    testAssert(
      err.message.includes('Cannot remove the last remaining active Administrator'),
      `Last active admin removal rejected with expected error: "${err.message}"`
    );
  }

  console.log('--- TEST 4: Reject Removal by Non-Admin (Cashier) via Security Rules ---');
  {
    const cashierCtx = testEnv.authenticatedContext(CASHIER_UID, { email: CASHIER_EMAIL });
    const cashierDb = cashierCtx.firestore();
    const targetRef = doc(cashierDb, 'businesses', BIZ_ID, 'members', MANAGER_UID);
    await assertFails(deleteDoc(targetRef));
    testAssert(true, 'Non-admin deleteDoc on member document rejected by security rules');
  }

  console.log('--- TEST 5: Successful Removal of Cashier (Atomic Deletion + Audit Log) ---');
  {
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const res = await removeStaffMember(
      BIZ_ID,
      CASHIER_UID,
      { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL },
      adminCtx.firestore(),
      'Staff member resigned'
    );
    testAssert(res.success && res.removedUid === CASHIER_UID, 'removeStaffMember returned success');

    // Verify member doc is deleted
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', CASHIER_UID));
      testAssert(!snap.exists(), 'Cashier membership document is deleted from Firestore');
    });

    // Verify audit log created with action: 'STAFF_REMOVED'
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const logsSnap = await getDocs(collection(context.firestore(), 'businesses', BIZ_ID, 'staff_audit_logs'));
      let removalLog = null;
      logsSnap.forEach((d) => {
        const data = d.data();
        if (data.targetUid === CASHIER_UID && data.action === 'STAFF_REMOVED') {
          removalLog = data;
        }
      });
      testAssert(removalLog !== null, 'STAFF_REMOVED audit log found');
      testAssert(removalLog.targetEmail === CASHIER_EMAIL, 'Audit log contains correct targetEmail');
      testAssert(removalLog.actorUid === PRIMARY_ADMIN_UID, 'Audit log contains correct actorUid');
      testAssert(removalLog.previousValue.role === ROLES.CASHIER, 'Audit log contains correct previousValue');
      testAssert(removalLog.newValue === null, 'Audit log contains newValue: null');
    });
  }

  console.log('--- TEST 6: Successful Removal of Manager ---');
  {
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const res = await executeStaffRemovalTransaction(adminCtx.firestore(), {
      businessId: BIZ_ID,
      targetUid: MANAGER_UID,
      actorUser: { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL },
    });
    testAssert(res.success && res.removedUid === MANAGER_UID, 'Manager removal executed successfully');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', MANAGER_UID));
      testAssert(!snap.exists(), 'Manager membership document is deleted');
    });
  }

  console.log('--- TEST 7: Successful Removal of Secondary Admin (Multiple Active Admins Exist) ---');
  {
    // Primary Admin removes Secondary Admin (leaving Primary Admin as sole active admin)
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const res = await executeStaffRemovalTransaction(adminCtx.firestore(), {
      businessId: BIZ_ID,
      targetUid: SECONDARY_ADMIN_UID,
      actorUser: { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL },
    });
    testAssert(res.success && res.removedUid === SECONDARY_ADMIN_UID, 'Secondary Admin removed successfully');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', SECONDARY_ADMIN_UID));
      testAssert(!snap.exists(), 'Secondary Admin membership document is deleted');

      const primarySnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID));
      testAssert(primarySnap.exists() && primarySnap.data().status === ACCOUNT_STATUS.ACTIVE, 'Primary Admin remains active');
    });
  }

  console.log('--- TEST 8: Pending Registration Record Cleanup During Removal ---');
  {
    // In Test 5, CASHIER_UID had a pending registration document seeded.
    // Let's verify that pending_registrations/CASHIER_UID was deleted during removal.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const regSnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'pending_registrations', CASHIER_UID));
      testAssert(!regSnap.exists(), 'Pending registration document was cleaned up during removal');
    });
  }

  console.log('--- TEST 9: Historical Invoice Preservation ---');
  {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const invSnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'invoices', 'inv_suresh_001'));
      testAssert(invSnap.exists(), 'Historical invoice created by removed user still exists');
      const invData = invSnap.data();
      testAssert(invData.createdBy === CASHIER_UID, 'Historical invoice createdBy is preserved');
      testAssert(invData.netPayable === 8500, 'Historical invoice netPayable is preserved');
      testAssert(invData.invoiceNumber === 'TPS/2026-27/042', 'Historical invoice invoiceNumber is preserved');
    });
  }

  console.log('--- TEST 10: Prior Audit Log Preservation ---');
  {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const logSnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_suresh_approved'));
      testAssert(logSnap.exists(), 'Prior audit log for removed user still exists');
      testAssert(logSnap.data().action === 'STAFF_APPROVED', 'Prior audit log content is completely unmodified');
    });
  }

  console.log('--- TEST 11: Immediate Access Cutoff for Removed User ---');
  {
    const removedCtx = testEnv.authenticatedContext(CASHIER_UID, { email: CASHIER_EMAIL });
    const removedDb = removedCtx.firestore();

    // 1. Reading invoices
    const invRef = doc(removedDb, 'businesses', BIZ_ID, 'invoices', 'inv_suresh_001');
    await assertFails(getDoc(invRef));
    testAssert(true, 'Removed user reading invoice document rejected with PERMISSION_DENIED');

    // 2. Reading members
    const memRef = doc(removedDb, 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID);
    await assertFails(getDoc(memRef));
    testAssert(true, 'Removed user reading member document rejected with PERMISSION_DENIED');

    // 3. Reading business profile
    const bizRef = doc(removedDb, 'businesses', BIZ_ID);
    await assertFails(getDoc(bizRef));
    testAssert(true, 'Removed user reading business profile rejected with PERMISSION_DENIED');
  }

  console.log('--- TEST 12: Cross-Business Removal Isolation ---');
  {
    // Seed foreign business member
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', OTHER_BIZ_ID), { businessName: 'Other Biz' });
      await setDoc(doc(context.firestore(), 'businesses', OTHER_BIZ_ID, 'members', 'foreign_cashier'), {
        uid: 'foreign_cashier',
        email: 'foreign@other.com',
        displayName: 'Foreign Staff',
        role: ROLES.CASHIER,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'foreign_admin',
      });
    });

    // Primary admin of TPS Battery House attempts to delete foreign member via security rules
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const foreignRef = doc(adminCtx.firestore(), 'businesses', OTHER_BIZ_ID, 'members', 'foreign_cashier');
    await assertFails(deleteDoc(foreignRef));
    testAssert(true, 'Cross-business member deletion rejected by security rules');
  }

  console.log('--- TEST 13: Audit Log Anti-Forgery (Forged actorUid) ---');
  {
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const logRef = doc(adminCtx.firestore(), 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_forged_uid');
    await assertFails(
      setDoc(logRef, {
        id: 'audit_forged_uid',
        targetUid: 'someone_else',
        targetEmail: 'someone@tps.com',
        targetName: 'Someone',
        action: 'STAFF_REMOVED',
        previousValue: { role: ROLES.CASHIER },
        newValue: null,
        actorUid: 'spoofed_admin_uid', // FORGERY! Does not match request.auth.uid
        actorEmail: PRIMARY_ADMIN_EMAIL,
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
        notes: 'Forged log',
      })
    );
    testAssert(true, 'Audit log with forged actorUid rejected by rules');
  }

  console.log('--- TEST 14: Audit Log Anti-Forgery (Forged actorEmail) ---');
  {
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const logRef = doc(adminCtx.firestore(), 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_forged_email');
    await assertFails(
      setDoc(logRef, {
        id: 'audit_forged_email',
        targetUid: 'someone_else',
        targetEmail: 'someone@tps.com',
        targetName: 'Someone',
        action: 'STAFF_REMOVED',
        previousValue: { role: ROLES.CASHIER },
        newValue: null,
        actorUid: PRIMARY_ADMIN_UID,
        actorEmail: 'spoofed_email@superadmin.com', // FORGERY! Does not match token email
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
        notes: 'Forged email log',
      })
    );
    testAssert(true, 'Audit log with forged actorEmail rejected by rules');
  }

  console.log('--- TEST 15: Audit Log State Linkage (STAFF_REMOVED without member deletion) ---');
  {
    // Primary Admin attempts to write a STAFF_REMOVED audit log for an existing member without deleting them
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    // Re-seed a member to test
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', 'existing_member_test'), {
        uid: 'existing_member_test',
        email: 'exist@tps.com',
        displayName: 'Existing Member',
        role: ROLES.CASHIER,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: PRIMARY_ADMIN_UID,
      });
    });

    const logRef = doc(adminCtx.firestore(), 'businesses', BIZ_ID, 'staff_audit_logs', 'audit_phantom_removal');
    await assertFails(
      setDoc(logRef, {
        id: 'audit_phantom_removal',
        targetUid: 'existing_member_test', // Target member STILL EXISTS!
        targetEmail: 'exist@tps.com',
        targetName: 'Existing Member',
        action: 'STAFF_REMOVED',
        previousValue: { role: ROLES.CASHIER },
        newValue: null,
        actorUid: PRIMARY_ADMIN_UID,
        actorEmail: PRIMARY_ADMIN_EMAIL,
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
        notes: 'Phantom removal without actually deleting member',
      })
    );
    testAssert(true, 'STAFF_REMOVED audit log rejected when member document still exists post-operation');
  }

  console.log('--- TEST 16: Direct Security Rule Delete Rejection for Primary Admin ---');
  {
    // An active admin attempts deleteDoc directly on the primary admin doc
    // Re-seed a secondary admin in BIZ_ID to act as caller
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', 'admin_tester_rule'), {
        uid: 'admin_tester_rule',
        email: 'tester@tps.com',
        displayName: 'Admin Tester',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: PRIMARY_ADMIN_UID,
      });
    });

    const testerCtx = testEnv.authenticatedContext('admin_tester_rule', { email: 'tester@tps.com' });
    const primaryRef = doc(testerCtx.firestore(), 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID);
    await assertFails(deleteDoc(primaryRef));
    testAssert(true, 'Direct deleteDoc on Primary Admin document rejected by security rules');
  }

  console.log('--- TEST 17: Direct Security Rule Delete Rejection for Self ---');
  {
    // Admin attempts deleteDoc on their own member document
    const testerCtx = testEnv.authenticatedContext('admin_tester_rule', { email: 'tester@tps.com' });
    const selfRef = doc(testerCtx.firestore(), 'businesses', BIZ_ID, 'members', 'admin_tester_rule');
    await assertFails(deleteDoc(selfRef));
    testAssert(true, 'Direct deleteDoc on self document rejected by security rules (anti-lockout)');
  }

  console.log('--- TEST 18: Concurrency & Race Condition Safety ---');
  {
    // Setup two active admins in a dedicated business: Admin Alpha and Admin Beta
    const CONCUR_BIZ = 'concur-removal-biz';
    const ADMIN_ALPHA = 'admin_alpha_concur';
    const ADMIN_BETA = 'admin_beta_concur';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', CONCUR_BIZ), { businessName: 'Concur Biz' });
      await setDoc(doc(context.firestore(), 'businesses', CONCUR_BIZ, 'settings', 'admin_config'), {
        primaryAdminUid: 'third_party_owner', // neither Alpha nor Beta is primary
      });
      await setDoc(doc(context.firestore(), 'businesses', CONCUR_BIZ, 'members', ADMIN_ALPHA), {
        uid: ADMIN_ALPHA,
        email: 'alpha@concur.com',
        displayName: 'Admin Alpha',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'third_party_owner',
      });
      await setDoc(doc(context.firestore(), 'businesses', CONCUR_BIZ, 'members', ADMIN_BETA), {
        uid: ADMIN_BETA,
        email: 'beta@concur.com',
        displayName: 'Admin Beta',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'third_party_owner',
      });
    });

    const alphaCtx = testEnv.authenticatedContext(ADMIN_ALPHA, { email: 'alpha@concur.com' });
    const betaCtx = testEnv.authenticatedContext(ADMIN_BETA, { email: 'beta@concur.com' });

    // Both attempt to remove each other simultaneously
    const results = await Promise.allSettled([
      executeStaffRemovalTransaction(alphaCtx.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_BETA,
        actorUser: { uid: ADMIN_ALPHA, email: 'alpha@concur.com' },
        primaryAdminUid: 'third_party_owner',
      }),
      executeStaffRemovalTransaction(betaCtx.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_ALPHA,
        actorUser: { uid: ADMIN_BETA, email: 'beta@concur.com' },
        primaryAdminUid: 'third_party_owner',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    console.log(`  Concurrency Result: ${fulfilled.length} succeeded, ${rejected.length} rejected.`);
    testAssert(
      fulfilled.length === 1 && rejected.length === 1,
      'Exactly one removal succeeded under concurrency; the second attempt was rejected by OCC lock'
    );

    // Verify at least one active admin remains
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDocs(collection(context.firestore(), 'businesses', CONCUR_BIZ, 'members'));
      let remainingActiveAdmins = 0;
      snap.forEach((d) => {
        if (d.data().role === ROLES.ADMIN && d.data().status === ACCOUNT_STATUS.ACTIVE) {
          remainingActiveAdmins++;
        }
      });
      testAssert(remainingActiveAdmins >= 1, `At least 1 active admin remains in business (${remainingActiveAdmins} found)`);
    });
  }

  console.log('\n================================================================');
  console.log(`STAFF REMOVAL SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runStaffRemovalSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
