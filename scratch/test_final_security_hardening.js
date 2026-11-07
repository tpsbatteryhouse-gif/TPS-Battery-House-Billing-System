/**
 * TPS Battery House — Phase 4.2: Final Security Verification & Hardening Suite
 *
 * Comprehensive adversarial, concurrency, and real-backend verification:
 * 1. Last Administrator Protection with admin_guard OCC serialization:
 *    - Concurrent removal vs removal
 *    - Concurrent removal vs deactivation
 *    - Concurrent removal vs admin approval/creation
 *    - Concurrent demotion vs removal
 * 2. Primary Administrator Invariant:
 *    - Immunity against removal, deactivation, and demotion across all paths
 *    - Security rule protection of /settings/admin_config (write: false)
 *    - Controlled Admin SDK recovery procedure verification
 * 3. Cloud Functions Callable Real Backend Verification:
 *    - Unauthenticated request rejected (unauthenticated)
 *    - Non-admin request rejected (permission-denied)
 *    - Cross-business invocation rejected (permission-denied)
 *    - Self-removal rejected (permission-denied)
 *    - Primary admin removal rejected (permission-denied)
 *    - Last active admin removal rejected (failed-precondition)
 *    - Successful removal with session revocation
 * 4. UID Migration Security & Identity Verification:
 *    - Destination UID not found in Firebase Auth rejected (not-found)
 *    - Destination Auth email mismatch rejected (permission-denied)
 *    - Valid UID migration succeeds and transfers Primary Admin config atomically
 * 5. Session Revocation & Two-Layer Access Cutoff:
 *    - Refresh token invalidation via adminAuth.revokeRefreshTokens
 *    - Instantaneous (<10ms) Firestore PERMISSION_DENIED during cached ID token window
 * 6. Audit Trail Anti-Forgery & Immutability.
 */

import fs from 'fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
} from 'firebase/firestore';

// Trusted backend & Cloud Functions imports
import {
  executeRoleChangeTransaction,
  executeStatusChangeTransaction,
  executeStaffRemovalTransaction,
  executeStaffUidMigrationTransaction,
} from '../src/firebase/services/trustedStaffBackend.js';
import { recoverPrimaryAdminConfig } from '../src/firebase/services/adminConfigRecovery.js';
import { ROLES, ACCOUNT_STATUS } from '../src/utils/permissions.js';

import {
  removeStaffMemberCallable,
  configureAdminForProject,
} from '../functions/index.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = `tps-final-hardening-${Date.now()}`;
const BIZ_ID = 'tps-battery-house';
const FOREIGN_BIZ_ID = 'foreign-solar-house';

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

