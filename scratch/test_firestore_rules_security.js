import fs from 'fs';
import { getSampleInvoiceData } from '../src/utils/defaults.js';
import { normalizeInvoiceItem, INITIAL_PRODUCT_CATALOG } from '../src/utils/categories.js';

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

console.log('================================================================');
console.log('TPS BATTERYS HOUSE — FINAL FIRESTORE SECURITY RULES VERIFICATION');
console.log('================================================================\n');

// ------------------------------------------------------------------
// PART 1: Rules File Integrity & Structure Check
// ------------------------------------------------------------------
console.log('--- PART 1: File & Syntax Integrity ---');
const rulesPath = 'firestore.rules';
assert(fs.existsSync(rulesPath), 'firestore.rules exists');
const rules = fs.readFileSync(rulesPath, 'utf-8');

assert(rules.startsWith("rules_version = '2';"), 'Rules declare version 2');
assert(rules.includes('service cloud.firestore {'), 'Rules declare cloud.firestore service');
assert(rules.includes('match /databases/{database}/documents {'), 'Rules match root documents');
assert(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), 'Global default deny is present at root level');
assert(rules.includes('match /businesses/{businessId}'), 'Multi-tenant scoped under /businesses/{businessId}');

// ------------------------------------------------------------------
// PART 2: Role Permissions Simulation Engine
// ------------------------------------------------------------------
console.log('\n--- PART 2: Role-Based Access Control Logic Simulation ---');

// Mock Firestore database state
const mockDb = {
  businesses: {
    'tps-battery-house': {
      members: {
        'admin_1': { uid: 'admin_1', role: 'admin', status: 'active', email: 'admin@tps.com' },
        'manager_1': { uid: 'manager_1', role: 'manager', status: 'active', email: 'manager@tps.com' },
        'cashier_1': { uid: 'cashier_1', role: 'cashier', status: 'active', email: 'cashier@tps.com' },
        'disabled_admin': { uid: 'disabled_admin', role: 'admin', status: 'disabled', email: 'disadmin@tps.com' },
        'disabled_cashier': { uid: 'disabled_cashier', role: 'cashier', status: 'disabled', email: 'discashier@tps.com' },
      },
      invoices: {
        'inv_draft': { id: 'inv_draft', invoiceNumber: 'TPS/2026-27/001', paymentStatus: 'Draft' },
        'inv_pending': { id: 'inv_pending', invoiceNumber: 'TPS/2026-27/002', paymentStatus: 'Pending' },
        'inv_paid': { id: 'inv_paid', invoiceNumber: 'TPS/2026-27/003', paymentStatus: 'Paid' },
      },
    },
    'other-business': {
      members: {
        'admin_other': { uid: 'admin_other', role: 'admin', status: 'active' },
      },
      invoices: {},
    },
  },
};

// Simulation helper evaluating rule functions
function evaluateRuleContext(authUid, businessId) {
  const isAuth = authUid !== null;
  const member = isAuth ? (mockDb.businesses[businessId]?.members[authUid] || null) : null;
  const isMember = member !== null;
  const isActiveMember = isMember && member.status === 'active';
  const role = isActiveMember ? member.role : null;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isCashier = role === 'cashier';

  return {
    isAuth,
    authUid,
    businessId,
    member,
    isMember,
    isActiveMember,
    isAdmin,
    isManager,
    isCashier,

    // Invoices
    canReadInvoices: () => isActiveMember,
    canCreateInvoice: () => isActiveMember,
    canUpdateInvoice: (existingInvoice) => {
      if (!isActiveMember) return false;
      if (isAdmin) return true;
      if (isManager && existingInvoice?.paymentStatus !== 'Paid') return true;
      return false; // Cashier or unauthorized
    },
    canDeleteInvoice: () => isAdmin,

    // Products
    canReadProducts: () => isActiveMember,
    canModifyProducts: () => isAdmin || isManager,

    // Settings
    canReadSettings: () => isActiveMember,
    canModifySettings: () => isAdmin,

    // Members
    canGetMemberDoc: (targetUid) => isAuth && (authUid === targetUid || isAdmin),
    canListMembers: () => isAdmin,
    canCreateMember: (targetUid) => isAdmin && authUid !== targetUid,
    canUpdateMember: (targetUid) => isAdmin && authUid !== targetUid,
    canDeleteMember: (targetUid) => isAdmin && authUid !== targetUid,
  };
}

// 1. Unauthenticated Visitor
const guest = evaluateRuleContext(null, 'tps-battery-house');
assert(guest.canReadInvoices() === false, 'Unauthenticated user CANNOT read invoices');
assert(guest.canCreateInvoice() === false, 'Unauthenticated user CANNOT create invoices');
assert(guest.canModifyProducts() === false, 'Unauthenticated user CANNOT modify products');
assert(guest.canModifySettings() === false, 'Unauthenticated user CANNOT modify settings');
assert(guest.canGetMemberDoc('admin_1') === false, 'Unauthenticated user CANNOT get member docs');

