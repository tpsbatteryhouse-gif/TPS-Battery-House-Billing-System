/**
 * Comprehensive Real Firebase Functions Emulator Verification Suite
 * Phase 5.1 Release Gate
 *
 * Connects directly to real Firebase Functions Emulator (port 5001),
 * Auth Emulator (port 9099), and Firestore Emulator (port 8980).
 * Uses real Firebase Client SDK httpsCallable() for all assertions.
 */

import { initializeApp as initAdminApp } from '../functions/node_modules/firebase-admin/lib/app/index.js';
import { getAuth as getAdminAuth } from '../functions/node_modules/firebase-admin/lib/auth/index.js';
import { getFirestore as getAdminFirestore } from '../functions/node_modules/firebase-admin/lib/firestore/index.js';
import { initializeApp as initClientApp } from 'firebase/app';
import { getAuth as getClientAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const projectId = 'demo-tps-battery-house';
const businessId = 'tps-battery-house';

process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8980';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

console.log('=== STARTING REAL FUNCTIONS EMULATOR COMPREHENSIVE TEST SUITE ===');

// Setup Admin SDK
const adminApp = initAdminApp({ projectId }, 'admin-suite');
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

// Setup Client Apps
const adminClientApp = initClientApp({ apiKey: 'fake-api-key', projectId }, 'client-admin');
const adminClientAuth = getClientAuth(adminClientApp);
connectAuthEmulator(adminClientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const adminClientFunctions = getFunctions(adminClientApp, 'us-central1');
connectFunctionsEmulator(adminClientFunctions, '127.0.0.1', 5001);

const cashierClientApp = initClientApp({ apiKey: 'fake-api-key', projectId }, 'client-cashier');
const cashierClientAuth = getClientAuth(cashierClientApp);
connectAuthEmulator(cashierClientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const cashierClientFunctions = getFunctions(cashierClientApp, 'us-central1');
connectFunctionsEmulator(cashierClientFunctions, '127.0.0.1', 5001);

const managerClientApp = initClientApp({ apiKey: 'fake-api-key', projectId }, 'client-manager');
const managerClientAuth = getClientAuth(managerClientApp);
connectAuthEmulator(managerClientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const managerClientFunctions = getFunctions(managerClientApp, 'us-central1');
connectFunctionsEmulator(managerClientFunctions, '127.0.0.1', 5001);

const disabledClientApp = initClientApp({ apiKey: 'fake-api-key', projectId }, 'client-disabled');
const disabledClientAuth = getClientAuth(disabledClientApp);
connectAuthEmulator(disabledClientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const disabledClientFunctions = getFunctions(disabledClientApp, 'us-central1');
connectFunctionsEmulator(disabledClientFunctions, '127.0.0.1', 5001);

const unauthClientApp = initClientApp({ apiKey: 'fake-api-key', projectId }, 'client-unauth-suite');
const unauthClientFunctions = getFunctions(unauthClientApp, 'us-central1');
connectFunctionsEmulator(unauthClientFunctions, '127.0.0.1', 5001);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ✖ [FAIL] ${message}`);
  }
}

async function assertRejection(promise, expectedCode, testName) {
  totalTests++;
  try {
    await promise;
    failedTests++;
    console.error(`  ✖ [FAIL] ${testName}: Expected rejection with ${expectedCode}, but resolved!`);
  } catch (err) {
    const codeMatches = err.code?.includes(expectedCode) || err.message?.includes(expectedCode);
    if (codeMatches) {
      passedTests++;
      console.log(`  ✔ [PASS] ${testName} (Rejected as expected: ${err.code})`);
    } else {
      failedTests++;
      console.error(`  ✖ [FAIL] ${testName}: Expected ${expectedCode}, but received ${err.code} (${err.message})`);
    }
  }
}

// User IDs
const adminUid1 = 'admin-user-alpha';
const adminUid2 = 'admin-user-beta';
const cashierUid = 'cashier-user-1';
const managerUid = 'manager-user-1';
const disabledUid = 'disabled-user-1';
const targetUser1 = 'target-user-test-1';
const targetUser2 = 'target-user-test-2';

async function seedData() {
  console.log('\n--- SEEDING AUTH USERS & FIRESTORE FIXTURES ---');
  for (const uid of [adminUid1, adminUid2, cashierUid, managerUid, disabledUid, targetUser1, targetUser2]) {
    try {
      await adminAuth.createUser({ uid, email: `${uid}@tps.com` });
    } catch {
      // User exists
    }
  }

  // Legacy staff member (exists in Firestore, but Google Auth gave them a new canonical UID)
  const legacyStaffUid = 'legacy-staff-uid-999';
  const canonicalGoogleUid = 'canonical-google-uid-1';
  const migrationEmail = 'migration-test@tps.com';

  await adminDb.doc(`businesses/${businessId}/members/${legacyStaffUid}`).set({
    email: migrationEmail,
    name: 'Migrating Staff Member',
    role: 'manager',
    status: 'active',
    createdAt: new Date().toISOString()
  });

  try {
    await adminAuth.createUser({ uid: canonicalGoogleUid, email: migrationEmail });
  } catch {
    // User exists
  }

  // Create rogue destination user with MISMATCHED email for security test
  const rogueDestUid = 'rogue-dest-uid-999';
  try {
    await adminAuth.createUser({ uid: rogueDestUid, email: 'attacker@evil.com' });
  } catch {
    // User exists
  }

  // Admin 1 (Primary Admin)
  await adminDb.doc(`businesses/${businessId}/members/${adminUid1}`).set({
    email: `${adminUid1}@tps.com`,
    name: 'Primary Admin',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  });

  // Admin 2 (Secondary Admin)
  await adminDb.doc(`businesses/${businessId}/members/${adminUid2}`).set({
    email: `${adminUid2}@tps.com`,
    name: 'Secondary Admin',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString()
  });

  // Cashier
  await adminDb.doc(`businesses/${businessId}/members/${cashierUid}`).set({
    email: `${cashierUid}@tps.com`,
    name: 'Cashier Staff',
    role: 'cashier',
    status: 'active',
    createdAt: new Date().toISOString()
  });

  // Manager
  await adminDb.doc(`businesses/${businessId}/members/${managerUid}`).set({
    email: `${managerUid}@tps.com`,
    name: 'Branch Manager',
    role: 'manager',
    status: 'active',
    createdAt: new Date().toISOString()
  });

  // Disabled Admin
  await adminDb.doc(`businesses/${businessId}/members/${disabledUid}`).set({
    email: `${disabledUid}@tps.com`,
    name: 'Disabled Admin',
    role: 'admin',
    status: 'disabled',
    createdAt: new Date().toISOString()
  });

  // Pending Registration for targetUser1
  await adminDb.doc(`businesses/${businessId}/pending_registrations/${targetUser1}`).set({
    uid: targetUser1,
    email: `${targetUser1}@tps.com`,
    displayName: 'Pending Staff 1',
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  // Pending Registration for targetUser2
  await adminDb.doc(`businesses/${businessId}/pending_registrations/${targetUser2}`).set({
    uid: targetUser2,
    email: `${targetUser2}@tps.com`,
    displayName: 'Pending Staff 2',
    status: 'pending',
    createdAt: new Date().toISOString()
  });

  // admin_config (Primary Admin = adminUid1)
  await adminDb.doc(`businesses/${businessId}/settings/admin_config`).set({
    primaryAdminUid: adminUid1,
    primaryAdminEmail: `${adminUid1}@tps.com`,
    configuredAt: new Date().toISOString()
  });

  // admin_guard (2 active admins initially)
  await adminDb.doc(`businesses/${businessId}/settings/admin_guard`).set({
    id: 'admin_guard',
    version: 1,
    activeAdminCount: 2,
    lastSequence: 1,
    updatedAt: new Date().toISOString()
  });

  // Sign in each client SDK
  const adminToken = await adminAuth.createCustomToken(adminUid1);
  await signInWithCustomToken(adminClientAuth, adminToken);

  const cashierToken = await adminAuth.createCustomToken(cashierUid);
  await signInWithCustomToken(cashierClientAuth, cashierToken);

  const managerToken = await adminAuth.createCustomToken(managerUid);
  await signInWithCustomToken(managerClientAuth, managerToken);

  const disabledToken = await adminAuth.createCustomToken(disabledUid);
  await signInWithCustomToken(disabledClientAuth, disabledToken);

  console.log('✔ All client SDKs signed in with real tokens.');
}

async function runTestSuite() {
  await seedData();

  console.log('\n--- 1. UNAUTHENTICATED REQUEST TESTS ---');
  const allFunctionNames = [
    'approveStaffMemberCallable',
    'rejectStaffRegistrationCallable',
    'updateStaffRoleCallable',
    'updateStaffStatusCallable',
    'removeStaffMemberCallable',
    'revokeStaffSessionCallable',
    'migrateStaffMemberUidCallable'
  ];

  for (const fnName of allFunctionNames) {
    const fn = httpsCallable(unauthClientFunctions, fnName);
    await assertRejection(
      fn({ businessId, targetUid: targetUser1 }),
      'unauthenticated',
      `Unauthenticated call to ${fnName}`
    );
  }

  console.log('\n--- 2. CASHIER ROLE REJECTION TESTS ---');
  for (const fnName of allFunctionNames) {
    const fn = httpsCallable(cashierClientFunctions, fnName);
    await assertRejection(
      fn({ businessId, targetUid: targetUser1, role: 'cashier', newRole: 'manager', newStatus: 'disabled' }),
      'permission-denied',
      `Cashier invocation of ${fnName}`
    );
  }

  console.log('\n--- 3. MANAGER ROLE REJECTION TESTS ---');
  for (const fnName of allFunctionNames) {
    const fn = httpsCallable(managerClientFunctions, fnName);
    await assertRejection(
      fn({ businessId, targetUid: targetUser1, role: 'cashier', newRole: 'admin', newStatus: 'disabled' }),
      'permission-denied',
      `Manager invocation of ${fnName}`
    );
  }

  console.log('\n--- 4. DISABLED STAFF REJECTION TESTS ---');
  for (const fnName of allFunctionNames) {
    const fn = httpsCallable(disabledClientFunctions, fnName);
    await assertRejection(
      fn({ businessId, targetUid: targetUser1, role: 'cashier' }),
      'permission-denied',
      `Disabled Admin invocation of ${fnName}`
    );
  }

  console.log('\n--- 5. MALFORMED PAYLOAD AND INVALID ARGUMENT TESTS ---');
  const updateRoleAdmin = httpsCallable(adminClientFunctions, 'updateStaffRoleCallable');
  await assertRejection(
    updateRoleAdmin({}),
    'invalid-argument',
    'updateStaffRoleCallable with empty payload'
  );
  await assertRejection(
    updateRoleAdmin({ businessId, targetUid: targetUser1, newRole: 'super_hacker' }),
    'invalid-argument',
    'updateStaffRoleCallable with invalid role value'
  );

  const updateStatusAdmin = httpsCallable(adminClientFunctions, 'updateStaffStatusCallable');
  await assertRejection(
    updateStatusAdmin({ businessId, targetUid: targetUser1, newStatus: 'super_active' }),
    'invalid-argument',
    'updateStaffStatusCallable with invalid status value'
  );

  console.log('\n--- 6. INVALID BUSINESS ID TESTS ---');
  await assertRejection(
    updateRoleAdmin({ businessId: 'non-existent-business-999', targetUid: targetUser1, newRole: 'manager' }),
    'permission-denied',
    'Invocation with non-existent business ID'
  );

  console.log('\n--- 7. VALID AUTHENTICATED ADMIN REQUESTS ---');
  // A. Approve staff member
  const approveAdmin = httpsCallable(adminClientFunctions, 'approveStaffMemberCallable');
  const approveRes = await approveAdmin({
    businessId,
    targetUid: targetUser1,
    role: 'cashier'
  });
  assert(approveRes.data?.success === true, 'approveStaffMemberCallable successfully approved pending member');

  const approvedDoc = await adminDb.doc(`businesses/${businessId}/members/${targetUser1}`).get();
  assert(approvedDoc.data().status === 'active', 'Target member status set to active');
  assert(approvedDoc.data().role === 'cashier', 'Target member role set to cashier');

  // B. Reject staff registration
  const rejectAdmin = httpsCallable(adminClientFunctions, 'rejectStaffRegistrationCallable');
  const rejectRes = await rejectAdmin({
    businessId,
    targetUid: targetUser2,
    rejectionReason: 'Rejected during testing'
  });
  assert(rejectRes.data?.success === true, 'rejectStaffRegistrationCallable succeeded');
  const rejectedReg = await adminDb.doc(`businesses/${businessId}/pending_registrations/${targetUser2}`).get();
  assert(rejectedReg.data().status === 'rejected', 'Pending registration status set to rejected');

  // C. Update staff role
  const roleRes = await updateRoleAdmin({
    businessId,
    targetUid: targetUser1,
    newRole: 'manager',
    reason: 'Promoted to manager'
  });
  assert(roleRes.data?.success === true, 'updateStaffRoleCallable promoted staff to manager');
  const roleDoc = await adminDb.doc(`businesses/${businessId}/members/${targetUser1}`).get();
  assert(roleDoc.data().role === 'manager', 'Firestore member document reflects role manager');

  // D. Update staff status (disable)
  const statusRes = await updateStatusAdmin({
    businessId,
    targetUid: targetUser1,
    newStatus: 'disabled',
    reason: 'Temporary suspension'
  });
  assert(statusRes.data?.success === true, 'updateStaffStatusCallable disabled manager account');
  const statusDoc = await adminDb.doc(`businesses/${businessId}/members/${targetUser1}`).get();
  assert(statusDoc.data().status === 'disabled', 'Firestore member document reflects status disabled');

  // Re-enable targetUser1
  await updateStatusAdmin({ businessId, targetUid: targetUser1, newStatus: 'active' });

  // E. Revoke staff session
  const revokeAdmin = httpsCallable(adminClientFunctions, 'revokeStaffSessionCallable');
  const revokeRes = await revokeAdmin({
    businessId,
    targetUid: targetUser1
  });
  assert(revokeRes.data?.success === true, 'revokeStaffSessionCallable succeeded');

  console.log('\n--- 8. LAST ADMINISTRATOR PROTECTION TESTS ---');
  // Target is adminUid2 (Secondary Admin). AdminUid1 removes AdminUid2 -> should succeed because 2 admins exist.
  const removeAdmin = httpsCallable(adminClientFunctions, 'removeStaffMemberCallable');
  const removeBetaRes = await removeAdmin({
    businessId,
    targetUid: adminUid2,
    notes: 'Removed secondary admin'
  });
  assert(removeBetaRes.data?.success === true, 'Successfully removed secondary admin (leaving 1 active admin)');

  const guardDoc = await adminDb.doc(`businesses/${businessId}/settings/admin_guard`).get();
  assert(guardDoc.data().activeAdminCount === 1, 'admin_guard reflects activeAdminCount = 1');

  // Now only adminUid1 is active admin. Attempting to remove adminUid1 must fail!
  await assertRejection(
    removeAdmin({ businessId, targetUid: adminUid1, notes: 'Attempting to remove last admin' }),
    'permission-denied',
    'removeStaffMemberCallable rejected when targeting Primary / Last admin'
  );

  // Self-demotion rejection
  await assertRejection(
    updateRoleAdmin({ businessId, targetUid: adminUid1, newRole: 'manager', reason: 'Self-demotion attempt' }),
    'permission-denied',
    'updateStaffRoleCallable blocks self-demotion with permission-denied'
  );

  // Self-disabling rejection
  await assertRejection(
    updateStatusAdmin({ businessId, targetUid: adminUid1, newStatus: 'disabled', reason: 'Self-disable attempt' }),
    'permission-denied',
    'updateStaffStatusCallable blocks self-disabling with permission-denied'
  );

  console.log('\n--- 9. PRIMARY ADMINISTRATOR SAFEGUARDS ---');
  // Promote targetUser1 to admin so we have 2 admins again
  await updateRoleAdmin({ businessId, targetUid: targetUser1, newRole: 'admin', reason: 'Adding second admin' });

  // Sign in as second admin (targetUser1)
  const secondAdminToken = await adminAuth.createCustomToken(targetUser1);
  const secondAdminClientApp = initClientApp({ apiKey: 'fake-api-key', projectId }, 'client-second-admin');
  const secondAdminAuth = getClientAuth(secondAdminClientApp);
  connectAuthEmulator(secondAdminAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await signInWithCustomToken(secondAdminAuth, secondAdminToken);
  const secondAdminFunctions = getFunctions(secondAdminClientApp, 'us-central1');
  connectFunctionsEmulator(secondAdminFunctions, '127.0.0.1', 5001);

  // Second admin attempts to remove primary admin (adminUid1)
  const removeBySecondAdmin = httpsCallable(secondAdminFunctions, 'removeStaffMemberCallable');
  await assertRejection(
    removeBySecondAdmin({ businessId, targetUid: adminUid1, notes: 'Rogue removal attempt' }),
    'permission-denied',
    'Non-primary admin cannot remove primary administrator'
  );

  console.log('\n--- 10. UID MIGRATION VERIFICATION ---');
  const migrateAdmin = httpsCallable(adminClientFunctions, 'migrateStaffMemberUidCallable');
  
  // A. Non-existent old UID
  await assertRejection(
    migrateAdmin({ businessId, oldUid: 'nonexistent-uid-999', newUid: 'canonical-google-uid-1' }),
    'not-found',
    'migrateStaffMemberUidCallable fails when oldUid does not exist'
  );

  // B. Non-admin caller attempts migration
  const migrateByCashier = httpsCallable(cashierClientFunctions, 'migrateStaffMemberUidCallable');
  await assertRejection(
    migrateByCashier({ businessId, oldUid: 'legacy-staff-uid-999', newUid: 'canonical-google-uid-1' }),
    'permission-denied',
    'Non-admin cannot invoke migrateStaffMemberUidCallable'
  );

  // C. Mismatched email security check: Attempt to migrate legacyStaffUid to rogueDestUid
  await assertRejection(
    migrateAdmin({ businessId, oldUid: 'legacy-staff-uid-999', newUid: 'rogue-dest-uid-999', destinationEmail: 'attacker@evil.com' }),
    'permission-denied',
    'migrateStaffMemberUidCallable rejects destination accounts with mismatched emails'
  );

  // D. Valid migration: Migrate legacyStaffUid to canonicalGoogleUid (matching email)
  const migrateRes = await migrateAdmin({
    businessId,
    oldUid: 'legacy-staff-uid-999',
    newUid: 'canonical-google-uid-1',
    destinationEmail: 'migration-test@tps.com'
  });
  assert(migrateRes.data?.uid === 'canonical-google-uid-1', 'migrateStaffMemberUidCallable successfully migrated to new UID');

  // Verify old doc is deleted and new doc exists with same role
  const oldDoc = await adminDb.doc(`businesses/${businessId}/members/legacy-staff-uid-999`).get();
  assert(!oldDoc.exists, 'Legacy member document deleted after migration');
  const newDoc = await adminDb.doc(`businesses/${businessId}/members/canonical-google-uid-1`).get();
  assert(newDoc.exists && newDoc.data().role === 'manager', 'Canonical member document created with preserved role manager');

  console.log('\n======================================================');
  console.log(`REAL FUNCTIONS EMULATOR VERIFICATION COMPLETE`);
  console.log(`TOTAL TESTS:  ${totalTests}`);
  console.log(`PASSED TESTS: ${passedTests}`);
  console.log(`FAILED TESTS: ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('FATAL UNCAUGHT ERROR IN TEST SUITE:', err);
  process.exit(1);
});
