/**
 * TPS Battery House — Centralized Role-Based Access Control (RBAC) Permissions
 *
 * Enforces role definitions and granular capability checks across:
 * - Admin: Full operational & financial authority, settings & member management
 * - Manager: Operational management, catalog & customer management, no deletion/settings
 * - Cashier: Daily invoice creation & billing, view-only catalog & customers, restricted edits
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
});

export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

export const ROLE_CONFIG = Object.freeze({
  [ROLES.ADMIN]: {
    id: ROLES.ADMIN,
    label: 'Administrator',
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20',
    description: 'Full administrative access to all stores, financial records, settings, and staff.',
  },
  [ROLES.MANAGER]: {
    id: ROLES.MANAGER,
    label: 'Store Manager',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Operational store manager with catalog and customer management authority.',
  },
  [ROLES.CASHIER]: {
    id: ROLES.CASHIER,
    label: 'Billing Cashier',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Front-desk point-of-sale cashier for GST bill generation and payment receipt.',
  },
});

/**
 * Detailed permission matrix mapped to roles
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: {
    canViewDashboard: true,
    dashboardLevel: 'full',
    canCreateInvoice: true,
    canViewInvoices: true,
    canEditInvoice: true,
    canDeleteInvoice: true,
    canManageCatalog: true,
    canViewCatalog: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canManageStaff: true,
    canManageSettings: true,
  },
  [ROLES.MANAGER]: {
    canViewDashboard: true,
    dashboardLevel: 'view',
    canCreateInvoice: true,
    canViewInvoices: true,
    canEditInvoice: true,
    canDeleteInvoice: false,
    canManageCatalog: true,
    canViewCatalog: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canManageStaff: false,
    canManageSettings: false,
  },
  [ROLES.CASHIER]: {
    canViewDashboard: true,
    dashboardLevel: 'limited',
    canCreateInvoice: true,
    canViewInvoices: true,
    canEditInvoice: false, // Restricted: cashiers can create fresh bills, but cannot alter historical finalized invoices
    canDeleteInvoice: false,
    canManageCatalog: false,
    canViewCatalog: true,
    canManageCustomers: false,
    canViewCustomers: true,
    canManageStaff: false,
    canManageSettings: false,
  },
});

/**
 * Returns permissions object for a given role (defaults to no permissions if invalid/missing)
 */
export function getPermissionsForRole(role) {
  if (!role || !ROLE_PERMISSIONS[role]) {
    return Object.freeze({
      canViewDashboard: false,
      dashboardLevel: 'none',
      canCreateInvoice: false,
      canViewInvoices: false,
      canEditInvoice: false,
      canDeleteInvoice: false,
      canManageCatalog: false,
      canViewCatalog: false,
      canManageCustomers: false,
      canViewCustomers: false,
      canManageStaff: false,
      canManageSettings: false,
    });
  }
  return ROLE_PERMISSIONS[role];
}

/**
 * Individual granular helper predicates
 */
export function hasPermission(role, permissionKey) {
  const perms = getPermissionsForRole(role);
  return Boolean(perms[permissionKey]);
}

export function canDeleteInvoice(role) {
  return hasPermission(role, 'canDeleteInvoice');
}

export function canEditInvoice(role) {
  return hasPermission(role, 'canEditInvoice');
}

export function canManageStaff(role) {
  return hasPermission(role, 'canManageStaff');
}

export function canManageSettings(role) {
  return hasPermission(role, 'canManageSettings');
}

export function canManageCatalog(role) {
  return hasPermission(role, 'canManageCatalog');
}

export function canCreateInvoice(role) {
  return hasPermission(role, 'canCreateInvoice');
}

