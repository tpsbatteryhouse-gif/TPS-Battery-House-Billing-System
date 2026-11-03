import fs from 'fs';
import {
  ROLES,
  ACCOUNT_STATUS,
  ROLE_CONFIG,
  getPermissionsForRole,
  canDeleteInvoice,
  canManageStaff,
  canManageSettings,
  canManageCatalog,
  canCreateInvoice,
} from '../src/utils/permissions.js';
import { AUTH_STATUS, DEFAULT_BUSINESS_ID } from '../src/context/authConstants.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('======================================================');
console.log('TPS BATTERYS HOUSE — AUTHENTICATION & ACCESS CONTROL SUITE');
console.log('======================================================\n');

// ------------------------------------------------------------------
// TEST 1: Role Configuration & Hierarchy
// ------------------------------------------------------------------
console.log('--- TEST 1: Role Configuration & Constants ---');
assert(ROLES.ADMIN === 'admin', 'ROLES.ADMIN is "admin"');
assert(ROLES.MANAGER === 'manager', 'ROLES.MANAGER is "manager"');
assert(ROLES.CASHIER === 'cashier', 'ROLES.CASHIER is "cashier"');
assert(ACCOUNT_STATUS.ACTIVE === 'active', 'ACCOUNT_STATUS.ACTIVE is "active"');
assert(ACCOUNT_STATUS.DISABLED === 'disabled', 'ACCOUNT_STATUS.DISABLED is "disabled"');
assert(DEFAULT_BUSINESS_ID === 'tps-battery-house', 'DEFAULT_BUSINESS_ID is "tps-battery-house"');
assert(Boolean(ROLE_CONFIG[ROLES.ADMIN]?.label), 'Admin role config has human-readable label');
assert(Boolean(ROLE_CONFIG[ROLES.MANAGER]?.label), 'Manager role config has human-readable label');
assert(Boolean(ROLE_CONFIG[ROLES.CASHIER]?.label), 'Cashier role config has human-readable label');

// ------------------------------------------------------------------
// TEST 2: Granular Role Permissions Matrix
// ------------------------------------------------------------------
console.log('\n--- TEST 2: Role Permissions Matrix ---');

// Admin
const adminPerms = getPermissionsForRole(ROLES.ADMIN);
assert(adminPerms.dashboardLevel === 'full', 'Admin dashboard level is full');
assert(adminPerms.canCreateInvoice === true, 'Admin can create invoices');
assert(adminPerms.canViewInvoices === true, 'Admin can view invoices');
assert(adminPerms.canEditInvoice === true, 'Admin can edit invoices');
assert(adminPerms.canDeleteInvoice === true, 'Admin can delete invoices');
assert(adminPerms.canManageCatalog === true, 'Admin can manage product catalog');
assert(adminPerms.canManageCustomers === true, 'Admin can manage customer records');
assert(adminPerms.canManageStaff === true, 'Admin can manage staff members');
assert(adminPerms.canManageSettings === true, 'Admin can manage store & bank settings');

// Manager
const managerPerms = getPermissionsForRole(ROLES.MANAGER);
assert(managerPerms.dashboardLevel === 'view', 'Manager dashboard level is view');
assert(managerPerms.canCreateInvoice === true, 'Manager can create invoices');
assert(managerPerms.canViewInvoices === true, 'Manager can view invoices');
assert(managerPerms.canEditInvoice === true, 'Manager can edit invoices');
assert(managerPerms.canDeleteInvoice === false, 'Manager CANNOT delete invoices');
assert(managerPerms.canManageCatalog === true, 'Manager can manage product catalog');
assert(managerPerms.canManageCustomers === true, 'Manager can manage customer records');
assert(managerPerms.canManageStaff === false, 'Manager CANNOT manage staff members');
assert(managerPerms.canManageSettings === false, 'Manager CANNOT manage store settings');

