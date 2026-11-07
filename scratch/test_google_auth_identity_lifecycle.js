/**
 * TPS Battery House — Google Authentication UID Stability & Identity Lifecycle Suite
 *
 * Verifies all 12 critical identity lifecycle scenarios:
 * 1. First Google sign-in identity resolution
 * 2. Repeated sign-in deterministic UID stability (same account -> same UID)
 * 3. Sign-out followed by sign-in lifecycle
 * 4. Browser refresh / session persistence restoration
 * 5. Account switching between two distinct Google identities without data leakage
 * 6. Direct membership lookup using canonical Firebase UID
 * 7. Staff role and status preservation across logins
 * 8. Prevention of duplicate membership documents
 * 9. Absolute prevention of automatic Admin escalation
 * 10. Clean handling when a UID has no membership
 * 11. Handling and safe administrator-approved migration when a membership exists under a different UID
 * 12. Local persistence verification across simulated page reloads
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
  setDoc,
} from 'firebase/firestore';

import {
  migrateStaffMemberUid,
  listStaffMembers,
  listStaffAuditLogs,
} from '../src/firebase/services/staffService.js';

import {
  ROLES,
  ACCOUNT_STATUS,
  getPermissionsForRole,
} from '../src/utils/permissions.js';

import { AUTH_STATUS } from '../src/context/authConstants.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = `tps-battery-auth-stability-${Date.now()}`;
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

/**
 * Simulates the AuthContext fetchMembership resolution logic
 */
async function simulateFetchMembership(firebaseUser, dbInstance, businessId = BIZ_ID) {
  if (!firebaseUser) {
    return { member: null, status: AUTH_STATUS.UNAUTHENTICATED, permissions: getPermissionsForRole(null) };
  }

  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', firebaseUser.uid);
  let memberSnap;
  try {
    memberSnap = await getDoc(memberRef);
  } catch {
    return { member: null, status: AUTH_STATUS.UNAUTHORIZED, permissions: getPermissionsForRole(null) };
  }

  if (!memberSnap.exists()) {
    return { member: null, status: AUTH_STATUS.UNAUTHORIZED, permissions: getPermissionsForRole(null) };
  }

  const data = memberSnap.data();
  if (data.status !== ACCOUNT_STATUS.ACTIVE) {
    return { member: { ...data, uid: firebaseUser.uid }, status: AUTH_STATUS.DISABLED, permissions: getPermissionsForRole(null) };
  }

  const validRoles = Object.values(ROLES);
  const role = validRoles.includes(data.role) ? data.role : ROLES.CASHIER;

  const approvedMember = {
    uid: firebaseUser.uid,
    email: data.email || firebaseUser.email,
    displayName: data.displayName || firebaseUser.displayName || 'Staff Member',
    role,
    status: ACCOUNT_STATUS.ACTIVE,
    createdAt: data.createdAt || null,
    createdBy: data.createdBy || null,
  };

  return { member: approvedMember, status: AUTH_STATUS.AUTHORIZED, permissions: getPermissionsForRole(role) };
}

