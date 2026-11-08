#!/usr/bin/env node
/**
 * TPS Battery House — Server-Side Primary Administrator Recovery Script
 *
 * Location: scripts/recover-primary-admin.js (Server-only administrative tool)
 *
 * Provides a controlled, trusted, offline administrative procedure to recover or
 * reassign the designated Primary Administrator configuration (businesses/{bizId}/settings/admin_config).
 *
 * Security Requirements:
 * 1. Executes strictly outside the browser/client build tree.
 * 2. Uses Firebase Admin SDK (Application Default Credentials or local Admin emulator).
 * 3. Verifies target account exists in Firebase Authentication (adminAuth.getUser).
 * 4. Verifies target user possesses an active Administrator record in Firestore.
 * 5. Atomically writes the configuration and a tamper-evident audit log with FieldValue.serverTimestamp().
 * 6. Supports dry-run validation mode (--dry-run).
 * 7. Requires explicit operator confirmation (--confirm) for live writes.
 */

import { initializeApp, getApps } from '../functions/node_modules/firebase-admin/lib/app/index.js';
import { getFirestore, FieldValue } from '../functions/node_modules/firebase-admin/lib/firestore/index.js';
import { getAuth } from '../functions/node_modules/firebase-admin/lib/auth/index.js';

export const DEFAULT_BUSINESS_ID = 'tps-battery-house';
export const ROLES = { ADMIN: 'admin', MANAGER: 'manager', CASHIER: 'cashier' };
export const ACCOUNT_STATUS = { ACTIVE: 'active', DISABLED: 'disabled' };

/**
 * Core transactional procedure to recover/reassign the Primary Administrator configuration
 */
export async function recoverPrimaryAdminConfig(
  adminDb,
  adminAuth,
  {
    businessId = DEFAULT_BUSINESS_ID,
    newPrimaryAdminUid,
    authorizedOperatorUid,
    authorizedOperatorEmail,
    recoveryReason = 'Controlled administrative recovery procedure',
    dryRun = false,
  }
) {
  if (!adminDb) throw new Error('Firebase Admin Firestore instance is required');
  if (!adminAuth) throw new Error('Firebase Admin Auth instance is required');
  if (!newPrimaryAdminUid) throw new Error('Target Primary Administrator UID is required');
  if (!authorizedOperatorUid) throw new Error('Authorized recovery operator UID is required');

  // 1. Verify target UID exists in Firebase Authentication
  let authUser;
  try {
    authUser = await adminAuth.getUser(newPrimaryAdminUid);
  } catch {
    throw new Error(`Target account not found in Firebase Authentication for UID: ${newPrimaryAdminUid}`);
  }

  const primaryEmail = (authUser.email || '').trim().toLowerCase();
  if (!primaryEmail) {
    throw new Error('Target user account in Firebase Authentication does not have an associated email address');
  }

  // 2. Verify target UID possesses an active Administrator membership in the business
  const memberRef = adminDb.doc(`businesses/${businessId}/members/${newPrimaryAdminUid}`);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    throw new Error(`Target user does not have a membership record in business '${businessId}'`);
  }

  const memberData = memberSnap.data();
  if (memberData.role !== ROLES.ADMIN || memberData.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new Error('Target user must be an active Administrator to be designated as Primary Administrator');
  }

  const configRef = adminDb.doc(`businesses/${businessId}/settings/admin_config`);
  const configSnap = await configRef.get();
  const previousConfig = configSnap.exists ? configSnap.data() : null;

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      businessId,
      newPrimaryAdminUid,
      primaryEmail,
      previousPrimaryAdminUid: previousConfig?.primaryAdminUid || null,
      recoveryReason,
      message: 'Validation passed successfully. Dry run only; no database writes were executed.',
    };
  }

  // 3. Atomically update admin_config and record tamper-evident audit log
  const logId = `audit_rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);
  const nowIso = new Date().toISOString();
  // Use Admin SDK FieldValue.serverTimestamp() when executing against real Admin SDK;
  // Fall back to ISO string in rules-unit-testing simulated environments where a client-side context is passed.
  const auditTimestamp =
    adminDb.listCollections && typeof FieldValue?.serverTimestamp === 'function'
      ? FieldValue.serverTimestamp()
      : nowIso;

  await adminDb.runTransaction(async (transaction) => {
    const liveConfigSnap = await transaction.get(configRef);
    const livePrevious = liveConfigSnap.exists ? liveConfigSnap.data() : null;

    const newConfig = {
      primaryAdminUid: newPrimaryAdminUid,
      primaryAdminEmail: primaryEmail,
      configuredAt: nowIso,
      configuredBy: authorizedOperatorUid,
      previousPrimaryAdminUid: livePrevious?.primaryAdminUid || null,
      recoveryReason,
    };

    transaction.set(configRef, newConfig);

    transaction.set(logRef, {
      id: logId,
      targetUid: newPrimaryAdminUid,
      targetEmail: primaryEmail,
      targetName: memberData.displayName || 'Primary Administrator',
      action: 'ROLE_CHANGED',
      previousValue: livePrevious ? { primaryAdminUid: livePrevious.primaryAdminUid } : null,
      newValue: { primaryAdminUid: newPrimaryAdminUid, role: ROLES.ADMIN },
      actorUid: authorizedOperatorUid,
      actorEmail: authorizedOperatorEmail || 'system_recovery@tpsbattery.com',
      timestamp: auditTimestamp,
      businessId,
      notes: `Primary Administrator designated/recovered: ${recoveryReason}`,
    });
  });

  return {
    success: true,
    dryRun: false,
    businessId,
    primaryAdminUid: newPrimaryAdminUid,
    primaryEmail,
    previousPrimaryAdminUid: previousConfig?.primaryAdminUid || null,
    auditLogId: logId,
  };
}

// CLI Execution entry point
async function runCli() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const hasFlag = (flag) => args.includes(flag);

  const projectId = getArg('--project') || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  const businessId = getArg('--business-id') || DEFAULT_BUSINESS_ID;
  const newAdminUid = getArg('--new-admin-uid');
  const operatorUid = getArg('--operator-uid') || process.env.USER || 'cli_operator';
  const reason = getArg('--reason') || 'Manual administrative recovery procedure via CLI';
  const dryRun = hasFlag('--dry-run');
  const confirmed = hasFlag('--confirm');

  if (hasFlag('--help') || !newAdminUid) {
    console.log(`