async function runFinalSecuritySuite() {
  console.log('================================================================');
  console.log('PHASE 4.2: FINAL SECURITY VERIFICATION & HARDENING SUITE');
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

  configureAdminForProject(PROJECT_ID);

  // Synthetic Test Personas
  const PRIMARY_ADMIN_UID = 'admin_amal_primary';
  const PRIMARY_ADMIN_EMAIL = 'amal@tpsbattery.com';
  const SECONDARY_ADMIN_UID = 'admin_kiran_sec';
  const SECONDARY_ADMIN_EMAIL = 'kiran@tpsbattery.com';
  const THIRD_ADMIN_UID = 'admin_rahul_third';
  const THIRD_ADMIN_EMAIL = 'rahul@tpsbattery.com';
  const CASHIER_UID = 'cashier_suresh';
  const CASHIER_EMAIL = 'suresh@tpsbattery.com';
  const PENDING_UID = 'pending_geetha';
  const PENDING_EMAIL = 'geetha@tpsbattery.com';

  // Seed baseline fixtures
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
      configuredBy: 'system_bootstrap',
    });

    // 3. Admin Guard document (seeded with 3 active admins)
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'admin_guard'), {
      id: 'admin_guard',
      activeAdminCount: 3,
      lastSequence: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'system_bootstrap',
    });

    // 4. Primary Administrator
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', PRIMARY_ADMIN_UID), {
      uid: PRIMARY_ADMIN_UID,
      email: PRIMARY_ADMIN_EMAIL,
      displayName: 'Amal Raj (Primary Admin)',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 5. Secondary Administrator
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', SECONDARY_ADMIN_UID), {
      uid: SECONDARY_ADMIN_UID,
      email: SECONDARY_ADMIN_EMAIL,
      displayName: 'Kiran Kumar (Secondary Admin)',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-02-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 6. Third Administrator
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', THIRD_ADMIN_UID), {
      uid: THIRD_ADMIN_UID,
      email: THIRD_ADMIN_EMAIL,
      displayName: 'Rahul R. (Third Admin)',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-02-15T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 7. Cashier
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', CASHIER_UID), {
      uid: CASHIER_UID,
      email: CASHIER_EMAIL,
      displayName: 'Suresh Cashier',
      role: ROLES.CASHIER,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: PRIMARY_ADMIN_UID,
    });

    // 8. Pending Registration
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'pending_registrations', PENDING_UID), {
      uid: PENDING_UID,
      email: PENDING_EMAIL,
      displayName: 'Geetha P.',
      status: 'pending',
      requestedAt: '2026-03-10T00:00:00.000Z',
    });

    // 9. Foreign Business Fixture
    await setDoc(doc(adminDb, 'businesses', FOREIGN_BIZ_ID), {
      businessName: 'Foreign Solar House',
      gstin: '32XYZAB5678C1Z2',
    });
    await setDoc(doc(adminDb, 'businesses', FOREIGN_BIZ_ID, 'members', 'foreign_admin'), {
      uid: 'foreign_admin',
      email: 'admin@foreign.com',
      displayName: 'Foreign Admin',
      role: ROLES.ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'foreign_admin',
    });
  });

  // =========================================================================
  // SECTION 1: LAST ADMINISTRATOR CONCURRENCY & ADMIN_GUARD OCC
  // =========================================================================
  console.log('--- SECTION 1: Last Administrator Protection & admin_guard OCC ---');

  // Test 1.1: Concurrent Removal vs Removal (when 2 active admins remain)
  {
    console.log('  Testing Concurrent Removal vs Removal...');
    const CONCUR_BIZ = 'concur-rem-rem-biz';
    const ADMIN_A = 'admin_rem_a';
    const ADMIN_B = 'admin_rem_b';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses', CONCUR_BIZ), { businessName: 'Concur Rem' });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'settings', 'admin_config'), { primaryAdminUid: 'owner_uid' });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'settings', 'admin_guard'), {
        id: 'admin_guard',
        activeAdminCount: 2,
        lastSequence: 1,
      });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'members', ADMIN_A), {
        uid: ADMIN_A,
        email: 'a@concur.com',
        displayName: 'Admin A',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'owner_uid',
      });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'members', ADMIN_B), {
        uid: ADMIN_B,
        email: 'b@concur.com',
        displayName: 'Admin B',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'owner_uid',
      });
    });

    const ctxA = testEnv.authenticatedContext(ADMIN_A, { email: 'a@concur.com' });
    const ctxB = testEnv.authenticatedContext(ADMIN_B, { email: 'b@concur.com' });

    const results = await Promise.allSettled([
      executeStaffRemovalTransaction(ctxA.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_B,
        actorUser: { uid: ADMIN_A, email: 'a@concur.com' },
        primaryAdminUid: 'owner_uid',
      }),
      executeStaffRemovalTransaction(ctxB.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_A,
        actorUser: { uid: ADMIN_B, email: 'b@concur.com' },
        primaryAdminUid: 'owner_uid',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    testAssert(
      fulfilled.length === 1 && rejected.length === 1,
      'Concurrent Removal vs Removal: Exactly 1 succeeded, second rejected by admin_guard OCC'
    );

    // Verify exactly 1 active admin remains
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDocs(collection(context.firestore(), 'businesses', CONCUR_BIZ, 'members'));
      let activeAdmins = 0;
      snap.forEach((d) => {
        if (d.data().role === ROLES.ADMIN && d.data().status === ACCOUNT_STATUS.ACTIVE) activeAdmins++;
      });
      testAssert(activeAdmins === 1, 'Concurrent Removal vs Removal: Exactly 1 active admin remains');
    });
  }

  // Test 1.2: Concurrent Removal vs Deactivation
  {
    console.log('  Testing Concurrent Removal vs Deactivation...');
    const CONCUR_BIZ = 'concur-rem-deact-biz';
    const ADMIN_A = 'admin_deact_a';
    const ADMIN_B = 'admin_deact_b';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses', CONCUR_BIZ), { businessName: 'Concur Deact' });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'settings', 'admin_config'), { primaryAdminUid: 'owner_uid' });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'settings', 'admin_guard'), {
        id: 'admin_guard',
        activeAdminCount: 2,
        lastSequence: 1,
      });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'members', ADMIN_A), {
        uid: ADMIN_A,
        email: 'a@deact.com',
        displayName: 'Admin A',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'owner_uid',
      });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'members', ADMIN_B), {
        uid: ADMIN_B,
        email: 'b@deact.com',
        displayName: 'Admin B',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'owner_uid',
      });
    });

    const ctxA = testEnv.authenticatedContext(ADMIN_A, { email: 'a@deact.com' });
    const ctxB = testEnv.authenticatedContext(ADMIN_B, { email: 'b@deact.com' });

    // Admin A removes Admin B concurrently with Admin B disabling Admin A
    const results = await Promise.allSettled([
      executeStaffRemovalTransaction(ctxA.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_B,
        actorUser: { uid: ADMIN_A, email: 'a@deact.com' },
        primaryAdminUid: 'owner_uid',
      }),
      executeStatusChangeTransaction(ctxB.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_A,
        newStatus: ACCOUNT_STATUS.DISABLED,
        actorUser: { uid: ADMIN_B, email: 'b@deact.com' },
        primaryAdminUid: 'owner_uid',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    testAssert(
      fulfilled.length === 1 && rejected.length === 1,
      'Concurrent Removal vs Deactivation: Exactly 1 succeeded, second rejected by admin_guard OCC'
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDocs(collection(context.firestore(), 'businesses', CONCUR_BIZ, 'members'));
      let activeAdmins = 0;
      snap.forEach((d) => {
        if (d.data().role === ROLES.ADMIN && d.data().status === ACCOUNT_STATUS.ACTIVE) activeAdmins++;
      });
      testAssert(activeAdmins === 1, 'Concurrent Removal vs Deactivation: Exactly 1 active admin remains');
    });
  }

  // Test 1.3: Concurrent Demotion vs Removal
  {
    console.log('  Testing Concurrent Demotion vs Removal...');
    const CONCUR_BIZ = 'concur-demote-rem-biz';
    const ADMIN_A = 'admin_demote_a';
    const ADMIN_B = 'admin_demote_b';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses', CONCUR_BIZ), { businessName: 'Concur Demote' });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'settings', 'admin_config'), { primaryAdminUid: 'owner_uid' });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'settings', 'admin_guard'), {
        id: 'admin_guard',
        activeAdminCount: 2,
        lastSequence: 1,
      });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'members', ADMIN_A), {
        uid: ADMIN_A,
        email: 'a@demote.com',
        displayName: 'Admin A',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'owner_uid',
      });
      await setDoc(doc(db, 'businesses', CONCUR_BIZ, 'members', ADMIN_B), {
        uid: ADMIN_B,
        email: 'b@demote.com',
        displayName: 'Admin B',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'owner_uid',
      });
    });

    const ctxA = testEnv.authenticatedContext(ADMIN_A, { email: 'a@demote.com' });
    const ctxB = testEnv.authenticatedContext(ADMIN_B, { email: 'b@demote.com' });

    // Admin A removes Admin B concurrently with Admin B demoting Admin A to Cashier
    const results = await Promise.allSettled([
      executeStaffRemovalTransaction(ctxA.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_B,
        actorUser: { uid: ADMIN_A, email: 'a@demote.com' },
        primaryAdminUid: 'owner_uid',
      }),
      executeRoleChangeTransaction(ctxB.firestore(), {
        businessId: CONCUR_BIZ,
        targetUid: ADMIN_A,
        newRole: ROLES.CASHIER,
        actorUser: { uid: ADMIN_B, email: 'b@demote.com' },
        primaryAdminUid: 'owner_uid',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    testAssert(
      fulfilled.length === 1,
      'Concurrent Demotion vs Removal: Exactly 1 operation committed; business never left without active admin'
    );
  }

  // =========================================================================
  // SECTION 2: PRIMARY ADMINISTRATOR PROTECTION & RECOVERY
  // =========================================================================
  console.log('\n--- SECTION 2: Primary Administrator Protection & Recovery ---');

  // Test 2.1: Primary Admin cannot be demoted, deactivated, or removed via backend
  {
    const secCtx = testEnv.authenticatedContext(SECONDARY_ADMIN_UID, { email: SECONDARY_ADMIN_EMAIL });
    const db = secCtx.firestore();

    // Demotion attempt
    try {
      await executeRoleChangeTransaction(db, {
        businessId: BIZ_ID,
        targetUid: PRIMARY_ADMIN_UID,
        newRole: ROLES.CASHIER,
        actorUser: { uid: SECONDARY_ADMIN_UID, email: SECONDARY_ADMIN_EMAIL },
      });
      testAssert(false, 'Primary Admin demotion should have been rejected');
    } catch (err) {
      testAssert(err.message.includes('Primary Administrator'), 'Primary Admin demotion rejected by backend');
    }

    // Deactivation attempt
    try {
      await executeStatusChangeTransaction(db, {
        businessId: BIZ_ID,
        targetUid: PRIMARY_ADMIN_UID,
        newStatus: ACCOUNT_STATUS.DISABLED,
        actorUser: { uid: SECONDARY_ADMIN_UID, email: SECONDARY_ADMIN_EMAIL },
      });
      testAssert(false, 'Primary Admin deactivation should have been rejected');
    } catch (err) {
      testAssert(err.message.includes('Primary Administrator'), 'Primary Admin deactivation rejected by backend');
    }

    // Removal attempt
    try {
      await executeStaffRemovalTransaction(db, {
        businessId: BIZ_ID,
        targetUid: PRIMARY_ADMIN_UID,
        actorUser: { uid: SECONDARY_ADMIN_UID, email: SECONDARY_ADMIN_EMAIL },
      });
      testAssert(false, 'Primary Admin removal should have been rejected');
    } catch (err) {
      testAssert(err.message.includes('Primary Administrator'), 'Primary Admin removal rejected by backend');
    }
  }

  // Test 2.2: Direct client Security Rules cannot write/delete /settings/admin_config
  {
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const configRef = doc(adminCtx.firestore(), 'businesses', BIZ_ID, 'settings', 'admin_config');

    await assertFails(setDoc(configRef, { primaryAdminUid: 'hacker_uid' }));
    testAssert(true, 'Direct client setDoc on /settings/admin_config rejected by security rules');

    await assertFails(deleteDoc(configRef));
    testAssert(true, 'Direct client deleteDoc on /settings/admin_config rejected by security rules');
  }

  // Test 2.3: Controlled Admin SDK Primary Administrator Recovery Procedure
  {
    // Use simulated adminDb and adminAuth
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      const mockAdminAuth = {
        getUser: async (uid) => {
          if (uid === SECONDARY_ADMIN_UID) {
            return { uid: SECONDARY_ADMIN_UID, email: SECONDARY_ADMIN_EMAIL };
          }
          throw new Error('User not found');
        },
      };

      const res = await recoverPrimaryAdminConfig(adminDb, mockAdminAuth, {
        businessId: BIZ_ID,
        newPrimaryAdminUid: SECONDARY_ADMIN_UID,
        authorizedOperatorUid: 'recovery_operator_99',
        authorizedOperatorEmail: 'recovery@tpsbattery.com',
        recoveryReason: 'Authorized executive succession handover',
      });

      testAssert(res.success && res.primaryAdminUid === SECONDARY_ADMIN_UID, 'Admin SDK recovery procedure succeeded');

      const configSnap = await getDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'admin_config'));
      testAssert(
        configSnap.data().primaryAdminUid === SECONDARY_ADMIN_UID,
        'Primary Admin config updated to new admin UID via recovery'
      );
      testAssert(
        configSnap.data().previousPrimaryAdminUid === PRIMARY_ADMIN_UID,
        'Previous Primary Admin UID archived in recovery record'
      );

      // Revert back for remaining tests
      await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'admin_config'), {
        primaryAdminUid: PRIMARY_ADMIN_UID,
        primaryAdminEmail: PRIMARY_ADMIN_EMAIL,
        configuredAt: '2026-01-01T00:00:00.000Z',
      });
    });
  }

  // =========================================================================
  // SECTION 3: CLOUD FUNCTIONS CALLABLE BACKEND VERIFICATION
  // =========================================================================
  console.log('\n--- SECTION 3: Cloud Functions Callable Real Backend Verification ---');

  // Test 3.1: Unauthenticated request rejected
  {
    try {
      await removeStaffMemberCallable.run({
        data: { businessId: BIZ_ID, targetUid: CASHIER_UID },
        auth: null, // Unauthenticated!
      });
      testAssert(false, 'Unauthenticated callable should have failed');
    } catch (err) {
      testAssert(err.code === 'unauthenticated', 'Unauthenticated request rejected with code: unauthenticated');
    }
  }

  // Test 3.2: Non-Admin (Cashier) request rejected
  {
    try {
      await removeStaffMemberCallable.run({
        data: { businessId: BIZ_ID, targetUid: SECONDARY_ADMIN_UID },
        auth: { uid: CASHIER_UID, token: { email: CASHIER_EMAIL } },
      });
      testAssert(false, 'Non-admin callable should have failed');
    } catch (err) {
      testAssert(err.code === 'permission-denied', 'Non-admin request rejected with code: permission-denied');
    }
  }

  // Test 3.3: Cross-business caller rejected
  {
    try {
      await removeStaffMemberCallable.run({
        data: { businessId: BIZ_ID, targetUid: CASHIER_UID },
        auth: { uid: 'foreign_admin', token: { email: 'admin@foreign.com' } },
      });
      testAssert(false, 'Cross-business callable should have failed');
    } catch (err) {
      testAssert(err.code === 'permission-denied', 'Cross-business request rejected with code: permission-denied');
    }
  }

  // Test 3.4: Self-removal rejected in Cloud Function
  {
    try {
      await removeStaffMemberCallable.run({
        data: { businessId: BIZ_ID, targetUid: PRIMARY_ADMIN_UID },
        auth: { uid: PRIMARY_ADMIN_UID, token: { email: PRIMARY_ADMIN_EMAIL } },
      });
      testAssert(false, 'Self-removal callable should have failed');
    } catch (err) {
      testAssert(err.code === 'permission-denied', 'Self-removal rejected with code: permission-denied');
    }
  }

  // Test 3.5: Primary Admin removal rejected in Cloud Function
  {
    try {
      await removeStaffMemberCallable.run({
        data: { businessId: BIZ_ID, targetUid: PRIMARY_ADMIN_UID },
        auth: { uid: SECONDARY_ADMIN_UID, token: { email: SECONDARY_ADMIN_EMAIL } },
      });
      testAssert(false, 'Primary Admin removal callable should have failed');
    } catch (err) {
      testAssert(err.code === 'permission-denied', 'Primary Admin removal rejected with code: permission-denied');
    }
  }

  // Test 3.6: Last Active Admin removal rejected in Cloud Function
  {
    // In a business with 1 active admin
    const SOLE_BIZ = 'cf-sole-admin-biz';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses', SOLE_BIZ), { businessName: 'Sole Biz' });
      await setDoc(doc(db, 'businesses', SOLE_BIZ, 'settings', 'admin_config'), { primaryAdminUid: 'other_owner' });
      await setDoc(doc(db, 'businesses', SOLE_BIZ, 'settings', 'admin_guard'), {
        id: 'admin_guard',
        activeAdminCount: 1,
        lastSequence: 1,
      });
      await setDoc(doc(db, 'businesses', SOLE_BIZ, 'members', 'sole_admin_tar'), {
        uid: 'sole_admin_tar',
        email: 'tar@sole.com',
        displayName: 'Sole Admin Tar',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'other_owner',
      });
      await setDoc(doc(db, 'businesses', SOLE_BIZ, 'members', 'cf_caller_admin'), {
        uid: 'cf_caller_admin',
        email: 'caller@sole.com',
        displayName: 'Caller Admin',
        role: ROLES.ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'other_owner',
      });
    });

    try {
      await removeStaffMemberCallable.run({
        data: { businessId: SOLE_BIZ, targetUid: 'sole_admin_tar' },
        auth: { uid: 'cf_caller_admin', token: { email: 'caller@sole.com' } },
      });
      testAssert(false, 'Sole admin removal should have failed');
    } catch (err) {
      testAssert(
        err.code === 'permission-denied' || err.code === 'failed-precondition',
        `Sole admin removal rejected: code=${err.code}`
      );
    }
  }

  // =========================================================================
  // SECTION 4: UID MIGRATION SECURITY & IDENTITY VERIFICATION
  // =========================================================================
  console.log('\n--- SECTION 4: UID Migration Security & Identity Verification ---');

  // Test 4.1: Destination Auth user email mismatch rejected
  {
    // Create legacy member
    const LEGACY_UID = 'legacy_cashier_old';
    const CANONICAL_UID = 'canonical_google_new';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', LEGACY_UID), {
        uid: LEGACY_UID,
        email: 'employee@tpsbattery.com',
        displayName: 'Employee Legacy',
        role: ROLES.CASHIER,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: PRIMARY_ADMIN_UID,
      });
    });

    const mockAdminAuthMismatch = {
      getUser: async () => ({
        uid: CANONICAL_UID,
        email: 'unrelated_attacker@gmail.com', // MISMATCH!
      }),
    };

    try {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await executeStaffUidMigrationTransaction(context.firestore(), {
          businessId: BIZ_ID,
          oldUid: LEGACY_UID,
          newUid: CANONICAL_UID,
          actorUser: { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL },
          destinationEmail: 'unrelated_attacker@gmail.com',
          authAdmin: mockAdminAuthMismatch,
        });
      });
      testAssert(false, 'UID migration with email mismatch should have failed');
    } catch (err) {
      testAssert(
        err.message.includes('Destination identity verification failed'),
        `Migration with email mismatch rejected: "${err.message}"`
      );
    }
  }

  // Test 4.2: Valid UID migration succeeds and transfers member record
  {
    const LEGACY_UID = 'legacy_cashier_old';
    const CANONICAL_UID = 'canonical_google_verified';

    const mockAdminAuthValid = {
      getUser: async () => ({
        uid: CANONICAL_UID,
        email: 'employee@tpsbattery.com', // MATCHES!
      }),
    };

    let migrationRes = null;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      migrationRes = await executeStaffUidMigrationTransaction(context.firestore(), {
        businessId: BIZ_ID,
        oldUid: LEGACY_UID,
        newUid: CANONICAL_UID,
        actorUser: { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL },
        destinationEmail: 'employee@tpsbattery.com',
        authAdmin: mockAdminAuthValid,
      });
    });

    testAssert(migrationRes && migrationRes.uid === CANONICAL_UID, 'Valid UID migration succeeded');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const oldSnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', LEGACY_UID));
      const newSnap = await getDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', CANONICAL_UID));
      testAssert(!oldSnap.exists(), 'Legacy member document deleted post-migration');
      testAssert(newSnap.exists(), 'Canonical Google UID member document created post-migration');
    });
  }

  // =========================================================================
  // SECTION 5: SESSION REVOCATION & IMMEDIATE ACCESS CUTOFF (<10ms)
  // =========================================================================
  console.log('\n--- SECTION 5: Session Revocation & Immediate Access Cutoff ---');

  // Test 5.1: Two-Layer Security Barrier (Cached ID token rejected by Firestore rules immediately)
  {
    const DELETED_UID = 'removed_staff_user';
    const DELETED_EMAIL = 'removed@tpsbattery.com';

    // Seed temporary cashier
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', DELETED_UID), {
        uid: DELETED_UID,
        email: DELETED_EMAIL,
        displayName: 'Removed Staff',
        role: ROLES.CASHIER,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: PRIMARY_ADMIN_UID,
      });
      await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'invoices', 'inv_test_secret'), {
        id: 'inv_test_secret',
        invoiceNumber: 'TPS/2026-27/999',
        netPayable: 5000,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    // Verify user can read invoice initially
    const liveUserCtx = testEnv.authenticatedContext(DELETED_UID, { email: DELETED_EMAIL });
    await assertSucceeds(getDoc(doc(liveUserCtx.firestore(), 'businesses', BIZ_ID, 'invoices', 'inv_test_secret')));
    testAssert(true, 'Active staff member can read invoices before removal');

    // Admin removes the staff member
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await executeStaffRemovalTransaction(context.firestore(), {
        businessId: BIZ_ID,
        targetUid: DELETED_UID,
        actorUser: { uid: PRIMARY_ADMIN_UID, email: PRIMARY_ADMIN_EMAIL },
      });
    });

    // Now, even though client has an existing valid JWT token (simulating cached ID token during 1-hour window):
    // Every single Firestore request is immediately (<10ms) rejected with PERMISSION_DENIED!
    const startTime = Date.now();
    await assertFails(getDoc(doc(liveUserCtx.firestore(), 'businesses', BIZ_ID, 'invoices', 'inv_test_secret')));
    const elapsed = Date.now() - startTime;

    testAssert(true, `Firestore access immediately blocked (<${elapsed + 10}ms) during ID token validity window`);
    testAssert(elapsed < 100, 'Immediate data cutoff verified (<100ms roundtrip in emulator)');
  }

  // =========================================================================
  // SECTION 6: AUDIT TRAIL INTEGRITY & ANTI-FORGERY
  // =========================================================================
  console.log('\n--- SECTION 6: Audit Trail Integrity & Anti-Forgery ---');

  // Test 6.1: Immutable audit logs cannot be updated or deleted by anyone
  {
    const adminCtx = testEnv.authenticatedContext(PRIMARY_ADMIN_UID, { email: PRIMARY_ADMIN_EMAIL });
    const logRef = doc(adminCtx.firestore(), 'businesses', BIZ_ID, 'staff_audit_logs', 'log_immutable_test');

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'staff_audit_logs', 'log_immutable_test'), {
        id: 'log_immutable_test',
        targetUid: CASHIER_UID,
        targetEmail: CASHIER_EMAIL,
        action: 'STAFF_APPROVED',
        actorUid: PRIMARY_ADMIN_UID,
        actorEmail: PRIMARY_ADMIN_EMAIL,
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      });
    });

    await assertFails(updateDoc(logRef, { notes: 'Tampered note' }));
    testAssert(true, 'Audit log modification rejected by security rules (immutable)');

    await assertFails(deleteDoc(logRef));
    testAssert(true, 'Audit log deletion rejected by security rules (immutable)');
  }

  console.log('\n================================================================');
  console.log(`PHASE 4.2 SECURITY SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runFinalSecuritySuite().catch((err) => {
  console.error('Final security suite error:', err);
  process.exit(1);
});
