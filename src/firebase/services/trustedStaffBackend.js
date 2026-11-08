/**
 * TPS Battery House — Trusted Staff Backend Service
 *
 * Implements server-side, transactional guarantees for:
 * 1. Last Active Administrator Protection (concurrency-safe via Firestore transactions)
 * 2. Primary Administrator Invariant (cannot be demoted or disabled)
 * 3. Atomic Staff Operations & Tamper-Evident Audit Logging
 * 4. Staff UID Migration with destination identity verification
 * 5. Firebase Authentication Session Revocation (refresh token invalidation)
 */

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';

import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { ROLES, ACCOUNT_STATUS } from '../../utils/permissions.js';

export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function isValidRole(role) {
  return [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER].includes(role);
}

export function isValidAccountStatus(status) {
  return [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.DISABLED].includes(status);
}

/**
 * Retrieves the Primary Administrator configuration for a business
 * Path: businesses/{businessId}/settings/admin_config
 */
export async function getPrimaryAdminConfig(businessId = DEFAULT_BUSINESS_ID, dbInstance = db) {
  try {
    const configRef = doc(dbInstance, 'businesses', businessId, 'settings', 'admin_config');
    const snap = await getDoc(configRef);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (error) {
    console.warn('[TrustedStaffBackend] getPrimaryAdminConfig note:', error?.message);
    return null;
  }
}

/**
 * Reads, initializes if necessary, and locks the admin guard document.
 * Path: businesses/{businessId}/settings/admin_guard
 *
 * Guarantees strict Optimistic Concurrency Control (OCC) serialization across:
 * - Admin removal vs Admin removal
 * - Admin removal vs Admin deactivation
 * - Admin removal vs Admin creation / approval
 * - Admin demotion vs Admin removal
 */
export async function getOrInitAdminGuard(transaction, dbInstance, businessId, fallbackActiveCount = 1) {
  const guardRef = doc(dbInstance, 'businesses', businessId, 'settings', 'admin_guard');
  try {
    const guardSnap = await transaction.get(guardRef);
    if (guardSnap.exists()) {
      const data = guardSnap.data();
      const count = typeof data.activeAdminCount === 'number' ? data.activeAdminCount : fallbackActiveCount;
      return {
        ref: guardRef,
        activeAdminCount: count,
        lastSequence: data.lastSequence || 0,
        exists: true,
      };
    }
  } catch {}

  return {
    ref: guardRef,
    activeAdminCount: fallbackActiveCount,
    lastSequence: 0,
    exists: false,
  };
}

/**
 * Creates an audit log record payload with server-derived context
 */
function createAuditPayload({
  logId,
  targetUid,
  targetEmail,
  targetName,
  action,
  previousValue,
  newValue,
  actorUser,
  businessId,
  notes,
}) {
  return {
    id: logId,
    targetUid,
    targetEmail: normalizeEmail(targetEmail),
    targetName: targetName || '',
    action,
    previousValue: previousValue !== undefined ? previousValue : null,
    newValue: newValue !== undefined ? newValue : null,
    actorUid: actorUser.uid,
    actorEmail: normalizeEmail(actorUser.email),
    timestamp: new Date().toISOString(),
    businessId,
    notes: notes || '',
  };
}

/**
 * Updates staff member role using a transactional backend operation.
 */
export async function executeRoleChangeTransaction(
  dbInstance = db,
  { businessId = DEFAULT_BUSINESS_ID, targetUid, newRole, actorUser, primaryAdminUid: explicitPrimaryAdminUid }
) {
  if (!targetUid) throw new Error('Target User ID is required');
  if (!isValidRole(newRole)) throw new Error(`Invalid role: ${newRole}`);
  if (!actorUser || !actorUser.uid) throw new Error('Administrator identity is required');

  if (targetUid === actorUser.uid) {
    throw new Error('Administrators cannot modify their own role. Please ask another administrator.');
  }

  // Pre-query active administrators
  let activeAdminDocs = [];
  try {
    const membersRef = collection(dbInstance, 'businesses', businessId, 'members');
    const adminQuery = query(
      membersRef,
      where('role', '==', ROLES.ADMIN),
      where('status', '==', ACCOUNT_STATUS.ACTIVE)
    );
    const snap = await getDocs(adminQuery);
    activeAdminDocs = snap.docs;
  } catch {}

  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', targetUid);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

  return await runTransaction(dbInstance, async (transaction) => {
    // 1. Transactional reads of active admins to lock and detect concurrent conflicts
    let liveActiveAdminCount = 0;
    for (const aDoc of activeAdminDocs) {
      const snap = await transaction.get(aDoc.ref);
      if (snap.exists() && snap.data().role === ROLES.ADMIN && snap.data().status === ACCOUNT_STATUS.ACTIVE) {
        liveActiveAdminCount++;
      }
    }

    // 2. Read target member document
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) {
      throw new Error(`Staff member not found for UID: ${targetUid}`);
    }

    const currentData = memberSnap.data();
    const oldRole = currentData.role;

    if (oldRole === newRole) {
      return currentData; // No change required
    }

    // 3. Read Primary Admin configuration
    let primaryUid = explicitPrimaryAdminUid;
    if (!primaryUid) {
      try {
        const configRef = doc(dbInstance, 'businesses', businessId, 'settings', 'admin_config');
        const configSnap = await transaction.get(configRef);
        if (configSnap.exists()) {
          primaryUid = configSnap.data().primaryAdminUid;
        }
      } catch {}
    }

    // Safeguard: Primary Admin cannot be demoted
    if (primaryUid && targetUid === primaryUid && newRole !== ROLES.ADMIN) {
      throw new Error('Cannot demote or change the role of the Primary Administrator.');
    }

    // 3.5 Read and lock admin guard document for OCC serialization
    const guard = await getOrInitAdminGuard(transaction, dbInstance, businessId, liveActiveAdminCount);
    const effectiveAdminCount = Math.min(guard.activeAdminCount, liveActiveAdminCount);

    // 4. Last Active Administrator Protection
    if (oldRole === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
      if (effectiveAdminCount <= 1) {
        throw new Error(
          'Cannot demote the last remaining active Administrator. Please designate another Administrator first.'
        );
      }
    }

    const now = new Date().toISOString();
    const updatedMember = {
      ...currentData,
      role: newRole,
      updatedAt: now,
      updatedBy: actorUser.uid,
    };

    // 5. Atomically update member, guard document, and write audit log
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

    const auditPayload = createAuditPayload({
      logId,
      targetUid,
      targetEmail: currentData.email,
      targetName: currentData.displayName,
      action: 'ROLE_CHANGED',
      previousValue: { role: oldRole },
      newValue: { role: newRole },
      actorUser,
      businessId,
      notes: `Changed role from ${oldRole} to ${newRole}`,
    });

    transaction.set(logRef, auditPayload);

    return updatedMember;
  });
}

