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
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'tps-battery-house',
  });
}

let adminDb = getFirestore();
let adminAuth = getAuth();

/**
 * Configures the admin instances for a specific project (used in automated test suites against emulators)
 * Strictly restricted to emulator and test environments.
 */
export function configureAdminForProject(projectId) {
  const isEmulatorOrTest =
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FUNCTIONS_EMULATOR) ||
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.FIREBASE_EMULATOR_HUB);

  if (!isEmulatorOrTest) {
    throw new Error('configureAdminForProject is strictly restricted to local test and emulator environments.');
  }

  const appName = `admin-app-${projectId}`;
  let app;
  const existing = getApps().find((a) => a.name === appName);
  if (existing) {
    app = existing;
  } else {
    app = initializeApp({ projectId }, appName);
  }
  adminDb = getFirestore(app);
  adminAuth = getAuth(app);
  return { adminDb, adminAuth };
}

/**
 * Allows test suites to inject custom Firestore/Auth instances (e.g. from rules-unit-testing context)
 * Strictly restricted to emulator and test environments.
 */
export function setAdminInstancesForTesting(customDb, customAuth) {
  const isEmulatorOrTest =
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FUNCTIONS_EMULATOR) ||
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.FIREBASE_EMULATOR_HUB);

  if (!isEmulatorOrTest) {
    throw new Error('setAdminInstancesForTesting is strictly restricted to local test and emulator environments.');
  }

  if (customDb) adminDb = customDb;
  if (customAuth) adminAuth = customAuth;
}

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
 * Reads, initializes if necessary, and locks the admin guard document in Cloud Functions.
 * Path: businesses/{businessId}/settings/admin_guard
 *
 * Guarantees strict Optimistic Concurrency Control (OCC) serialization across:
 * - Admin removal vs Admin removal
 * - Admin removal vs Admin deactivation
 * - Admin removal vs Admin creation / approval
 * - Admin demotion vs Admin removal
 */
