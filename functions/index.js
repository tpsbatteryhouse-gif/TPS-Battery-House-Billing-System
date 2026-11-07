/**
 * TPS Battery House — Cloud Functions for Staff Security & Administration
 *
 * Implements server-side privileged endpoints for:
 * - updateStaffRoleCallable
 * - updateStaffStatusCallable
 * - approveStaffMemberCallable
 * - rejectStaffRegistrationCallable
 * - migrateStaffMemberUidCallable
 * - revokeStaffSessionCallable
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

if (!getApps().length) {
  initializeApp();
}

const adminDb = getFirestore();
const adminAuth = getAuth();

const DEFAULT_BUSINESS_ID = 'tps-battery-house';
const ROLES = { ADMIN: 'admin', MANAGER: 'manager', CASHIER: 'cashier' };
const ACCOUNT_STATUS = { ACTIVE: 'active', DISABLED: 'disabled' };

/**
 * Validates that the caller is authenticated and is an active Administrator
 */
async function assertCallerIsAdmin(request, businessId = DEFAULT_BUSINESS_ID) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to invoke staff administration.');
  }

  const callerUid = request.auth.uid;
  const callerRef = adminDb.doc(`businesses/${businessId}/members/${callerUid}`);
  const callerSnap = await callerRef.get();

  if (!callerSnap.exists) {
    throw new HttpsError('permission-denied', 'Caller does not have an active membership record.');
  }

  const callerData = callerSnap.data();
  if (callerData.role !== ROLES.ADMIN || callerData.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new HttpsError('permission-denied', 'Only active Administrators may perform staff operations.');
  }

  return {
    uid: callerUid,
    email: request.auth.token.email || callerData.email,
  };
}

/**
 * Cloud Function: Update Staff Role
 */
export const updateStaffRoleCallable = onCall(async (request) => {
  const { businessId = DEFAULT_BUSINESS_ID, targetUid, newRole } = request.data || {};
  const actorUser = await assertCallerIsAdmin(request, businessId);

  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');
  if (![ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER].includes(newRole)) {
    throw new HttpsError('invalid-argument', `Invalid role: ${newRole}`);
  }
  if (targetUid === actorUser.uid) {
    throw new HttpsError('permission-denied', 'Administrators cannot modify their own role.');
  }

  const memberRef = adminDb.doc(`businesses/${businessId}/members/${targetUid}`);
  const configRef = adminDb.doc(`businesses/${businessId}/settings/admin_config`);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const memberSnap = await transaction.get(memberRef);
      if (!memberSnap.exists) {
        throw new HttpsError('not-found', `Staff member not found for UID: ${targetUid}`);
      }

      const currentData = memberSnap.data();
      const oldRole = currentData.role;

      // Primary Admin check
      const configSnap = await transaction.get(configRef);
      if (configSnap.exists) {
        const primaryAdminUid = configSnap.data().primaryAdminUid;
        if (targetUid === primaryAdminUid && newRole !== ROLES.ADMIN) {
          throw new HttpsError('permission-denied', 'Cannot demote the Primary Administrator.');
        }
      }

      // Last Active Admin check
      if (oldRole === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
        const activeAdminsSnap = await transaction.get(
          adminDb.collection(`businesses/${businessId}/members`)
            .where('role', '==', ROLES.ADMIN)
            .where('status', '==', ACCOUNT_STATUS.ACTIVE)
        );
        if (activeAdminsSnap.size <= 1) {
          throw new HttpsError(
            'failed-precondition',
            'Cannot demote the last remaining active Administrator.'
          );
        }
      }

      const now = new Date().toISOString();
      transaction.update(memberRef, {
        role: newRole,
        updatedAt: now,
        updatedBy: actorUser.uid,
      });

      transaction.set(logRef, {
        id: logId,
        targetUid,
        targetEmail: currentData.email,
        targetName: currentData.displayName || '',
        action: 'ROLE_CHANGED',
        previousValue: { role: oldRole },
        newValue: { role: newRole },
        actorUid: actorUser.uid,
        actorEmail: actorUser.email,
        timestamp: now,
        businessId,
        notes: `Role changed from ${oldRole} to ${newRole} via Cloud Function`,
      });

      return { success: true, uid: targetUid, role: newRole };
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message);
  }
});

