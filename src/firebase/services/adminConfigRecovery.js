/**
 * TPS Battery House — Controlled Primary Administrator Recovery Procedure
 *
 * Provides a controlled, trusted Admin SDK procedure to recover or reassign
 * the designated Primary Administrator configuration in the event of credential loss,
 * account recovery, or authorized administrative transfer.
 *
 * Enforces:
 * 1. Target UID must exist in Firebase Authentication (verified via Admin SDK).
 * 2. Target UID must possess an active Administrator membership document.
 * 3. Atomic configuration update to businesses/{businessId}/settings/admin_config.
 * 4. Immutable tamper-evident audit log creation.
 */

import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { ROLES, ACCOUNT_STATUS } from '../../utils/permissions.js';

export async function recoverPrimaryAdminConfig(
  adminDb,
  adminAuth,
  {
    businessId = DEFAULT_BUSINESS_ID,
    newPrimaryAdminUid,
    authorizedOperatorUid,
    authorizedOperatorEmail,
    recoveryReason = 'Controlled administrative recovery procedure',
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
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);
  const now = new Date().toISOString();

  // 3. Atomically update admin_config and record tamper-evident audit log
  await adminDb.runTransaction(async (transaction) => {
    const configSnap = await transaction.get(configRef);
    const previousConfig = configSnap.exists ? configSnap.data() : null;

    const newConfig = {
      primaryAdminUid: newPrimaryAdminUid,
      primaryAdminEmail: primaryEmail,
      configuredAt: now,
      configuredBy: authorizedOperatorUid,
      previousPrimaryAdminUid: previousConfig?.primaryAdminUid || null,
      recoveryReason,
    };

    transaction.set(configRef, newConfig);

    transaction.set(logRef, {
      id: logId,
      targetUid: newPrimaryAdminUid,
      targetEmail: primaryEmail,
      targetName: memberData.displayName || 'Primary Administrator',
      action: 'ROLE_CHANGED',
      previousValue: previousConfig ? { primaryAdminUid: previousConfig.primaryAdminUid } : null,
      newValue: { primaryAdminUid: newPrimaryAdminUid, role: ROLES.ADMIN },
      actorUid: authorizedOperatorUid,
      actorEmail: authorizedOperatorEmail || 'system_recovery@tpsbattery.com',
      timestamp: now,
      businessId,
      notes: `Primary Administrator designated/recovered: ${recoveryReason}`,
    });
  });

  return {
    success: true,
    businessId,
    primaryAdminUid: newPrimaryAdminUid,
    primaryAdminEmail: primaryEmail,
    recoveredAt: now,
  };
}