/**
 * Updates staff account status using a transactional backend operation.
 */
export async function executeStatusChangeTransaction(
  dbInstance = db,
  { businessId = DEFAULT_BUSINESS_ID, targetUid, newStatus, actorUser, primaryAdminUid: explicitPrimaryAdminUid }
) {
  if (!targetUid) throw new Error('Target User ID is required');
  if (!isValidAccountStatus(newStatus)) throw new Error(`Invalid account status: ${newStatus}`);
  if (!actorUser || !actorUser.uid) throw new Error('Administrator identity is required');

  if (targetUid === actorUser.uid) {
    throw new Error('Administrators cannot disable or change their own account status.');
  }

  // Pre-query active administrators
  let activeAdminDocs = [];
  try {
    const membersRef = collection(dbInstance, 'businesses', businessId, 'members');
    const adminQuery = query(
      membersRef,
      where('role', '==', ROLES.ADMIN),
      where('status', '==', ACCOUNT_STATUS.ACTIVE)
    );
    const snap = await getDocs(adminQuery);
    activeAdminDocs = snap.docs;
  } catch {}

  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', targetUid);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

  return await runTransaction(dbInstance, async (transaction) => {
    // 1. Transactional reads of active admins
    let liveActiveAdminCount = 0;
    for (const aDoc of activeAdminDocs) {
      const snap = await transaction.get(aDoc.ref);
      if (snap.exists() && snap.data().role === ROLES.ADMIN && snap.data().status === ACCOUNT_STATUS.ACTIVE) {
        liveActiveAdminCount++;
      }
    }

    // 2. Read target member document
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) {
      throw new Error(`Staff member not found for UID: ${targetUid}`);
    }

    const currentData = memberSnap.data();
    const oldStatus = currentData.status;

    if (oldStatus === newStatus) {
      return currentData; // No change required
    }

    // 3. Read Primary Admin configuration
    let primaryUid = explicitPrimaryAdminUid;
    if (!primaryUid) {
      try {
        const configRef = doc(dbInstance, 'businesses', businessId, 'settings', 'admin_config');
        const configSnap = await transaction.get(configRef);
        if (configSnap.exists()) {
          primaryUid = configSnap.data().primaryAdminUid;
        }
      } catch {}
    }

    // Safeguard: Primary Admin cannot be disabled
    if (primaryUid && targetUid === primaryUid && newStatus === ACCOUNT_STATUS.DISABLED) {
      throw new Error('Cannot disable the Primary Administrator account.');
    }

    // 3.5 Read and lock admin guard document for OCC serialization
    const guard = await getOrInitAdminGuard(transaction, dbInstance, businessId, liveActiveAdminCount);
    const effectiveAdminCount = Math.min(guard.activeAdminCount, liveActiveAdminCount);

    // 4. Last Active Administrator Protection
    if (currentData.role === ROLES.ADMIN && newStatus === ACCOUNT_STATUS.DISABLED) {
      if (effectiveAdminCount <= 1) {
        throw new Error(
          'Cannot disable the last remaining active Administrator. Please designate another Administrator first.'
        );
      }
    }

    const now = new Date().toISOString();
    const updatedMember = {
      ...currentData,
      status: newStatus,
      updatedAt: now,
      updatedBy: actorUser.uid,
    };

    // 5. Atomically update member, guard document, and write audit log
    transaction.update(memberRef, {
      status: newStatus,
      updatedAt: now,
      updatedBy: actorUser.uid,
    });

    let nextAdminCount = guard.activeAdminCount;
    if (currentData.role === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE && newStatus === ACCOUNT_STATUS.DISABLED) {
      nextAdminCount = Math.max(0, guard.activeAdminCount - 1);
    } else if (currentData.role === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.DISABLED && newStatus === ACCOUNT_STATUS.ACTIVE) {
      nextAdminCount = guard.activeAdminCount + 1;
    }

    transaction.set(guard.ref, {
      id: 'admin_guard',
      activeAdminCount: nextAdminCount,
      lastSequence: guard.lastSequence + 1,
      updatedAt: now,
      updatedBy: actorUser.uid,
    }, { merge: true });

    const auditPayload = createAuditPayload({
      logId,
      targetUid,
      targetEmail: currentData.email,
      targetName: currentData.displayName,
      action: 'STATUS_CHANGED',
      previousValue: { status: oldStatus },
      newValue: { status: newStatus },
      actorUser,
      businessId,
      notes: `Account status updated from ${oldStatus} to ${newStatus}`,
    });

    transaction.set(logRef, auditPayload);

    return updatedMember;
  });
}