/**
 * Cloud Function: Update Staff Status
 */
export const updateStaffStatusCallable = onCall(async (request) => {
  const { businessId = DEFAULT_BUSINESS_ID, targetUid, newStatus } = request.data || {};
  const actorUser = await assertCallerIsAdmin(request, businessId);

  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');
  if (![ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.DISABLED].includes(newStatus)) {
    throw new HttpsError('invalid-argument', `Invalid status: ${newStatus}`);
  }
  if (targetUid === actorUser.uid) {
    throw new HttpsError('permission-denied', 'Administrators cannot disable their own account status.');
  }

  const memberRef = adminDb.doc(`businesses/${businessId}/members/${targetUid}`);
  const configRef = adminDb.doc(`businesses/${businessId}/settings/admin_config`);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const memberSnap = await transaction.get(memberRef);
      if (!memberSnap.exists) {
        throw new HttpsError('not-found', `Staff member not found for UID: ${targetUid}`);
      }

      const currentData = memberSnap.data();
      const oldStatus = currentData.status;

      // Primary Admin check
      const configSnap = await transaction.get(configRef);
      if (configSnap.exists) {
        const primaryAdminUid = configSnap.data().primaryAdminUid;
        if (targetUid === primaryAdminUid && newStatus === ACCOUNT_STATUS.DISABLED) {
          throw new HttpsError('permission-denied', 'Cannot disable the Primary Administrator.');
        }
      }

      // Last Active Admin check
      if (currentData.role === ROLES.ADMIN && newStatus === ACCOUNT_STATUS.DISABLED) {
        const activeAdminsSnap = await transaction.get(
          adminDb.collection(`businesses/${businessId}/members`)
            .where('role', '==', ROLES.ADMIN)
            .where('status', '==', ACCOUNT_STATUS.ACTIVE)
        );
        if (activeAdminsSnap.size <= 1) {
          throw new HttpsError(
            'failed-precondition',
            'Cannot disable the last remaining active Administrator.'
          );
        }
      }

      const now = new Date().toISOString();
      transaction.update(memberRef, {
        status: newStatus,
        updatedAt: now,
        updatedBy: actorUser.uid,
      });

      transaction.set(logRef, {
        id: logId,
        targetUid,
        targetEmail: currentData.email,
        targetName: currentData.displayName || '',
        action: 'STATUS_CHANGED',
        previousValue: { status: oldStatus },
        newValue: { status: newStatus },
        actorUid: actorUser.uid,
        actorEmail: actorUser.email,
        timestamp: now,
        businessId,
        notes: `Status changed from ${oldStatus} to ${newStatus} via Cloud Function`,
      });

      return { success: true, uid: targetUid, status: newStatus };
    });

    // Invalidate refresh tokens when account is disabled
    if (newStatus === ACCOUNT_STATUS.DISABLED) {
      try {
        await adminAuth.revokeRefreshTokens(targetUid);
      } catch (authErr) {
        console.warn(`[Functions] Failed to revoke refresh tokens for ${targetUid}:`, authErr);
      }
    }

    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message);
  }
});

/**
 * Cloud Function: Approve Staff Member
 */