// Cashier
const cashierPerms = getPermissionsForRole(ROLES.CASHIER);
assert(cashierPerms.dashboardLevel === 'limited', 'Cashier dashboard level is limited');
assert(cashierPerms.canCreateInvoice === true, 'Cashier can create invoices');
assert(cashierPerms.canViewInvoices === true, 'Cashier can view invoices');
assert(cashierPerms.canEditInvoice === false, 'Cashier CANNOT edit finalized invoices');
assert(cashierPerms.canDeleteInvoice === false, 'Cashier CANNOT delete invoices');
assert(cashierPerms.canManageCatalog === false, 'Cashier CANNOT manage product catalog');
assert(cashierPerms.canViewCatalog === true, 'Cashier CAN view product catalog');
assert(cashierPerms.canManageCustomers === false, 'Cashier CANNOT manage customer records');
assert(cashierPerms.canViewCustomers === true, 'Cashier CAN view customer records');
assert(cashierPerms.canManageStaff === false, 'Cashier CANNOT manage staff members');
assert(cashierPerms.canManageSettings === false, 'Cashier CANNOT manage store settings');

// Unregistered / Guest Role
const guestPerms = getPermissionsForRole('unknown_role');
assert(guestPerms.canViewDashboard === false, 'Unregistered user has no dashboard access');
assert(guestPerms.canCreateInvoice === false, 'Unregistered user cannot create invoices');
assert(guestPerms.canDeleteInvoice === false, 'Unregistered user cannot delete invoices');
assert(guestPerms.canManageSettings === false, 'Unregistered user cannot access settings');

// Helper functions test
assert(canDeleteInvoice(ROLES.ADMIN) === true, 'canDeleteInvoice(admin) is true');
assert(canDeleteInvoice(ROLES.MANAGER) === false, 'canDeleteInvoice(manager) is false');
assert(canDeleteInvoice(ROLES.CASHIER) === false, 'canDeleteInvoice(cashier) is false');
assert(canManageStaff(ROLES.ADMIN) === true, 'canManageStaff(admin) is true');
assert(canManageStaff(ROLES.MANAGER) === false, 'canManageStaff(manager) is false');
assert(canManageSettings(ROLES.ADMIN) === true, 'canManageSettings(admin) is true');
assert(canManageSettings(ROLES.MANAGER) === false, 'canManageSettings(manager) is false');
assert(canManageCatalog(ROLES.MANAGER) === true, 'canManageCatalog(manager) is true');
assert(canManageCatalog(ROLES.CASHIER) === false, 'canManageCatalog(cashier) is false');
assert(canCreateInvoice(ROLES.CASHIER) === true, 'canCreateInvoice(cashier) is true');

// ------------------------------------------------------------------
// TEST 3: Authorization Workflow Emulation
// ------------------------------------------------------------------
console.log('\n--- TEST 3: Staff Authorization Workflow Emulation ---');

function evaluateAccess(firebaseUser, memberDocData) {
  if (!firebaseUser) {
    return { status: AUTH_STATUS.UNAUTHENTICATED, accessGranted: false };
  }
  if (!memberDocData) {
    return { status: AUTH_STATUS.UNAUTHORIZED, accessGranted: false };
  }
  if (memberDocData.status !== ACCOUNT_STATUS.ACTIVE) {
    return { status: AUTH_STATUS.DISABLED, accessGranted: false };
  }
  return {
    status: AUTH_STATUS.AUTHORIZED,
    accessGranted: true,
    role: memberDocData.role,
    permissions: getPermissionsForRole(memberDocData.role),
  };
}

// Scenario 1: Signed-out visitor
const scenario1 = evaluateAccess(null, null);
assert(scenario1.status === AUTH_STATUS.UNAUTHENTICATED, 'Signed-out visitor -> UNAUTHENTICATED');
assert(scenario1.accessGranted === false, 'Signed-out visitor -> accessGranted is false');

// Scenario 2: Unapproved Google user (no member doc)
const scenario2 = evaluateAccess({ uid: 'random_google_uid', email: 'stranger@gmail.com' }, null);
assert(scenario2.status === AUTH_STATUS.UNAUTHORIZED, 'Unapproved Google account -> UNAUTHORIZED');
assert(scenario2.accessGranted === false, 'Unapproved Google account -> accessGranted is false');

// Scenario 3: Disabled staff member
const scenario3 = evaluateAccess(
  { uid: 'staff_uid_01', email: 'former_staff@tps.com' },
  { uid: 'staff_uid_01', role: 'cashier', status: 'disabled' }
);
assert(scenario3.status === AUTH_STATUS.DISABLED, 'Disabled staff account -> DISABLED');
assert(scenario3.accessGranted === false, 'Disabled staff account -> accessGranted is false');

