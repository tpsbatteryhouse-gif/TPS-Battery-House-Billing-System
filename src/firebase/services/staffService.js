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
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { ROLES, ACCOUNT_STATUS } from '../../utils/permissions.js';

import {
  executeRoleChangeTransaction,
  executeStatusChangeTransaction,
  executeStaffApprovalTransaction,
  executeStaffRejectionTransaction,
  executeStaffUidMigrationTransaction,
  getPrimaryAdminConfig,
  revokeStaffSession,
} from './trustedStaffBackend.js';

export {
  executeRoleChangeTransaction,
  executeStatusChangeTransaction,
  executeStaffApprovalTransaction,
  executeStaffRejectionTransaction,
  executeStaffUidMigrationTransaction,
  getPrimaryAdminConfig,
  revokeStaffSession,
};

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
 * Committed atomically alongside its audit record via trusted backend transaction.
 */
export async function approveStaffMember(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  role,
  adminUser,
  dbInstance = db
) {
  return executeStaffApprovalTransaction(dbInstance, {
    businessId,
    targetUid: uid,
    role,
    actorUser: adminUser,
  });
}

/**
 * Directly registers a staff member without requiring a prior pending registration
 * (Used when Administrator manually adds a team member by UID/email)
 * Committed atomically alongside its audit log.
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
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const logRef = doc(dbInstance, 'businesses', businessId, 'staff_audit_logs', logId);

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

  const auditPayload = {
    id: logId,
    targetUid: uid,
    targetEmail: normalizeEmail(email),
    targetName: payload.displayName,
    action: 'STAFF_APPROVED',
    previousValue: null,
    newValue: { role, status: ACCOUNT_STATUS.ACTIVE },
    actorUid: adminUser.uid,
    actorEmail: normalizeEmail(adminUser.email),
    timestamp: now,
    businessId,
    notes: `Direct staff member registration by administrator as ${role}`,
  };

  await runTransaction(dbInstance, async (transaction) => {
    transaction.set(memberRef, payload);
    transaction.set(logRef, auditPayload);
  });

  return payload;
}

/**
 * Rejects a pending staff registration atomically on the backend
 */
export async function rejectStaffRegistration(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  rejectionReason = '',
  adminUser,
  dbInstance = db
) {
  return executeStaffRejectionTransaction(dbInstance, {
    businessId,
    targetUid: uid,
    rejectionReason,
    actorUser: adminUser,
  });
}

/**
 * Updates staff member role with self-promotion and last-admin safeguards
 * Executed via trusted transactional backend with optimistic concurrency control.
 */
export async function updateStaffRole(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  newRole,
  adminUser,
  dbInstance = db
) {
  return executeRoleChangeTransaction(dbInstance, {
    businessId,
    targetUid: uid,
    newRole,
    actorUser: adminUser,
  });
}

/**
 * Updates staff account status (active / disabled) with self-lockout and last-admin safeguards
 * Executed via trusted transactional backend with optimistic concurrency control.
 */
export async function updateStaffStatus(
  businessId = DEFAULT_BUSINESS_ID,
  uid,
  newStatus,
  adminUser,
  dbInstance = db
) {
  const result = await executeStatusChangeTransaction(dbInstance, {
    businessId,
    targetUid: uid,
    newStatus,
    actorUser: adminUser,
  });

  if (newStatus === ACCOUNT_STATUS.DISABLED) {
    try {
      await revokeStaffSession(null, uid);
    } catch (revokeErr) {
      console.warn('[StaffService] revokeStaffSession notice:', revokeErr?.message);
    }
  }

  return result;
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

/**
 * Safely migrates an existing staff member from a legacy/placeholder UID to their canonical Google Auth UID.
 * Executed via trusted transactional backend with optimistic concurrency control,
 * destination identity verification, and atomic audit logging.
 */
export async function migrateStaffMemberUid(
  businessId = DEFAULT_BUSINESS_ID,
  oldUid,
  newUid,
  adminUser,
  dbInstance = db,
  destinationEmail = null
) {
  return executeStaffUidMigrationTransaction(dbInstance, {
    businessId,
    oldUid,
    newUid,
    actorUser: adminUser,
    destinationEmail,
  });
}