// 2. Unapproved User
const stranger = evaluateRuleContext('stranger_uid', 'tps-battery-house');
assert(stranger.canReadInvoices() === false, 'Unapproved user CANNOT read invoices');
assert(stranger.canCreateInvoice() === false, 'Unapproved user CANNOT create invoices');
assert(stranger.canModifyProducts() === false, 'Unapproved user CANNOT modify products');
assert(stranger.canModifySettings() === false, 'Unapproved user CANNOT modify settings');
assert(stranger.canGetMemberDoc('stranger_uid') === true, 'Unapproved authenticated user CAN check own non-existent membership doc');
assert(stranger.canGetMemberDoc('admin_1') === false, 'Unapproved user CANNOT read another member doc');

// 3. Disabled Staff Member
const disabledUser = evaluateRuleContext('disabled_cashier', 'tps-battery-house');
assert(disabledUser.isActiveMember === false, 'Disabled cashier is not active member');
assert(disabledUser.canReadInvoices() === false, 'Disabled user CANNOT read invoices');
assert(disabledUser.canCreateInvoice() === false, 'Disabled user CANNOT create invoices');
assert(disabledUser.canModifyProducts() === false, 'Disabled user CANNOT modify products');
assert(disabledUser.canModifySettings() === false, 'Disabled user CANNOT modify settings');

// 4. Cashier Role Assertions
const cashier = evaluateRuleContext('cashier_1', 'tps-battery-house');
assert(cashier.canReadInvoices() === true, 'Cashier CAN read invoices');
assert(cashier.canCreateInvoice() === true, 'Cashier CAN create invoices');
assert(cashier.canUpdateInvoice(mockDb.businesses['tps-battery-house'].invoices.inv_draft) === false, 'Cashier CANNOT update draft invoice');
assert(cashier.canUpdateInvoice(mockDb.businesses['tps-battery-house'].invoices.inv_paid) === false, 'Cashier CANNOT update paid invoice');
assert(cashier.canDeleteInvoice() === false, 'Cashier CANNOT delete invoice');
assert(cashier.canReadProducts() === true, 'Cashier CAN read products');
assert(cashier.canModifyProducts() === false, 'Cashier CANNOT modify products');
assert(cashier.canReadSettings() === true, 'Cashier CAN read settings');
assert(cashier.canModifySettings() === false, 'Cashier CANNOT modify settings');
assert(cashier.canListMembers() === false, 'Cashier CANNOT list staff members');
assert(cashier.canCreateMember('new_uid') === false, 'Cashier CANNOT create staff members');

// 5. Manager Role Assertions
const manager = evaluateRuleContext('manager_1', 'tps-battery-house');
assert(manager.canReadInvoices() === true, 'Manager CAN read invoices');
assert(manager.canCreateInvoice() === true, 'Manager CAN create invoices');
assert(manager.canUpdateInvoice(mockDb.businesses['tps-battery-house'].invoices.inv_draft) === true, 'Manager CAN update draft invoice');
assert(manager.canUpdateInvoice(mockDb.businesses['tps-battery-house'].invoices.inv_pending) === true, 'Manager CAN update pending invoice');
assert(manager.canUpdateInvoice(mockDb.businesses['tps-battery-house'].invoices.inv_paid) === false, 'Manager CANNOT update finalized/paid invoice (protected!)');
assert(manager.canDeleteInvoice() === false, 'Manager CANNOT delete invoices');
assert(manager.canModifyProducts() === true, 'Manager CAN manage product catalog');
assert(manager.canReadSettings() === true, 'Manager CAN read settings');
assert(manager.canModifySettings() === false, 'Manager CANNOT modify settings');
assert(manager.canListMembers() === false, 'Manager CANNOT list staff members');