TPS Battery House — Primary Administrator Recovery CLI
Usage:
  node scripts/recover-primary-admin.js [options]

Options:
  --project <projectId>       Firebase Project ID (required or via GCLOUD_PROJECT)
  --business-id <id>          Target business ID (default: tps-battery-house)
  --new-admin-uid <uid>       Target UID of the active administrator to designate (required)
  --operator-uid <uid>        Operator performing recovery (default: system user)
  --reason <string>           Reason for recovery
  --dry-run                   Validate accounts without performing database writes
  --confirm                   Acknowledge and confirm live write to admin_config
  --help                      Show this help message
`);
    process.exit(hasFlag('--help') ? 0 : 1);
  }

  if (!dryRun && !confirmed) {
    console.error('ERROR: Live modification requires the --confirm flag. Use --dry-run to test first.');
    process.exit(1);
  }

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const adminDb = getFirestore(app);
  const adminAuth = getAuth(app);

  console.log('--- TPS Battery House Admin Recovery ---');
  console.log(`Project:     ${projectId || 'Default'}`);
  console.log(`Business:    ${businessId}`);
  console.log(`Target UID:  ${newAdminUid}`);
  console.log(`Operator:    ${operatorUid}`);
  console.log(`Mode:        ${dryRun ? 'DRY-RUN (Validation only)' : 'LIVE EXECUTION'}`);

  try {
    const result = await recoverPrimaryAdminConfig(adminDb, adminAuth, {
      businessId,
      newPrimaryAdminUid: newAdminUid,
      authorizedOperatorUid: operatorUid,
      recoveryReason: reason,
      dryRun,
    });
    console.log('\n[SUCCESS]', result.message || 'Recovery completed.');
    console.log('Details:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n[RECOVERY FAILED]', err.message);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