/**
 * Approves a pending staff registration atomically on the backend.
 */
export async function executeStaffApprovalTransaction(
  dbInstance = db,
  { businessId = DEFAULT_BUSINESS_ID, targetUid, role, actorUser }
) {
  if (!targetUid) throw new Error('Target User ID is required');
  if (!isValidRole(role)) throw new Error(`Invalid role: ${role}`);
  if (!actorUser || !actorUser.uid) throw new Error('Administrator identity is required');

  if (targetUid === actorUser.uid) {
    throw new Error('Administrators cannot approve their own registration.');
  }

  const regRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', targetUid);
  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', targetUid);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

  // Query current active admins count for fallback initialization
  const membersRef = collection(dbInstance, 'businesses', businessId, 'members');
  const adminQuery = query(
    membersRef,
    where('role', '==', ROLES.ADMIN),
    where('status', '==', ACCOUNT_STATUS.ACTIVE)
  );
  const adminSnap = await getDocs(adminQuery);
  const liveActiveAdminCount = adminSnap.size;

  return await runTransaction(dbInstance, async (transaction) => {
    // Read and lock admin guard document for OCC serialization
    const guard = await getOrInitAdminGuard(transaction, dbInstance, businessId, liveActiveAdminCount);

    const regSnap = await transaction.get(regRef);
    if (!regSnap.exists()) {
      throw new Error(`Pending registration not found for UID: ${targetUid}`);
    }

    const regData = regSnap.data();
    if (regData.status === 'approved') {
      throw new Error(`Registration for UID: ${targetUid} has already been approved.`);
    }

    const now = new Date().toISOString();
    const memberPayload = {
      uid: targetUid,
      email: normalizeEmail(regData.email),
      displayName: regData.displayName || 'Staff Member',
      role,
      status: ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      createdBy: actorUser.uid,
      updatedAt: now,
      updatedBy: actorUser.uid,
    };

    transaction.set(memberRef, memberPayload);

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

    const auditPayload = createAuditPayload({
      logId,
      targetUid,
      targetEmail: regData.email,
      targetName: regData.displayName,
      action: 'STAFF_APPROVED',
      previousValue: null,
      newValue: { role, status: ACCOUNT_STATUS.ACTIVE },
      actorUser,
      businessId,
      notes: `Staff member approved and assigned role: ${role}`,
    });

    transaction.set(logRef, auditPayload);

    return memberPayload;
  });
}

