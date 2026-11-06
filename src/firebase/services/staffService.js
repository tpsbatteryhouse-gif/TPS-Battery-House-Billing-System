/**
 * TPS Battery House — Staff Management & Administration Service
 *
 * Handles staff membership directory, pending access approvals,
 * role management with last-admin protection, account status management
 * (active / disabled), and tamper-evident administrative audit logging.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { ROLES, ACCOUNT_STATUS } from '../../utils/permissions.js';

/**
 * Normalizes email address for consistency
 */
export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

/**
 * Validates role against supported system roles
 */
export function isValidRole(role) {
  return [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER].includes(role);
}

/**
 * Validates account status
 */
export function isValidAccountStatus(status) {
  return [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.DISABLED].includes(status);
}

/**
 * Retrieves all registered staff members for a business
 * Restricted to Administrators via Firestore Security Rules.
 */
export async function listStaffMembers(businessId = DEFAULT_BUSINESS_ID, dbInstance = db) {
  try {
    const membersRef = collection(dbInstance, 'businesses', businessId, 'members');
    const snapshot = await getDocs(membersRef);
    const members = [];

    snapshot.forEach((docSnap) => {
      members.push({
        ...docSnap.data(),
        id: docSnap.id,
        uid: docSnap.id,
      });
    });

    // Sort by role (Admin first, then Manager, Cashier) and then displayName
    const roleWeight = { [ROLES.ADMIN]: 1, [ROLES.MANAGER]: 2, [ROLES.CASHIER]: 3 };
    members.sort((a, b) => {
      const weightA = roleWeight[a.role] || 99;
      const weightB = roleWeight[b.role] || 99;
      if (weightA !== weightB) return weightA - weightB;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    return members;
  } catch (error) {
    console.error('[StaffService] listStaffMembers failed:', error);
    throw error;
  }
}

/**
 * Retrieves single staff member details
 */
export async function getStaffMember(businessId = DEFAULT_BUSINESS_ID, uid, dbInstance = db) {
  if (!uid) throw new Error('User ID is required');
  try {
    const memberRef = doc(dbInstance, 'businesses', businessId, 'members', uid);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) return null;
    return {
      ...memberSnap.data(),
      id: memberSnap.id,
      uid: memberSnap.id,
    };
  } catch (error) {
    console.error(`[StaffService] getStaffMember failed for ${uid}:`, error);
    throw error;
  }
}

/**
 * Retrieves count of currently active administrators
 */
export async function countActiveAdmins(businessId = DEFAULT_BUSINESS_ID, dbInstance = db) {
  try {
    const membersRef = collection(dbInstance, 'businesses', businessId, 'members');
    const q = query(
      membersRef,
      where('role', '==', ROLES.ADMIN),
      where('status', '==', ACCOUNT_STATUS.ACTIVE)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    console.error('[StaffService] countActiveAdmins query failed, falling back to full list check:', error);
    const all = await listStaffMembers(businessId, dbInstance);
    return all.filter((m) => m.role === ROLES.ADMIN && m.status === ACCOUNT_STATUS.ACTIVE).length;
  }
}

/**
 * Retrieves all pending staff registration requests
 * Restricted to Administrators via Firestore Security Rules.
 */
export async function listPendingRegistrations(businessId = DEFAULT_BUSINESS_ID, dbInstance = db) {
  try {
    const regRef = collection(dbInstance, 'businesses', businessId, 'pending_registrations');
    const snapshot = await getDocs(regRef);
    const requests = [];

    snapshot.forEach((docSnap) => {
      requests.push({
        ...docSnap.data(),
        id: docSnap.id,
        uid: docSnap.id,
      });
    });

    // Sort newest requestedAt first
    requests.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
    return requests;
  } catch (error) {
    console.error('[StaffService] listPendingRegistrations failed:', error);
    throw error;
  }
}

/**
 * Retrieves a single pending registration for the calling user
 */
export async function getPendingRegistration(businessId = DEFAULT_BUSINESS_ID, uid, dbInstance = db) {
  if (!uid) throw new Error('User ID is required');
  try {
    const regRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', uid);
    const snap = await getDoc(regRef);
    if (!snap.exists()) return null;
    return {
      ...snap.data(),
      id: snap.id,
      uid: snap.id,
    };
  } catch (error) {
    console.error(`[StaffService] getPendingRegistration failed for ${uid}:`, error);
    throw error;
  }
}

/**
 * Submits an access authorization request when a newly authenticated user signs in
 */
export async function submitPendingRegistration(
  businessId = DEFAULT_BUSINESS_ID,
  user,
  dbInstance = db
) {
  if (!user || !user.uid) throw new Error('User object with valid UID is required');
  if (!user.email) throw new Error('Valid email address is required');

  const uid = user.uid;
  const regRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', uid);

  // Check if existing registration exists
  const existing = await getPendingRegistration(businessId, uid, dbInstance);
  if (existing && existing.status === 'pending') {
    return existing; // Already pending
  }

  const payload = {
    uid,
    email: normalizeEmail(user.email),
    displayName: user.displayName || user.email.split('@')[0] || 'Staff Member',
    photoURL: user.photoURL || null,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  await setDoc(regRef, payload);
  return payload;
}

/**
 * Appends an immutable audit log entry for administrative actions
 */
export async function recordStaffAuditLog(
  businessId = DEFAULT_BUSINESS_ID,
  auditData,
  dbInstance = db
) {
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

  const payload = {
    id: logId,
    targetUid: auditData.targetUid,
    targetEmail: normalizeEmail(auditData.targetEmail),
    targetName: auditData.targetName || '',
    action: auditData.action, // 'STAFF_APPROVED', 'STAFF_REJECTED', 'ROLE_CHANGED', 'STATUS_CHANGED'
    previousValue: auditData.previousValue !== undefined ? auditData.previousValue : null,
    newValue: auditData.newValue !== undefined ? auditData.newValue : null,
    actorUid: auditData.actorUid,
    actorEmail: normalizeEmail(auditData.actorEmail),
    timestamp: new Date().toISOString(),
    businessId,
    notes: auditData.notes || '',
  };

  await setDoc(logRef, payload);
  return payload;
}

/**
 * Approves a pending staff registration and provisions their active membership
 */
export async function approveStaffMember(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  role,
  adminUser,
  dbInstance = db
) {
  if (!uid) throw new Error('Target User ID is required');
  if (!isValidRole(role)) throw new Error(`Invalid role: ${role}`);
  if (!adminUser || !adminUser.uid) throw new Error('Administrator identity is required');

  if (uid === adminUser.uid) {
    throw new Error('Administrators cannot approve their own registration.');
  }

  // Retrieve pending registration details
  const regRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', uid);
  const regSnap = await getDoc(regRef);
  if (!regSnap.exists()) {
    throw new Error(`Pending registration not found for UID: ${uid}`);
  }

  const regData = regSnap.data();
  const now = new Date().toISOString();

  // Create member record in /members/{uid}
  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', uid);
  const memberPayload = {
    uid,
    email: normalizeEmail(regData.email),
    displayName: regData.displayName || 'Staff Member',
    role,
    status: ACCOUNT_STATUS.ACTIVE,
    createdAt: now,
    createdBy: adminUser.uid,
    updatedAt: now,
    updatedBy: adminUser.uid,
  };

  await setDoc(memberRef, memberPayload);

  // Update pending registration document
  await updateDoc(regRef, {
    status: 'approved',
    assignedRole: role,
    reviewedBy: adminUser.uid,
    reviewedAt: now,
  });

  // Record audit log
  await recordStaffAuditLog(
    businessId,
    {
      targetUid: uid,
      targetEmail: regData.email,
      targetName: regData.displayName,
      action: 'STAFF_APPROVED',
      previousValue: null,
      newValue: { role, status: ACCOUNT_STATUS.ACTIVE },
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      notes: `Staff member approved and assigned role: ${role}`,
    },
    dbInstance
  );

  return memberPayload;
}

/**
 * Directly registers a staff member without requiring a prior pending registration
 * (Used when Administrator manually adds a team member by UID/email)
 */
export async function registerStaffMemberDirectly(
  businessId = DEFAULT_BUSINESS_ID,
  memberData,
  adminUser,
  dbInstance = db
) {
  const { uid, email, displayName, role } = memberData;
  if (!uid) throw new Error('Target User ID is required');
  if (!email) throw new Error('Email is required');
  if (!isValidRole(role)) throw new Error(`Invalid role: ${role}`);
  if (!adminUser || !adminUser.uid) throw new Error('Administrator identity is required');

  if (uid === adminUser.uid) {
    throw new Error('Administrators cannot create or register their own membership.');
  }

  const now = new Date().toISOString();
  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', uid);

  const payload = {
    uid,
    email: normalizeEmail(email),
    displayName: displayName || email.split('@')[0] || 'Staff Member',
    role,
    status: ACCOUNT_STATUS.ACTIVE,
    createdAt: now,
    createdBy: adminUser.uid,
    updatedAt: now,
    updatedBy: adminUser.uid,
  };

  await setDoc(memberRef, payload);

  await recordStaffAuditLog(
    businessId,
    {
      targetUid: uid,
      targetEmail: email,
      targetName: payload.displayName,
      action: 'STAFF_APPROVED',
      previousValue: null,
      newValue: { role, status: ACCOUNT_STATUS.ACTIVE },
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      notes: `Direct staff member registration by administrator as ${role}`,
    },
    dbInstance
  );

  return payload;
}

/**
 * Rejects a pending staff registration
 */
export async function rejectStaffRegistration(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  rejectionReason = '',
  adminUser,
  dbInstance = db
) {
  if (!uid) throw new Error('Target User ID is required');
  if (!adminUser || !adminUser.uid) throw new Error('Administrator identity is required');

  if (uid === adminUser.uid) {
    throw new Error('Administrators cannot reject their own registration.');
  }

  const regRef = doc(dbInstance, 'businesses', businessId, 'pending_registrations', uid);
  const regSnap = await getDoc(regRef);
  if (!regSnap.exists()) {
    throw new Error(`Pending registration not found for UID: ${uid}`);
  }

  const regData = regSnap.data();
  const now = new Date().toISOString();

  await updateDoc(regRef, {
    status: 'rejected',
    rejectionReason: rejectionReason || 'Access request rejected by administrator.',
    reviewedBy: adminUser.uid,
    reviewedAt: now,
  });

  await recordStaffAuditLog(
    businessId,
    {
      targetUid: uid,
      targetEmail: regData.email,
      targetName: regData.displayName,
      action: 'STAFF_REJECTED',
      previousValue: { status: regData.status },
      newValue: { status: 'rejected' },
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      notes: rejectionReason || 'Access request rejected by administrator.',
    },
    dbInstance
  );

  return { success: true };
}

/**
 * Updates staff member role with self-promotion and last-admin safeguards
 */
export async function updateStaffRole(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  newRole,
  adminUser,
  dbInstance = db
) {
  if (!uid) throw new Error('Target User ID is required');
  if (!isValidRole(newRole)) throw new Error(`Invalid role: ${newRole}`);
  if (!adminUser || !adminUser.uid) throw new Error('Administrator identity is required');

  // Anti-Self Modification Safeguard
  if (uid === adminUser.uid) {
    throw new Error('Administrators cannot modify their own role. Please ask another administrator.');
  }

  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    throw new Error(`Staff member not found for UID: ${uid}`);
  }

  const currentData = memberSnap.data();
  const oldRole = currentData.role;

  if (oldRole === newRole) {
    return currentData; // No change
  }

  // Last-Admin Protection: Prevent demoting the only active administrator
  if (oldRole === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
    const activeAdminCount = await countActiveAdmins(businessId, dbInstance);
    if (activeAdminCount <= 1) {
      throw new Error(
        'Cannot demote the last remaining active Administrator. Please designate another Administrator first.'
      );
    }
  }

  const now = new Date().toISOString();
  await updateDoc(memberRef, {
    role: newRole,
    updatedAt: now,
    updatedBy: adminUser.uid,
  });

  await recordStaffAuditLog(
    businessId,
    {
      targetUid: uid,
      targetEmail: currentData.email,
      targetName: currentData.displayName,
      action: 'ROLE_CHANGED',
      previousValue: { role: oldRole },
      newValue: { role: newRole },
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      notes: `Changed role from ${oldRole} to ${newRole}`,
    },
    dbInstance
  );

  return {
    ...currentData,
    role: newRole,
    updatedAt: now,
    updatedBy: adminUser.uid,
  };
}

/**
 * Updates staff account status (active / disabled) with self-lockout and last-admin safeguards
 */
export async function updateStaffStatus(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  newStatus,
  adminUser,
  dbInstance = db
) {
  if (!uid) throw new Error('Target User ID is required');
  if (!isValidAccountStatus(newStatus)) throw new Error(`Invalid account status: ${newStatus}`);
  if (!adminUser || !adminUser.uid) throw new Error('Administrator identity is required');

  // Anti-Self Lockout Safeguard
  if (uid === adminUser.uid) {
    throw new Error('Administrators cannot disable or change their own account status.');
  }

  const memberRef = doc(dbInstance, 'businesses', businessId, 'members', uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    throw new Error(`Staff member not found for UID: ${uid}`);
  }

  const currentData = memberSnap.data();
  const oldStatus = currentData.status;

  if (oldStatus === newStatus) {
    return currentData; // No change
  }

  // Last-Admin Protection: Prevent disabling the only active administrator
  if (currentData.role === ROLES.ADMIN && newStatus === ACCOUNT_STATUS.DISABLED) {
    const activeAdminCount = await countActiveAdmins(businessId, dbInstance);
    if (activeAdminCount <= 1) {
      throw new Error(
        'Cannot disable the last remaining active Administrator. Please designate another Administrator first.'
      );
    }
  }

  const now = new Date().toISOString();
  await updateDoc(memberRef, {
    status: newStatus,
    updatedAt: now,
    updatedBy: adminUser.uid,
  });

  await recordStaffAuditLog(
    businessId,
    {
      targetUid: uid,
      targetEmail: currentData.email,
      targetName: currentData.displayName,
      action: 'STATUS_CHANGED',
      previousValue: { status: oldStatus },
      newValue: { status: newStatus },
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      notes: `Account status updated from ${oldStatus} to ${newStatus}`,
    },
    dbInstance
  );

  return {
    ...currentData,
    status: newStatus,
    updatedAt: now,
    updatedBy: adminUser.uid,
  };
}

/**
 * Lists staff administrative audit log records
 * Restricted to Administrators via Firestore Security Rules.
 */
export async function listStaffAuditLogs(
  businessId = DEFAULT_BUSINESS_ID,
  maxRecords = 100,
  dbInstance = db
) {
  try {
    const logsRef = collection(dbInstance, 'businesses', businessId, 'staff_audit_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(maxRecords));
    const snap = await getDocs(q);
    const logs = [];

    snap.forEach((docSnap) => {
      logs.push({
        ...docSnap.data(),
        id: docSnap.id,
      });
    });

    return logs;
  } catch (error) {
    console.error('[StaffService] listStaffAuditLogs failed:', error);
    // Fallback without orderBy in case index is not built yet
    try {
      const logsRef = collection(dbInstance, 'businesses', businessId, 'staff_audit_logs');
      const snap = await getDocs(logsRef);
      const logs = [];
      snap.forEach((docSnap) => {
        logs.push({
          ...docSnap.data(),
          id: docSnap.id,
        });
      });
      logs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      return logs.slice(0, maxRecords);
    } catch (fallbackError) {
      console.error('[StaffService] listStaffAuditLogs fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}