export const approveStaffMemberCallable = onCall(async (request) => {
  const { businessId = DEFAULT_BUSINESS_ID, targetUid, role } = request.data || {};
  const actorUser = await assertCallerIsAdmin(request, businessId);

  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');
  if (![ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER].includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role: ${role}`);
  }
  if (targetUid === actorUser.uid) {
    throw new HttpsError('permission-denied', 'Administrators cannot approve their own registration.');
  }

  const regRef = adminDb.doc(`businesses/${businessId}/pending_registrations/${targetUid}`);
  const memberRef = adminDb.doc(`businesses/${businessId}/members/${targetUid}`);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const regSnap = await transaction.get(regRef);
      if (!regSnap.exists) {
        throw new HttpsError('not-found', `Pending registration not found for UID: ${targetUid}`);
      }

      const regData = regSnap.data();
      const now = new Date().toISOString();

      transaction.set(memberRef, {
        uid: targetUid,
        email: regData.email,
        displayName: regData.displayName || 'Staff Member',
        role,
        status: ACCOUNT_STATUS.ACTIVE,
        createdAt: now,
        createdBy: actorUser.uid,
        updatedAt: now,
        updatedBy: actorUser.uid,
      });

      transaction.update(regRef, {
        status: 'approved',
        assignedRole: role,
        reviewedBy: actorUser.uid,
        reviewedAt: now,
      });

      transaction.set(logRef, {
        id: logId,
        targetUid,
        targetEmail: regData.email,
        targetName: regData.displayName || '',
        action: 'STAFF_APPROVED',
        previousValue: null,
        newValue: { role, status: ACCOUNT_STATUS.ACTIVE },
        actorUid: actorUser.uid,
        actorEmail: actorUser.email,
        timestamp: now,
        businessId,
        notes: `Staff member approved via Cloud Function as ${role}`,
      });

      return { success: true, uid: targetUid, role };
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message);
  }
});

/**
 * Cloud Function: Reject Staff Registration
 */
export const rejectStaffRegistrationCallable = onCall(async (request) => {
  const { businessId = DEFAULT_BUSINESS_ID, targetUid, rejectionReason = '' } = request.data || {};
  const actorUser = await assertCallerIsAdmin(request, businessId);

  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');
  if (targetUid === actorUser.uid) {
    throw new HttpsError('permission-denied', 'Administrators cannot reject their own registration.');
  }

  const regRef = adminDb.doc(`businesses/${businessId}/pending_registrations/${targetUid}`);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const regSnap = await transaction.get(regRef);
      if (!regSnap.exists) {
        throw new HttpsError('not-found', `Pending registration not found for UID: ${targetUid}`);
      }

      const regData = regSnap.data();
      const now = new Date().toISOString();
      const reason = rejectionReason || 'Access request rejected by administrator.';

      transaction.update(regRef, {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: actorUser.uid,
        reviewedAt: now,
      });

      transaction.set(logRef, {
        id: logId,
        targetUid,
        targetEmail: regData.email,
        targetName: regData.displayName || '',
        action: 'STAFF_REJECTED',
        previousValue: { status: regData.status },
        newValue: { status: 'rejected' },
        actorUid: actorUser.uid,
        actorEmail: actorUser.email,
        timestamp: now,
        businessId,
        notes: reason,
      });

      return { success: true };
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message);
  }
});

/**
 * Cloud Function: Migrate Staff Member UID
 */
export const migrateStaffMemberUidCallable = onCall(async (request) => {
  const { businessId = DEFAULT_BUSINESS_ID, oldUid, newUid, destinationEmail } = request.data || {};
  const actorUser = await assertCallerIsAdmin(request, businessId);

  if (!oldUid || !newUid) throw new HttpsError('invalid-argument', 'oldUid and newUid are required');
  if (oldUid === newUid) throw new HttpsError('invalid-argument', 'oldUid and newUid cannot be identical');
  if (oldUid === actorUser.uid) {
    throw new HttpsError('permission-denied', 'Administrators cannot migrate their own active UID directly.');
  }

  const oldRef = adminDb.doc(`businesses/${businessId}/members/${oldUid}`);
  const newRef = adminDb.doc(`businesses/${businessId}/members/${newUid}`);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const oldSnap = await transaction.get(oldRef);
      if (!oldSnap.exists) {
        throw new HttpsError('not-found', `Legacy staff membership not found for UID: ${oldUid}`);
      }

      const newSnap = await transaction.get(newRef);
      if (newSnap.exists) {
        throw new HttpsError('already-exists', `A staff member already exists with target UID: ${newUid}`);
      }

      const oldData = oldSnap.data();

      // Destination identity verification
      if (destinationEmail && destinationEmail.trim().toLowerCase() !== oldData.email.trim().toLowerCase()) {
        throw new HttpsError(
          'permission-denied',
          `Destination account email does not match registered staff email: ${oldData.email}`
        );
      }

      const now = new Date().toISOString();
      const newPayload = {
        uid: newUid,
        email: oldData.email,
        displayName: oldData.displayName,
        role: oldData.role,
        status: oldData.status,
        createdAt: oldData.createdAt || now,
        createdBy: oldData.createdBy || actorUser.uid,
        updatedAt: now,
        updatedBy: actorUser.uid,
      };

      transaction.set(newRef, newPayload);
      transaction.delete(oldRef);

      transaction.set(logRef, {
        id: logId,
        targetUid: newUid,
        targetEmail: oldData.email,
        targetName: oldData.displayName || '',
        action: 'STAFF_APPROVED',
        previousValue: { uid: oldUid, role: oldData.role },
        newValue: { uid: newUid, role: oldData.role },
        actorUid: actorUser.uid,
        actorEmail: actorUser.email,
        timestamp: now,
        businessId,
        notes: `Migrated legacy membership UID (${oldUid}) to canonical Google UID (${newUid}) via Cloud Function`,
      });

      return newPayload;
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message);
  }
});

/**
 * Cloud Function: Revoke Staff Session
 */
export const revokeStaffSessionCallable = onCall(async (request) => {
  const { businessId = DEFAULT_BUSINESS_ID, targetUid } = request.data || {};
  await assertCallerIsAdmin(request, businessId);

  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');

  try {
    await adminAuth.revokeRefreshTokens(targetUid);
    return {
      success: true,
      targetUid,
      revokedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw new HttpsError('internal', err.message);
  }
});

/**
 * Cloud Function: Remove Staff Member Permanently
 */
export const removeStaffMemberCallable = onCall(async (request) => {
  const { businessId = DEFAULT_BUSINESS_ID, targetUid, notes } = request.data || {};
  const actorUser = await assertCallerIsAdmin(request, businessId);

  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');
  if (targetUid === actorUser.uid) {
    throw new HttpsError('permission-denied', 'Administrators cannot remove their own account.');
  }

  const memberRef = adminDb.doc(`businesses/${businessId}/members/${targetUid}`);
  const pendingRegRef = adminDb.doc(`businesses/${businessId}/pending_registrations/${targetUid}`);
  const configRef = adminDb.doc(`businesses/${businessId}/settings/admin_config`);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = adminDb.doc(`businesses/${businessId}/staff_audit_logs/${logId}`);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const memberSnap = await transaction.get(memberRef);
      if (!memberSnap.exists) {
        throw new HttpsError('not-found', `Staff member not found for UID: ${targetUid}`);
      }

      const currentData = memberSnap.data();

      // Primary Admin check
      const configSnap = await transaction.get(configRef);
      if (configSnap.exists) {
        const primaryAdminUid = configSnap.data().primaryAdminUid;
        if (targetUid === primaryAdminUid) {
          throw new HttpsError('permission-denied', 'Cannot remove the Primary Administrator.');
        }
      }

      // Last Active Admin check
      if (currentData.role === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE) {
        const activeAdminsSnap = await transaction.get(
          adminDb.collection(`businesses/${businessId}/members`)
            .where('role', '==', ROLES.ADMIN)
            .where('status', '==', ACCOUNT_STATUS.ACTIVE)
        );
        if (activeAdminsSnap.size <= 1) {
          throw new HttpsError(
            'failed-precondition',
            'Cannot remove the last remaining active Administrator. Please designate another Administrator first.'
          );
        }
      }

      // Read pending registration if present before writes
      const pendingSnap = await transaction.get(pendingRegRef);

      // Delete member
      transaction.delete(memberRef);

      // Clean up pending registration if exists
      if (pendingSnap.exists) {
        transaction.delete(pendingRegRef);
      }

      const now = new Date().toISOString();
      transaction.set(logRef, {
        id: logId,
        targetUid,
        targetEmail: currentData.email,
        targetName: currentData.displayName || '',
        action: 'STAFF_REMOVED',
        previousValue: { role: currentData.role, status: currentData.status },
        newValue: null,
        actorUid: actorUser.uid,
        actorEmail: actorUser.email,
        timestamp: now,
        businessId,
        notes: notes || `Permanently removed staff member (${currentData.displayName || currentData.email}) from project via Cloud Function`,
      });

      return {
        success: true,
        removedUid: targetUid,
        targetEmail: currentData.email,
        targetName: currentData.displayName,
      };
    });

    // Invalidate refresh tokens on removal
    try {
      await adminAuth.revokeRefreshTokens(targetUid);
    } catch (revokeErr) {
      console.warn('[removeStaffMemberCallable] revokeRefreshTokens notice:', revokeErr?.message);
    }

    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err.message);
  }
});