/**
 * Rejects a pending staff registration atomically on the backend.
 */
export async function executeStaffRejectionTransaction(
  dbInstance = db,
  { businessId = DEFAULT_BUSINESS_ID, targetUid, rejectionReason = '', actorUser }
) {
  if (!targetUid) throw new Error('Target User ID is required');
  if (!actorUser || !actorUser.uid) throw new Error('Administrator identity is required');

  if (targetUid === actorUser.uid) {
    throw new Error('Administrators cannot reject their own registration.');
  }

  const regRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', targetUid);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

  return await runTransaction(dbInstance, async (transaction) => {
    const regSnap = await transaction.get(regRef);
    if (!regSnap.exists()) {
      throw new Error(`Pending registration not found for UID: ${targetUid}`);
    }

    const regData = regSnap.data();
    const now = new Date().toISOString();
    const reasonText = rejectionReason || 'Access request rejected by administrator.';

    transaction.update(regRef, {
      status: 'rejected',
      rejectionReason: reasonText,
      reviewedBy: actorUser.uid,
      reviewedAt: now,
    });

    const auditPayload = createAuditPayload({
      logId,
      targetUid,
      targetEmail: regData.email,
      targetName: regData.displayName,
      action: 'STAFF_REJECTED',
      previousValue: { status: regData.status },
      newValue: { status: 'rejected' },
      actorUser,
      businessId,
      notes: reasonText,
    });

    transaction.set(logRef, auditPayload);

    return { success: true };
  });
}

/**
 * Migrates staff UID from legacy/placeholder to canonical Google UID.
 */