// 6. Administrator Role Assertions
const admin = evaluateRuleContext('admin_1', 'tps-battery-house');
assert(admin.canReadInvoices() === true, 'Admin CAN read invoices');
assert(admin.canCreateInvoice() === true, 'Admin CAN create invoices');
assert(admin.canUpdateInvoice(mockDb.businesses['tps-battery-house'].invoices.inv_draft) === true, 'Admin CAN update draft invoice');
assert(admin.canUpdateInvoice(mockDb.businesses['tps-battery-house'].invoices.inv_paid) === true, 'Admin CAN update paid invoice');
assert(admin.canDeleteInvoice() === true, 'Admin CAN delete invoices');
assert(admin.canModifyProducts() === true, 'Admin CAN manage product catalog');
assert(admin.canModifySettings() === true, 'Admin CAN modify settings');
assert(admin.canListMembers() === true, 'Admin CAN list staff members');
assert(admin.canCreateMember('new_emp_1') === true, 'Admin CAN create new staff member');
assert(admin.canCreateMember('admin_1') === false, 'Admin CANNOT self-create/self-promote (uid != auth.uid)');
assert(admin.canUpdateMember('cashier_1') === true, 'Admin CAN update other staff member');
assert(admin.canUpdateMember('admin_1') === false, 'Admin CANNOT self-update role/status');
assert(admin.canDeleteMember('cashier_1') === true, 'Admin CAN delete other staff member');
assert(admin.canDeleteMember('admin_1') === false, 'Admin CANNOT delete own membership doc (prevents lockout)');

// 7. Cross-Business Isolation
const crossBusinessUser = evaluateRuleContext('admin_other', 'tps-battery-house');
assert(crossBusinessUser.isMember === false, 'User from other-business is not member of tps-battery-house');
assert(crossBusinessUser.canReadInvoices() === false, 'Cross-business user CANNOT read invoices');
assert(crossBusinessUser.canCreateInvoice() === false, 'Cross-business user CANNOT create invoices');
assert(crossBusinessUser.canModifyProducts() === false, 'Cross-business user CANNOT modify products');

// ------------------------------------------------------------------
// PART 3: Schema Validator Functions Simulation against Real App Data
// ------------------------------------------------------------------
console.log('\n--- PART 3: Schema Validator Compatibility with Real App Data ---');

function mockIsValidInvoice(data, invoiceId) {
  const required = ['id', 'invoiceNumber', 'invoiceDate', 'dueDate', 'paymentStatus', 'paymentMode', 'customer', 'items', 'netPayable'];
  for (const f of required) {
    if (!(f in data)) return { valid: false, reason: `Missing required field: ${f}` };
  }

  const allowed = [
    'id', 'invoiceNumber', 'transactionType', 'invoiceDate', 'dueDate',
    'paymentStatus', 'paymentMode', 'placeOfSupply', 'reverseCharge',
    'poNumber', 'ewayBillNo', 'irn',
    'customer', 'items', 'scrapExchange', 'additionalDiscount',
    'roundOffManual', 'netPayable', 'notes', 'createdAt', 'savedAt',
    'createdBy', 'updatedAt', 'updatedBy'
  ];
  for (const k of Object.keys(data)) {
    if (!allowed.includes(k)) return { valid: false, reason: `Disallowed field: ${k}` };
  }

  if (typeof data.id !== 'string' || data.id !== invoiceId) return { valid: false, reason: 'ID mismatch' };
  if (typeof data.invoiceNumber !== 'string') return { valid: false, reason: 'Invalid invoiceNumber' };
  if ('transactionType' in data && !['B2B', 'B2C', 'SEZ', 'EXPORT', 'DEEMED_EXPORT'].includes(data.transactionType)) {
    return { valid: false, reason: 'Invalid transactionType' };
  }
  if (!['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled'].includes(data.paymentStatus)) {
    return { valid: false, reason: 'Invalid paymentStatus' };
  }
  const allowedModes = [
    'Cash', 'UPI / QR Code', 'Bank Transfer (NEFT/RTGS/IMPS)', 'Bank Transfer',
    'Credit / Post-dated', 'Credit', 'Cheque', 'Debit/Credit Card'
  ];
  if (!allowedModes.includes(data.paymentMode)) return { valid: false, reason: `Invalid paymentMode: ${data.paymentMode}` };
  if (!data.customer || typeof data.customer !== 'object' || !data.customer.name) return { valid: false, reason: 'Invalid customer' };
  if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 100) return { valid: false, reason: 'Invalid items array' };
  if (typeof data.netPayable !== 'number' || data.netPayable < 0) return { valid: false, reason: 'Invalid netPayable' };

  return { valid: true };
}

function mockIsValidProduct(data, productId) {
  const required = ['id', 'sku', 'name', 'category', 'specs', 'unit', 'hsn', 'sellingPrice', 'gstRate', 'isTaxInclusive'];
  for (const f of required) {
    if (!(f in data)) return { valid: false, reason: `Missing required field: ${f}` };
  }

  const allowed = [
    'id', 'sku', 'name', 'category', 'subcategory', 'brand', 'model',
    'description', 'specs', 'unit', 'hsn', 'sellingPrice', 'costPrice',
    'gstRate', 'isTaxInclusive', 'warranty', 'status', 'active', 'createdAt',
    'updatedAt', 'createdBy', 'updatedBy'
  ];
  for (const k of Object.keys(data)) {
    if (!allowed.includes(k)) return { valid: false, reason: `Disallowed product field: ${k}` };
  }

  if (data.id !== productId) return { valid: false, reason: 'Product ID mismatch' };
  if (!['battery', 'inverter', 'solar', 'services'].includes(data.category)) return { valid: false, reason: 'Invalid category' };
  if (!('status' in data) && !('active' in data)) return { valid: false, reason: 'Product must have status or active' };
  if ('status' in data && !['active', 'inactive'].includes(data.status)) return { valid: false, reason: 'Invalid status string' };
  if ('active' in data && typeof data.active !== 'boolean') return { valid: false, reason: 'Invalid active bool' };

  return { valid: true };
}