async function getOrInitAdminGuard(transaction, businessId, fallbackActiveCount = 1) {
  const guardRef = adminDb.doc(`businesses/${businessId}/settings/admin_guard`);
  const guardSnap = await transaction.get(guardRef);
  if (guardSnap.exists) {
    const data = guardSnap.data();
    const count = typeof data.activeAdminCount === 'number' ? data.activeAdminCount : fallbackActiveCount;
    return {
      ref: guardRef,
      activeAdminCount: count,
      lastSequence: data.lastSequence || 0,
      exists: true,
    };
  }
  return {
    ref: guardRef,
    activeAdminCount: fallbackActiveCount,
    lastSequence: 0,
    exists: false,
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

      // 3.5 Read and lock admin guard document for OCC serialization
      const guard = await getOrInitAdminGuard(transaction, businessId, 1);

      // Last Active Admin check
      if (oldRole === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
        if (guard.activeAdminCount <= 1) {
          throw new HttpsError(
            'failed-precondition',
            'Cannot demote the last remaining active Administrator. Please designate another Administrator first.'
          );
        }
      }

      const now = new Date().toISOString();
      transaction.update(memberRef, {
        role: newRole,
        updatedAt: now,
        updatedBy: actorUser.uid,
      });

      let nextAdminCount = guard.activeAdminCount;
      if (oldRole === ROLES.ADMIN && newRole !== ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE) {
        nextAdminCount = Math.max(0, guard.activeAdminCount - 1);
      } else if (oldRole !== ROLES.ADMIN && newRole === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE) {
        nextAdminCount = guard.activeAdminCount + 1;
      }

      transaction.set(guard.ref, {
        id: 'admin_guard',
        activeAdminCount: nextAdminCount,
        lastSequence: guard.lastSequence + 1,
        updatedAt: now,
        updatedBy: actorUser.uid,
      }, { merge: true });

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
        timestamp: FieldValue.serverTimestamp(),
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

      // 3.5 Read and lock admin guard document for OCC serialization
      const guard = await getOrInitAdminGuard(transaction, businessId, 1);

      // Last Active Admin check
      if (currentData.role === ROLES.ADMIN && newStatus === ACCOUNT_STATUS.DISABLED) {
        if (guard.activeAdminCount <= 1) {
          throw new HttpsError(
            'failed-precondition',
            'Cannot disable the last remaining active Administrator. Please designate another Administrator first.'
          );
        }
      }

      const now = new Date().toISOString();
      transaction.update(memberRef, {
        status: newStatus,
        updatedAt: now,
        updatedBy: actorUser.uid,
      });

      let nextAdminCount = guard.activeAdminCount;
      if (currentData.role === ROLES.ADMIN && oldStatus === ACCOUNT_STATUS.ACTIVE && newStatus === ACCOUNT_STATUS.DISABLED) {
        nextAdminCount = Math.max(0, guard.activeAdminCount - 1);
      } else if (currentData.role === ROLES.ADMIN && oldStatus === ACCOUNT_STATUS.DISABLED && newStatus === ACCOUNT_STATUS.ACTIVE) {
        nextAdminCount = guard.activeAdminCount + 1;
      }

      transaction.set(guard.ref, {
        id: 'admin_guard',
        activeAdminCount: nextAdminCount,
        lastSequence: guard.lastSequence + 1,
        updatedAt: now,
        updatedBy: actorUser.uid,
      }, { merge: true });

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
        timestamp: FieldValue.serverTimestamp(),
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
      const guard = await getOrInitAdminGuard(transaction, businessId, 1);

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

      if (role === ROLES.ADMIN) {
        transaction.set(guard.ref, {
          id: 'admin_guard',
          activeAdminCount: guard.activeAdminCount + 1,
          lastSequence: guard.lastSequence + 1,
          updatedAt: now,
          updatedBy: actorUser.uid,
        }, { merge: true });
      }

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
        timestamp: FieldValue.serverTimestamp(),
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
        timestamp: FieldValue.serverTimestamp(),
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

  // 1. Destination identity verification directly against Firebase Authentication
  let destinationAuthUser;
  try {
    destinationAuthUser = await adminAuth.getUser(newUid);
  } catch {
    throw new HttpsError(
      'not-found',
      `Destination user account not found in Firebase Authentication for UID: ${newUid}`
    );
  }

  const destinationAuthEmail = (destinationAuthUser.email || '').trim().toLowerCase();
  if (!destinationAuthEmail) {
    throw new HttpsError(
      'failed-precondition',
      'Destination Firebase Authentication account does not have an associated email address.'
    );
  }

  const oldRef = adminDb.doc(`businesses/${businessId}/members/${oldUid}`);
  const newRef = adminDb.doc(`businesses/${businessId}/members/${newUid}`);
  const configRef = adminDb.doc(`businesses/${businessId}/settings/admin_config`);
  const pendingRegRef = adminDb.doc(`businesses/${businessId}/pending_registrations/${newUid}`);
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
      const registeredEmail = (oldData.email || '').trim().toLowerCase();

      // Destination identity verification: Auth email must match registered staff email
      if (destinationAuthEmail !== registeredEmail) {
        throw new HttpsError(
          'permission-denied',
          `Destination Firebase Authentication account email ('${destinationAuthEmail}') does not match registered staff email ('${registeredEmail}'). Migration aborted.`
        );
      }

      if (destinationEmail && destinationEmail.trim().toLowerCase() !== registeredEmail) {
        throw new HttpsError(
          'invalid-argument',
          `Provided destinationEmail ('${destinationEmail}') does not match registered staff email ('${registeredEmail}').`
        );
      }

      // Check if legacy user was the Primary Administrator
      let isLegacyPrimaryAdmin = false;
      const configSnap = await transaction.get(configRef);
      if (configSnap.exists && configSnap.data().primaryAdminUid === oldUid) {
        isLegacyPrimaryAdmin = true;
      }

      // Check if target UID had a pending registration
      const pendingSnap = await transaction.get(pendingRegRef);

      const now = new Date().toISOString();
      const newPayload = {
        uid: newUid,
        email: oldData.email,
        name: oldData.name || oldData.displayName || '',
        displayName: oldData.displayName || oldData.name || '',
        role: oldData.role,
        status: oldData.status,
        createdAt: oldData.createdAt || now,
        createdBy: oldData.createdBy || actorUser.uid,
        updatedAt: now,
        updatedBy: actorUser.uid,
      };

      transaction.set(newRef, newPayload);
      transaction.delete(oldRef);

      if (pendingSnap.exists) {
        transaction.delete(pendingRegRef);
      }

      if (isLegacyPrimaryAdmin) {
        transaction.update(configRef, {
          primaryAdminUid: newUid,
          primaryAdminEmail: oldData.email,
          updatedAt: now,
          updatedBy: actorUser.uid,
        });
      }

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
        timestamp: FieldValue.serverTimestamp(),
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

      // 3.5 Read and lock admin guard document for OCC serialization
      const guard = await getOrInitAdminGuard(transaction, businessId, 1);

      // Last Active Admin check
      if (currentData.role === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE) {
        if (guard.activeAdminCount <= 1) {
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

      let nextAdminCount = guard.activeAdminCount;
      if (currentData.role === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE) {
        nextAdminCount = Math.max(0, guard.activeAdminCount - 1);
      }

      const now = new Date().toISOString();

      transaction.set(guard.ref, {
        id: 'admin_guard',
        activeAdminCount: nextAdminCount,
        lastSequence: guard.lastSequence + 1,
        updatedAt: now,
        updatedBy: actorUser.uid,
      }, { merge: true });

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
        timestamp: FieldValue.serverTimestamp(),
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