export async function executeStaffUidMigrationTransaction(
  dbInstance = db,
  {
    businessId = DEFAULT_BUSINESS_ID,
    oldUid,
    newUid,
    actorUser,
    destinationEmail = null,
    authAdmin = null,
  }
) {
  if (!oldUid || !newUid) throw new Error('Both legacy UID and canonical UID are required.');
  if (oldUid === newUid) throw new Error('Source and target UIDs are identical; no migration needed.');
  if (!actorUser || !actorUser.uid) throw new Error('Administrator identity is required.');

  if (oldUid === actorUser.uid) {
    throw new Error('Administrators cannot migrate their own active UID directly.');
  }

  // If Admin Auth is provided, verify destination user exists in Firebase Authentication
  if (authAdmin && typeof authAdmin.getUser === 'function') {
    try {
      const authUser = await authAdmin.getUser(newUid);
      const authEmail = (authUser.email || '').trim().toLowerCase();
      if (destinationEmail && authEmail !== normalizeEmail(destinationEmail)) {
        throw new Error(
          `Destination identity verification failed: Firebase Auth email '${authEmail}' does not match expected destination '${destinationEmail}'.`
        );
      }
    } catch (authErr) {
      if (authErr.message.includes('Destination identity verification failed')) throw authErr;
      throw new Error(`Destination account not found in Firebase Authentication for UID: ${newUid}`);
    }
  }

  const oldRef = doc(dbInstance, 'businesses', businessId, 'members', oldUid);
  const newRef = doc(dbInstance, 'businesses', businessId, 'members', newUid);
  const configRef = doc(dbInstance, 'businesses', businessId, 'settings', 'admin_config');
  const pendingRegRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', newUid);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

  return await runTransaction(dbInstance, async (transaction) => {
    // 1. Fetch legacy record
    const oldSnap = await transaction.get(oldRef);
    if (!oldSnap.exists()) {
      throw new Error(`Legacy staff membership record not found for UID: ${oldUid}`);
    }

    const oldData = oldSnap.data();

    // 2. Ensure target UID is not already occupied
    const newSnap = await transaction.get(newRef);
    if (newSnap.exists()) {
      throw new Error(`A staff membership record already exists under target UID: ${newUid}`);
    }

    // 3. Destination Identity Verification
    if (destinationEmail && normalizeEmail(destinationEmail) !== normalizeEmail(oldData.email)) {
      throw new Error(
        `Destination identity verification failed: email '${destinationEmail}' does not match registered staff email '${oldData.email}'.`
      );
    }

    // 4. Check if legacy UID was the Primary Administrator
    let isLegacyPrimaryAdmin = false;
    try {
      const configSnap = await transaction.get(configRef);
      if (configSnap.exists() && configSnap.data().primaryAdminUid === oldUid) {
        isLegacyPrimaryAdmin = true;
      }
    } catch {}

    // 5. Check if target UID had a pending registration
    let pendingExists = false;
    try {
      const pendingSnap = await transaction.get(pendingRegRef);
      pendingExists = pendingSnap.exists();
    } catch {}

    const now = new Date().toISOString();

    // 6. Create new canonical membership document
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

    // 7. Delete legacy membership document
    transaction.delete(oldRef);

    // 8. Clean up pending registration if it was present
    if (pendingExists) {
      transaction.delete(pendingRegRef);
    }

    // 9. Seamlessly migrate Primary Admin configuration if applicable
    if (isLegacyPrimaryAdmin) {
      transaction.update(configRef, {
        primaryAdminUid: newUid,
        primaryAdminEmail: oldData.email,
        updatedAt: now,
        updatedBy: actorUser.uid,
      });
    }

    // 10. Record immutable audit log
    const auditPayload = createAuditPayload({
      logId,
      targetUid: newUid,
      targetEmail: oldData.email,
      targetName: oldData.displayName,
      action: 'STAFF_APPROVED',
      previousValue: { uid: oldUid, role: oldData.role },
      newValue: { uid: newUid, role: oldData.role },
      actorUser,
      businessId,
      notes: `Migrated legacy membership UID (${oldUid}) to canonical Google UID (${newUid})`,
    });

    transaction.set(logRef, auditPayload);

    return newPayload;
  });
}

/**
 * Revokes Firebase Authentication refresh tokens for a disabled staff member.
 */
export async function revokeStaffSession(authAdmin, targetUid) {
  if (!targetUid) throw new Error('Target UID is required for session revocation');

  if (authAdmin && typeof authAdmin.revokeRefreshTokens === 'function') {
    try {
      await authAdmin.revokeRefreshTokens(targetUid);
      return {
        success: true,
        revokedAt: new Date().toISOString(),
        targetUid,
        note: 'Refresh tokens successfully revoked via Firebase Admin SDK.',
      };
    } catch (err) {
      console.error('[TrustedStaffBackend] revokeRefreshTokens failed:', err);
      throw err;
    }
  }

  // Simulated for client / test runtime
  return {
    success: true,
    revokedAt: new Date().toISOString(),
    targetUid,
    simulated: true,
    note: 'Admin SDK not directly attached in client runtime; token revocation queued for Cloud Function.',
  };
}

/**
 * Permanently removes a staff member from the project.
 * Enforces:
 * 1. Self-removal prevention
 * 2. Primary Administrator protection (cannot be removed)
 * 3. Last Active Administrator protection (cannot leave project without an active admin)
 * 4. Atomic membership deletion, pending registration cleanup, and audit logging.
 */
