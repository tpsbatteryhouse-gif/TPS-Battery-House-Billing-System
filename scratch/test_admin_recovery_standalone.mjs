/**
 * TPS Battery House — Phase 5.1 Admin Recovery Standalone Verification Suite
 */

import { initializeApp } from '../functions/node_modules/firebase-admin/lib/app/index.js';
import { getAuth } from '../functions/node_modules/firebase-admin/lib/auth/index.js';
import { getFirestore } from '../functions/node_modules/firebase-admin/lib/firestore/index.js';
import { recoverPrimaryAdminConfig, ROLES, ACCOUNT_STATUS } from '../scripts/recover-primary-admin.js';
import { execSync } from 'child_process';
import fs from 'fs';

const projectId = 'demo-tps-battery-house';
const businessId = 'tps-battery-house';

process.env.GCLOUD_PROJECT = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8980';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

console.log('=== STARTING ADMIN RECOVERY VERIFICATION SUITE ===');

const app = initializeApp({ projectId }, 'recovery-suite');
const adminDb = getFirestore(app);
const adminAuth = getAuth(app);

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ✖ [FAIL] ${message}`);
  }
}

async function assertError(fn, expectedSubstr, testName) {
  total++;
  try {
    await fn();
    failed++;
    console.error(`  ✖ [FAIL] ${testName}: Expected exception containing "${expectedSubstr}", but succeeded`);
  } catch (err) {
    if (err.message.includes(expectedSubstr)) {
      passed++;
      console.log(`  ✔ [PASS] ${testName} (Threw expected error: "${err.message}")`);
    } else {
      failed++;
      console.error(`  ✖ [FAIL] ${testName}: Expected "${expectedSubstr}", but got "${err.message}"`);
    }
  }
}

async function runRecoveryTests() {
  console.log('\n--- 1. STATIC DEPENDENCY & BUNDLE ISOLATION CHECKS ---');
  // Check if imported anywhere in src/
  const srcFiles = fs.readdirSync('src', { recursive: true });
  let foundInSrc = false;
  for (const file of srcFiles) {
    const fullPath = `src/${file}`;
    if (fs.statSync(fullPath).isFile() && (file.endsWith('.js') || file.endsWith('.jsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('recover-primary-admin') || content.includes('recoverPrimaryAdminConfig')) {
        foundInSrc = true;
        console.error(`Found reference in ${fullPath}`);
      }
    }
  }
  assert(!foundInSrc, 'scripts/recover-primary-admin.js is never imported by any file in src/');

  // Check dist output
  const distExists = fs.existsSync('dist');
  if (distExists) {
    const distFiles = fs.readdirSync('dist/assets');
    let foundInDist = false;
    for (const f of distFiles) {
      if (f.endsWith('.js')) {
        const c = fs.readFileSync(`dist/assets/${f}`, 'utf8');
        if (c.includes('recoverPrimaryAdminConfig') || c.includes('scripts/recover-primary-admin')) {
          foundInDist = true;
        }
      }
    }
    assert(!foundInDist, 'Recovery function logic is absent from client distribution bundle (dist/)');
  }

  console.log('\n--- 2. CLI FLAG & PARAMETER VALIDATION CHECKS ---');
  // CLI without --project
  try {
    execSync('node scripts/recover-primary-admin.js --new-admin-uid test-uid', { stdio: 'pipe' });
    assert(false, 'CLI should exit non-zero when --project is missing');
  } catch (err) {
    assert(err.status === 1, 'CLI rejects execution with code 1 when --project is omitted');
  }

  // CLI without --confirm when not dry-run
  try {
    execSync(`node scripts/recover-primary-admin.js --project ${projectId} --new-admin-uid test-uid`, { stdio: 'pipe' });
    assert(false, 'CLI should exit non-zero when --confirm is missing for live write');
  } catch (err) {
    assert(err.status === 1, 'CLI rejects live execution with code 1 when --confirm is omitted');
  }

  console.log('\n--- 3. DATABASE VALIDATION AND SAFETY CHECKS ---');
  const validAdminUid = 'healthy-active-admin';
  const cashierUid = 'recovery-test-cashier';
  const disabledAdminUid = 'recovery-test-disabled';
  const nonexistentUid = 'completely-bogus-uid-404';

  // Seed fixture users
  for (const uid of [validAdminUid, cashierUid, disabledAdminUid]) {
    try {
      await adminAuth.createUser({ uid, email: `${uid}@tps.com` });
    } catch {}
  }

  await adminDb.doc(`businesses/${businessId}/members/${validAdminUid}`).set({
    email: `${validAdminUid}@tps.com`,
    name: 'Healthy Admin',
    role: ROLES.ADMIN,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  await adminDb.doc(`businesses/${businessId}/members/${cashierUid}`).set({
    email: `${cashierUid}@tps.com`,
    name: 'Cashier Staff',
    role: ROLES.CASHIER,
    status: ACCOUNT_STATUS.ACTIVE,
  });

  await adminDb.doc(`businesses/${businessId}/members/${disabledAdminUid}`).set({
    email: `${disabledAdminUid}@tps.com`,
    name: 'Disabled Admin',
    role: ROLES.ADMIN,
    status: ACCOUNT_STATUS.DISABLED,
  });

  // Seed initial admin_guard and admin_config
  await adminDb.doc(`businesses/${businessId}/settings/admin_guard`).set({
    id: 'admin_guard',
    version: 1,
    activeAdminCount: 1,
    lastSequence: 10,
    updatedAt: new Date().toISOString(),
  });

  await adminDb.doc(`businesses/${businessId}/settings/admin_config`).set({
    primaryAdminUid: 'initial-old-admin',
    primaryAdminEmail: 'old@tps.com',
    configuredAt: new Date().toISOString(),
  });

  // Test Nonexistent Auth UID
  await assertError(
    () => recoverPrimaryAdminConfig(adminDb, adminAuth, {
      businessId,
      newPrimaryAdminUid: nonexistentUid,
      authorizedOperatorUid: 'operator_1'
    }),
    'Target account not found in Firebase Authentication',
    'Nonexistent Auth UID is rejected'
  );

  // Test Cashier Designation Rejection
  await assertError(
    () => recoverPrimaryAdminConfig(adminDb, adminAuth, {
      businessId,
      newPrimaryAdminUid: cashierUid,
      authorizedOperatorUid: 'operator_1'
    }),
    'Target user must be an active Administrator',
    'Cashier member designation is rejected'
  );

  // Test Disabled Admin Designation Rejection
  await assertError(
    () => recoverPrimaryAdminConfig(adminDb, adminAuth, {
      businessId,
      newPrimaryAdminUid: disabledAdminUid,
      authorizedOperatorUid: 'operator_1'
    }),
    'Target user must be an active Administrator',
    'Disabled administrator designation is rejected'
  );

  console.log('\n--- 4. DRY RUN VALIDATION (ZERO WRITES) ---');
  const dryRunRes = await recoverPrimaryAdminConfig(adminDb, adminAuth, {
    businessId,
    newPrimaryAdminUid: validAdminUid,
    authorizedOperatorUid: 'operator_1',
    dryRun: true
  });
  assert(dryRunRes.success === true && dryRunRes.dryRun === true, 'Dry run returned validation success');

  // Verify that admin_config did NOT change
  const configAfterDryRun = await adminDb.doc(`businesses/${businessId}/settings/admin_config`).get();
  assert(configAfterDryRun.data().primaryAdminUid === 'initial-old-admin', 'admin_config was NOT modified during dry run');

  // Verify that no audit log was created for dry run
  const auditLogsSnap = await adminDb.collection(`businesses/${businessId}/staff_audit_logs`).where('targetUid', '==', validAdminUid).get();
  assert(auditLogsSnap.empty, 'Zero audit logs created during dry run');

  console.log('\n--- 5. LIVE ATOMIC EXECUTION AND STATE CONSISTENCY ---');
  const liveRes = await recoverPrimaryAdminConfig(adminDb, adminAuth, {
    businessId,
    newPrimaryAdminUid: validAdminUid,
    authorizedOperatorUid: 'operator_1',
    recoveryReason: 'Production DR exercise',
    dryRun: false
  });
  assert(liveRes.success === true && liveRes.dryRun === false, 'Live execution succeeded');

  // Verify admin_config updated
  const configAfterLive = await adminDb.doc(`businesses/${businessId}/settings/admin_config`).get();
  assert(configAfterLive.data().primaryAdminUid === validAdminUid, 'admin_config updated with target UID');
  assert(configAfterLive.data().primaryAdminEmail === `${validAdminUid}@tps.com`, 'admin_config updated with correct email');
  assert(configAfterLive.data().previousPrimaryAdminUid === 'initial-old-admin', 'admin_config records previousPrimaryAdminUid');

  // Verify admin_guard sequence incremented
  const guardAfterLive = await adminDb.doc(`businesses/${businessId}/settings/admin_guard`).get();
  assert(guardAfterLive.data().lastSequence === 11, 'admin_guard lastSequence incremented atomically in transaction');

  // Verify staff_audit_logs created
  const auditAfterLive = await adminDb.doc(`businesses/${businessId}/staff_audit_logs/${liveRes.auditLogId}`).get();
  assert(auditAfterLive.exists, 'Immutable audit log written to staff_audit_logs');
  assert(auditAfterLive.data().action === 'ROLE_CHANGED', 'Audit log action is ROLE_CHANGED');
  assert(auditAfterLive.data().targetUid === validAdminUid, 'Audit log targetUid matches');
  assert(auditAfterLive.data().actorUid === 'operator_1', 'Audit log actorUid matches operator');

  console.log('\n======================================================');
  console.log(`ADMIN RECOVERY VERIFICATION COMPLETE`);
  console.log(`TOTAL TESTS:  ${total}`);
  console.log(`PASSED TESTS: ${passed}`);
  console.log(`FAILED TESTS: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runRecoveryTests().catch(err => {
  console.error('Fatal error in recovery test suite:', err);
  process.exit(1);
});