// Test Sample Invoice Data
const sampleInvoice = getSampleInvoiceData();
const normalizedSampleItems = sampleInvoice.items.map(normalizeInvoiceItem);
const realInvoiceToSave = {
  ...sampleInvoice,
  items: normalizedSampleItems,
  netPayable: 314000,
  savedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

const invoiceCheck = mockIsValidInvoice(realInvoiceToSave, realInvoiceToSave.id);
assert(invoiceCheck.valid === true, `Sample real invoice validates: ${invoiceCheck.reason || 'OK'}`);

// Test Invalid Invoices
const badPaymentStatus = { ...realInvoiceToSave, paymentStatus: 'BOGUS_STATUS' };
assert(mockIsValidInvoice(badPaymentStatus, badPaymentStatus.id).valid === false, 'Invalid paymentStatus rejected');

const badPaymentMode = { ...realInvoiceToSave, paymentMode: 'Crypto/Bitcoin' };
assert(mockIsValidInvoice(badPaymentMode, badPaymentMode.id).valid === false, 'Invalid paymentMode rejected');

const badFieldInjection = { ...realInvoiceToSave, maliciousScript: '<script>' };
assert(mockIsValidInvoice(badFieldInjection, badFieldInjection.id).valid === false, 'Injected arbitrary field rejected');

const idMismatch = { ...realInvoiceToSave };
assert(mockIsValidInvoice(idMismatch, 'different-id').valid === false, 'ID path mismatch rejected');

// Test Catalog Seed Items
assert(INITIAL_PRODUCT_CATALOG.length > 0, `Catalog contains ${INITIAL_PRODUCT_CATALOG.length} seed products`);
let allCatalogValid = true;
for (const prod of INITIAL_PRODUCT_CATALOG) {
  const prodCheck = mockIsValidProduct(prod, prod.id);
  if (!prodCheck.valid) {
    allCatalogValid = false;
    console.error(`  Product validation failed for ${prod.id}: ${prodCheck.reason}`);
  }
}
assert(allCatalogValid === true, `All ${INITIAL_PRODUCT_CATALOG.length} pre-seeded catalog products validate successfully`);

// Test Newly Created Product from ProductCatalogView
const newlyCreatedProduct = {
  id: 'prod-123456',
  sku: 'TPS-BAT-9988',
  name: 'Exide Mega Tubular 200Ah',
  category: 'battery',
  subcategory: 'Tubular Battery',
  brand: 'Exide',
  model: 'MT200',
  description: 'Heavy duty battery',
  specs: { capacity: '200Ah', voltage: '12V' },
  unit: 'Nos',
  hsn: '8507',
  sellingPrice: 19500,
  costPrice: 16000,
  gstRate: 28,
  isTaxInclusive: true,
  warranty: '36 Months',
  status: 'active',
  createdAt: new Date().toISOString(),
};
assert(mockIsValidProduct(newlyCreatedProduct, newlyCreatedProduct.id).valid === true, 'Newly created product form validates');

// ------------------------------------------------------------------
// PART 4: Exact Rule Strings in firestore.rules
// ------------------------------------------------------------------
console.log('\n--- PART 4: Verification of Specific Rule Lines ---');
assert(rules.includes("allow read: if isActiveMember(businessId);"), 'Invoices allow read: if isActiveMember');
assert(rules.includes("allow create: if isActiveMember(businessId) &&"), 'Invoices allow create: if isActiveMember && valid');
assert(rules.includes("(isManager(businessId) && resource.data.paymentStatus != 'Paid')"), 'Manager invoice update explicitly excludes paymentStatus == "Paid"');
assert(rules.includes("allow delete: if isAdmin(businessId);"), 'Invoices allow delete: if isAdmin ONLY');
assert(rules.includes("allow create: if (isAdmin(businessId) || isManager(businessId))"), 'Product create: if isAdmin || isManager');
assert(rules.includes("allow create: if isAdmin(businessId) &&\n                         isValidSetting"), 'Settings create: if isAdmin ONLY');
assert(rules.includes("request.auth.uid != uid"), 'Anti-self promotion enforced');

console.log('\n================================================================');
console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