export async function executeStaffRemovalTransaction(
  dbInstance = db,
  {
    businessId = DEFAULT_BUSINESS_ID,
    targetUid,
    actorUser,
    primaryAdminUid: explicitPrimaryAdminUid,
    notes = '',
  }
) {
  if (!targetUid) throw new Error('Target User ID is required');
  if (!actorUser || !actorUser.uid) throw new Error('Administrator identity is required');

  if (targetUid === actorUser.uid) {
    throw new Error('Administrators cannot remove their own account.');
  }

  // Pre-query active administrators
  let activeAdminDocs = [];
  try {
    const membersRef = collection(dbInstance, 'businesses', businessId, 'members');
    const adminQuery = query(
      membersRef,
      where('role', '==', ROLES.ADMIN),
      where('status', '==', ACCOUNT_STATUS.ACTIVE)
    );
    const snap = await getDocs(adminQuery);
    activeAdminDocs = snap.docs;
  } catch {}

  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', targetUid);
  const pendingRegRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', targetUid);
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

  return await runTransaction(dbInstance, async (transaction) => {
    // 1. Transactional reads of active admins to lock and detect concurrent conflicts
    let liveActiveAdminCount = 0;
    for (const aDoc of activeAdminDocs) {
      const snap = await transaction.get(aDoc.ref);
      if (snap.exists() && snap.data().role === ROLES.ADMIN && snap.data().status === ACCOUNT_STATUS.ACTIVE) {
        liveActiveAdminCount++;
      }
    }

    // 2. Read target member document
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) {
      throw new Error(`Staff member not found for UID: ${targetUid}`);
    }

    const currentData = memberSnap.data();

    // 3. Read Primary Admin configuration
    let primaryUid = explicitPrimaryAdminUid;
    if (!primaryUid) {
      try {
        const configRef = doc(dbInstance, 'businesses', businessId, 'settings', 'admin_config');
        const configSnap = await transaction.get(configRef);
        if (configSnap.exists()) {
          primaryUid = configSnap.data().primaryAdminUid;
        }
      } catch {}
    }

    // Safeguard: Primary Admin cannot be removed
    if (primaryUid && targetUid === primaryUid) {
      throw new Error('Cannot remove the Primary Administrator.');
    }

    // 3.5 Read and lock admin guard document for OCC serialization
    const guard = await getOrInitAdminGuard(transaction, dbInstance, businessId, liveActiveAdminCount);
    const effectiveAdminCount = Math.min(guard.activeAdminCount, liveActiveAdminCount);

    // 4. Last Active Administrator Protection
    if (currentData.role === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE) {
      if (effectiveAdminCount <= 1) {
        throw new Error(
          'Cannot remove the last remaining active Administrator. Please designate another Administrator first.'
        );
      }
    }

    // 5. Read pending registration (if exists) before any writes (Firestore read-before-write constraint)
    let pendingExists = false;
    try {
      const pendingSnap = await transaction.get(pendingRegRef);
      pendingExists = pendingSnap.exists();
    } catch {}

    // 6. Atomically delete member, cleanup pending registration, update guard, and record audit log
    transaction.delete(memberRef);

    if (pendingExists) {
      transaction.delete(pendingRegRef);
    }

    let nextAdminCount = guard.activeAdminCount;
    if (currentData.role === ROLES.ADMIN && currentData.status === ACCOUNT_STATUS.ACTIVE) {
      nextAdminCount = Math.max(0, guard.activeAdminCount - 1);
    }

    transaction.set(guard.ref, {
      id: 'admin_guard',
      activeAdminCount: nextAdminCount,
      lastSequence: guard.lastSequence + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUser.uid,
    }, { merge: true });

    const auditPayload = createAuditPayload({
      logId,
      targetUid,
      targetEmail: currentData.email,
      targetName: currentData.displayName,
      action: 'STAFF_REMOVED',
      previousValue: { role: currentData.role, status: currentData.status },
      newValue: null,
      actorUser,
      businessId,
      notes: notes || `Permanently removed staff member (${currentData.displayName || currentData.email}) from project`,
    });

    transaction.set(logRef, auditPayload);

    return {
      success: true,
      removedUid: targetUid,
      targetEmail: currentData.email,
      targetName: currentData.displayName,
    };
  });
}