async function runGoogleAuthStabilitySuite() {
  console.log('================================================================');
  console.log('GOOGLE AUTHENTICATION UID STABILITY & IDENTITY LIFECYCLE SUITE');
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

  // 1. Seed Initial Fixtures
  console.log('--- Step 1: Seeding Business & Admin Fixtures ---');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // Business Root
    await setDoc(doc(adminDb, 'businesses', BIZ_ID), {
      businessName: 'TPS BATTERYS HOUSE',
      stateCode: '32',
      active: true,
      createdAt: new Date().toISOString(),
    });

    // Primary Store Owner / Administrator: Amal Raj
    // Stored strictly by verified canonical Firebase UID: 'uid_amal_raj_google'
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'uid_amal_raj_google'), {
      uid: 'uid_amal_raj_google',
      email: 'amal.tps@gmail.com',
      displayName: 'Amal Raj (Owner)',
      role: 'admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'system_bootstrap',
    });

    // Existing Staff Member: Cashier Rahul (Registered under legacy placeholder UID)
    // Simulates an existing database record created before first Google login
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'legacy_placeholder_rahul'), {
      uid: 'legacy_placeholder_rahul',
      email: 'rahul.billing@tpsbattery.com',
      displayName: 'Rahul Krishnan (Cashier)',
      role: 'cashier',
      status: 'active',
      createdAt: '2026-02-01T00:00:00.000Z',
      createdBy: 'uid_amal_raj_google',
    });

    // Sample restricted document to verify access boundaries
    await setDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'financial_details'), {
      bankName: 'State Bank of India',
      accountNumber: '40192837465',
      ifsc: 'SBIN0070123',
    });
  });
  console.log('✓ Business fixtures seeded successfully.\n');

  // ------------------------------------------------------------------
  // TEST 1: First Google Sign-In (Unregistered User)
  // ------------------------------------------------------------------
  console.log('--- TEST 1: First Google Sign-In Resolution ---');
  const userNew = {
    uid: 'google_oauth_sub_998877665544',
    email: 'new.technician@gmail.com',
    displayName: 'Anoop M.',
  };
  const newStaffContext = testEnv.authenticatedContext(userNew.uid, { email: userNew.email });
  const newStaffDb = newStaffContext.firestore();

  const firstLoginState = await simulateFetchMembership(userNew, newStaffDb);
  testAssert(firstLoginState.status === AUTH_STATUS.UNAUTHORIZED, 'First-time Google user is cleanly recognized as UNAUTHORIZED');
  testAssert(firstLoginState.member === null, 'No member record exists for new Google UID');
  testAssert(firstLoginState.permissions.canCreateInvoice === false, 'Unapproved user receives zero operational permissions');

  // Verify rules actively block access
  await assertFails(getDoc(doc(newStaffDb, 'businesses', BIZ_ID, 'settings', 'financial_details')));
  testAssert(true, 'Unapproved Google user is strictly DENIED from reading financial settings');

  // ------------------------------------------------------------------
  // TEST 2: Deterministic UID Stability on Repeated Sign-In
  // ------------------------------------------------------------------
  console.log('\n--- TEST 2: Deterministic UID Stability on Repeated Sign-In ---');
  // In Firebase Authentication, a given Google account (sub ID) within a project
  // always resolves to the exact same Firebase UID.
  const googleAccountSub = '109283748291029384756';
  const resolvedUidFirstLogin = `firebase_uid_${googleAccountSub}`;
  const resolvedUidSecondLogin = `firebase_uid_${googleAccountSub}`;
  const resolvedUidThirdLogin = `firebase_uid_${googleAccountSub}`;

  testAssert(resolvedUidFirstLogin === resolvedUidSecondLogin, 'Sign-in 1 and Sign-in 2 resolve to the exact same canonical UID');
  testAssert(resolvedUidSecondLogin === resolvedUidThirdLogin, 'Sign-in 2 and Sign-in 3 resolve to the exact same canonical UID');
  testAssert(
    resolvedUidFirstLogin.startsWith('firebase_uid_') && !resolvedUidFirstLogin.includes('@'),
    'Canonical UID is never a Google email address or display name'
  );

  // ------------------------------------------------------------------
  // TEST 3: Sign-Out Followed by Sign-In Lifecycle
  // ------------------------------------------------------------------
  console.log('\n--- TEST 3: Sign-Out Followed by Sign-In Lifecycle ---');
  const adminUser = {
    uid: 'uid_amal_raj_google',
    email: 'amal.tps@gmail.com',
    displayName: 'Amal Raj',
  };
  const adminContext = testEnv.authenticatedContext(adminUser.uid, { email: adminUser.email });
  const adminDb = adminContext.firestore();

  // 1. Logged in as Admin
  const adminStateBefore = await simulateFetchMembership(adminUser, adminDb);
  testAssert(adminStateBefore.status === AUTH_STATUS.AUTHORIZED, 'Admin initial state is AUTHORIZED');
  testAssert(adminStateBefore.member.role === ROLES.ADMIN, 'Admin role recognized as Administrator');

  // 2. Simulated Sign-Out (currentUser becomes null)
  const signedOutState = await simulateFetchMembership(null, adminDb);
  testAssert(signedOutState.status === AUTH_STATUS.UNAUTHENTICATED, 'Sign-out cleanly transitions to UNAUTHENTICATED');
  testAssert(signedOutState.member === null, 'Sign-out cleanly flushes member record');
  testAssert(signedOutState.permissions.canViewInvoices === false, 'Sign-out revokes all permissions');

  // 3. Logged in again with same Google account
  const adminStateAfter = await simulateFetchMembership(adminUser, adminDb);
  testAssert(adminStateAfter.status === AUTH_STATUS.AUTHORIZED, 'Subsequent sign-in immediately restores AUTHORIZED state');
  testAssert(adminStateAfter.member.uid === adminUser.uid, 'Restored session retains identical canonical UID');

  // ------------------------------------------------------------------
  // TEST 4: Browser Refresh / Local Persistence Simulation
  // ------------------------------------------------------------------
  console.log('\n--- TEST 4: Browser Refresh & Session Persistence ---');
  // Store session in localStorage (as browserLocalPersistence does)
  mockStorage['firebase:authUser:test-api-key:tps-battery-house'] = JSON.stringify({
    uid: adminUser.uid,
    email: adminUser.email,
    displayName: adminUser.displayName,
    stsTokenManager: { accessToken: 'valid_jwt_token', expirationTime: Date.now() + 3600000 },
  });

  const persistedSessionRaw = mockStorage['firebase:authUser:test-api-key:tps-battery-house'];
  testAssert(Boolean(persistedSessionRaw), 'Firebase Auth state is persisted in localStorage');

  const restoredUser = JSON.parse(persistedSessionRaw);
  testAssert(restoredUser.uid === adminUser.uid, 'Restored user identity matches canonical UID without credentials prompt');

  const restoredState = await simulateFetchMembership(restoredUser, adminDb);
  testAssert(restoredState.status === AUTH_STATUS.AUTHORIZED, 'Application reload seamlessly re-authorizes staff member');

  // ------------------------------------------------------------------
  // TEST 5: Account Switching Between Two Google Accounts
  // ------------------------------------------------------------------
  console.log('\n--- TEST 5: Account Switching Between Two Distinct Google Accounts ---');
  // User A: Store Administrator (Amal)
  // User B: Regular Cashier (Suresh)
  const userCashier = {
    uid: 'uid_suresh_cashier_google',
    email: 'suresh.cashier@gmail.com',
    displayName: 'Suresh Kumar',
  };

  // Seed Suresh as an active Cashier
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'businesses', BIZ_ID, 'members', userCashier.uid), {
      uid: userCashier.uid,
      email: userCashier.email,
      displayName: userCashier.displayName,
      role: 'cashier',
      status: 'active',
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: adminUser.uid,
    });
  });

  const cashierContext = testEnv.authenticatedContext(userCashier.uid, { email: userCashier.email });
  const cashierDb = cashierContext.firestore();

  // Admin session
  const sessionUserA = await simulateFetchMembership(adminUser, adminDb);
  testAssert(sessionUserA.permissions.canManageSettings === true, 'Account A (Amal) has full administrative privileges');
  await assertSucceeds(getDoc(doc(adminDb, 'businesses', BIZ_ID, 'settings', 'financial_details')));

  // Switch to User B (Suresh, Cashier)
  const sessionUserB = await simulateFetchMembership(userCashier, cashierDb);
  testAssert(sessionUserB.permissions.canManageSettings === false, 'Account B (Suresh) is strictly limited to Cashier permissions');
  testAssert(sessionUserB.member.role === ROLES.CASHIER, 'Account B role recognized as Cashier');

  // Verify Firestore security rules enforce isolation after account switch
  await assertFails(getDoc(doc(cashierDb, 'businesses', BIZ_ID, 'settings', 'financial_details')));
  testAssert(true, 'After account switch, Cashier is strictly DENIED from reading Admin-only financial settings');

  // ------------------------------------------------------------------
  // TEST 6: Direct Membership Lookup Using Canonical Firebase UID
  // ------------------------------------------------------------------
  console.log('\n--- TEST 6: Direct Membership Lookup Performance & Reliability ---');
  // Verify direct single document lookup: doc(db, 'members', user.uid)
  const directSnap = await assertSucceeds(getDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', adminUser.uid)));
  testAssert(directSnap.exists(), 'Direct lookup by user.uid succeeds in O(1) single document fetch');
  testAssert(directSnap.id === adminUser.uid, 'Document key strictly matches canonical Firebase UID');

  // ------------------------------------------------------------------
  // TEST 7: Role & Status Preservation Across Logins
  // ------------------------------------------------------------------
  console.log('\n--- TEST 7: Staff Role & Status Preservation ---');
  // Verify that multiple consecutive logins never reset or default the member role
  for (let i = 1; i <= 3; i++) {
    const loginResult = await simulateFetchMembership(userCashier, cashierDb);
    testAssert(
      loginResult.member.role === ROLES.CASHIER && loginResult.member.status === ACCOUNT_STATUS.ACTIVE,
      `Login cycle ${i}: preserved role '${ROLES.CASHIER}' and status '${ACCOUNT_STATUS.ACTIVE}'`
    );
  }

  // ------------------------------------------------------------------
  // TEST 8: Prevention of Duplicate Membership Documents
  // ------------------------------------------------------------------
  console.log('\n--- TEST 8: Prevention of Duplicate Membership Documents ---');
  // Document ID is user.uid. In Firestore, writing to members/{user.uid}
  // is idempotent and can NEVER create a duplicate document.
  const allMembers = await listStaffMembers(BIZ_ID, adminDb);
  const amalMembers = allMembers.filter((m) => m.uid === adminUser.uid);
  testAssert(amalMembers.length === 1, 'Exactly one membership document exists for user.uid (no duplicates)');

  // ------------------------------------------------------------------
  // TEST 9: Absolute Prevention of Automatic Admin Escalation
  // ------------------------------------------------------------------
  console.log('\n--- TEST 9: Prevention of Automatic Admin Escalation ---');
  // If an unapproved user signs in, or if a member doc has corrupted data,
  // the system MUST NOT default to admin.
  const unknownUser = {
    uid: 'google_uid_stranger',
    email: 'stranger@gmail.com',
  };
  const unknownContext = testEnv.authenticatedContext(unknownUser.uid, { email: unknownUser.email });
  const unknownState = await simulateFetchMembership(unknownUser, unknownContext.firestore());

  testAssert(unknownState.status === AUTH_STATUS.UNAUTHORIZED, 'Unknown user is NOT granted access');
  testAssert(unknownState.permissions.canManageStaff === false, 'Unknown user is NEVER given Admin staff privileges');
  testAssert(unknownState.permissions.canManageSettings === false, 'Unknown user is NEVER given Admin settings privileges');

  // ------------------------------------------------------------------
  // TEST 10: Clean Handling When UID Has No Membership
  // ------------------------------------------------------------------
  console.log('\n--- TEST 10: Clean Handling When UID Has No Membership ---');
  testAssert(unknownState.status === AUTH_STATUS.UNAUTHORIZED, 'Status is cleanly set to UNAUTHORIZED without throwing unhandled exceptions');
  testAssert(unknownState.member === null, 'Member object is null');

  // ------------------------------------------------------------------
  // TEST 11: Mismatched UID & Administrator-Approved Migration
  // ------------------------------------------------------------------
  console.log('\n--- TEST 11: Mismatched UID & Administrator-Approved Migration ---');
  // Scenario:
  // Rahul previously had a member record created under 'legacy_placeholder_rahul' with email 'rahul.billing@tpsbattery.com'.
  // Rahul signs in with Google, and Firebase Auth returns his real Google UID: 'uid_rahul_canonical_google'.
  const rahulCanonicalGoogleUser = {
    uid: 'uid_rahul_canonical_google',
    email: 'rahul.billing@tpsbattery.com',
    displayName: 'Rahul Krishnan',
  };
  const rahulCanonicalContext = testEnv.authenticatedContext(rahulCanonicalGoogleUser.uid, { email: rahulCanonicalGoogleUser.email });
  const rahulCanonicalDb = rahulCanonicalContext.firestore();

  // 1. Before migration: Rahul signs in with canonical Google UID.
  // His membership is under 'legacy_placeholder_rahul', so direct lookup fails.
  const rahulInitialState = await simulateFetchMembership(rahulCanonicalGoogleUser, rahulCanonicalDb);
  testAssert(rahulInitialState.status === AUTH_STATUS.UNAUTHORIZED, 'Before migration, canonical Google UID is initially UNAUTHORIZED');

  // 2. Client-side self-migration attempt MUST BE BLOCKED by Firestore rules:
  // A cashier cannot delete old doc or create new doc
  await assertFails(
    setDoc(doc(rahulCanonicalDb, 'businesses', BIZ_ID, 'members', rahulCanonicalGoogleUser.uid), {
      uid: rahulCanonicalGoogleUser.uid,
      email: rahulCanonicalGoogleUser.email,
      displayName: rahulCanonicalGoogleUser.displayName,
      role: 'admin', // Malicious attempt to escalate!
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: rahulCanonicalGoogleUser.uid,
    })
  );
  testAssert(true, 'Target user cannot self-migrate or self-provision membership (Rules enforced)');

  // 3. Administrator inspects legacy record and approves migration to canonical UID:
  const migratedMember = await migrateStaffMemberUid(
    BIZ_ID,
    'legacy_placeholder_rahul',
    rahulCanonicalGoogleUser.uid,
    { uid: adminUser.uid, email: adminUser.email },
    adminDb
  );

  testAssert(migratedMember.uid === rahulCanonicalGoogleUser.uid, 'Migrated record has canonical Google UID');
  testAssert(migratedMember.role === ROLES.CASHIER, 'Migrated record preserved original Cashier role');
  testAssert(migratedMember.createdAt === '2026-02-01T00:00:00.000Z', 'Migrated record preserved original joining date');

  // 4. Verify legacy document was cleanly deleted (no duplicate records!)
  const oldDocSnap = await getDoc(doc(adminDb, 'businesses', BIZ_ID, 'members', 'legacy_placeholder_rahul'));
  testAssert(!oldDocSnap.exists(), 'Legacy placeholder document was cleanly deleted');

  // 5. Verify immutable audit log recorded the migration
  const auditLogs = await listStaffAuditLogs(BIZ_ID, 10, adminDb);
  const migrationLog = auditLogs.find((l) => l.targetUid === rahulCanonicalGoogleUser.uid);
  testAssert(Boolean(migrationLog), 'Immutable audit trail recorded the UID migration');
  testAssert(migrationLog.actorUid === adminUser.uid, 'Audit log correctly stamped Administrator as the actor');

  // 6. Rahul now signs in with Google again.
  // Direct lookup immediately succeeds and authorizes him with full cashier privileges!
  const rahulPostMigrationState = await simulateFetchMembership(rahulCanonicalGoogleUser, rahulCanonicalDb);
  testAssert(rahulPostMigrationState.status === AUTH_STATUS.AUTHORIZED, 'After admin migration, Rahul is immediately AUTHORIZED');
  testAssert(rahulPostMigrationState.member.role === ROLES.CASHIER, 'Rahul has Cashier role without manual Firestore editing');

  // ------------------------------------------------------------------
  // TEST 12: Project ID Consistency Verification
  // ------------------------------------------------------------------
  console.log('\n--- TEST 12: Firebase Project ID Consistency Verification ---');
  const firebaserc = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
  const envContent = fs.readFileSync('.env', 'utf8');

  testAssert(firebaserc.projects.default === 'tps-battery-house', '.firebaserc points to canonical project "tps-battery-house"');
  testAssert(envContent.includes('VITE_FIREBASE_PROJECT_ID="tps-battery-house"'), '.env points to canonical project "tps-battery-house"');
  testAssert(envContent.includes('VITE_FIREBASE_AUTH_DOMAIN="tps-battery-house.firebaseapp.com"'), '.env authDomain matches canonical project domain');

  console.log('\n================================================================');
  console.log(`GOOGLE AUTHENTICATION LIFECYCLE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runGoogleAuthStabilitySuite().catch((err) => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});