// Scenario 4: Active Admin
const scenario4 = evaluateAccess(
  { uid: 'admin_uid_01', email: 'owner@tps.com' },
  { uid: 'admin_uid_01', role: 'admin', status: 'active' }
);
assert(scenario4.status === AUTH_STATUS.AUTHORIZED, 'Active admin -> AUTHORIZED');
assert(scenario4.accessGranted === true, 'Active admin -> accessGranted is true');
assert(scenario4.permissions.canManageStaff === true, 'Active admin has canManageStaff permission');

// Scenario 5: Active Manager
const scenario5 = evaluateAccess(
  { uid: 'manager_uid_01', email: 'manager@tps.com' },
  { uid: 'manager_uid_01', role: 'manager', status: 'active' }
);
assert(scenario5.status === AUTH_STATUS.AUTHORIZED, 'Active manager -> AUTHORIZED');
assert(scenario5.accessGranted === true, 'Active manager -> accessGranted is true');
assert(scenario5.permissions.canDeleteInvoice === false, 'Active manager cannot delete invoices');

// Scenario 6: Active Cashier
const scenario6 = evaluateAccess(
  { uid: 'cashier_uid_01', email: 'counter@tps.com' },
  { uid: 'cashier_uid_01', role: 'cashier', status: 'active' }
);
assert(scenario6.status === AUTH_STATUS.AUTHORIZED, 'Active cashier -> AUTHORIZED');
assert(scenario6.accessGranted === true, 'Active cashier -> accessGranted is true');
assert(scenario6.permissions.canCreateInvoice === true, 'Active cashier can create invoices');
assert(scenario6.permissions.canManageCatalog === false, 'Active cashier cannot manage catalog');

// ------------------------------------------------------------------
// TEST 4: Cloud Firestore Security Rules Structure & Policy Audit
// ------------------------------------------------------------------
console.log('\n--- TEST 4: Cloud Firestore Security Rules Audit ---');
const rulesPath = 'firestore.rules';
assert(fs.existsSync(rulesPath), 'firestore.rules exists in repository root');

const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

// Global Default Deny
assert(
  rulesContent.includes('match /{document=**} {') && rulesContent.includes('allow read, write: if false;'),
  'Rules enforce global default-deny catch-all (allow read, write: if false)'
);

// Scoped Path
assert(
  rulesContent.includes('match /businesses/{businessId}'),
  'Rules scope all data under /businesses/{businessId}'
);

// Member Self-Read & List Protection
assert(
  rulesContent.includes('allow get: if isAuthenticated() && (request.auth.uid == uid || isAdmin(businessId))'),
  'Staff members can only get their own member document (or admin can get any)'
);
assert(
  rulesContent.includes('allow list: if isAdmin(businessId)'),
  'Member listing is restricted exclusively to active administrators (protects staff PII)'
);

// Anti-Self-Promotion & Lockdown
assert(
  rulesContent.includes('request.auth.uid != uid'),
  'Member creation, update, and deletion prevents self-promotion (request.auth.uid != uid)'
);

// Role validation in rules
assert(
  rulesContent.includes("data.role in ['admin', 'manager', 'cashier']"),
  'Rules validate allowed roles: admin, manager, cashier'
);
assert(
  rulesContent.includes("data.status in ['active', 'disabled']"),
  'Rules validate allowed statuses: active, disabled'
);

// Invoices collection rules
assert(
  rulesContent.includes('match /invoices/{invoiceId}'),
  'Rules define protected /invoices/{invoiceId} collection'
);
assert(
  rulesContent.includes('allow delete: if isAdmin(businessId)'),
  'Invoice deletion is strictly restricted to administrators'
);

// Products & Customers collections rules
assert(
  rulesContent.includes('allow create: if (isAdmin(businessId) || isManager(businessId))'),
  'Product creation restricted to Admin or Manager'
);

// Settings collection rules
assert(
  rulesContent.includes('match /settings/{settingId}') &&
    rulesContent.includes('allow create: if isAdmin(businessId)'),
  'Store settings changes restricted strictly to administrators'
);

console.log('\n======================================================');
console.log(`TOTAL PASS: ${passed}`);
console.log(`TOTAL FAIL: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}

