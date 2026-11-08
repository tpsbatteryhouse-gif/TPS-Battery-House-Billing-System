# TPS BATTERY HOUSE — FIRESTORE RBAC PERMISSION MATRIX
## Phase 6B Database Access Control & Authorization Specification

**Project:** TPS BATTERY HOUSE — GST Billing Application  
**Audit Date:** 2026-11-08T13:52:00+05:30  
**Rules Version:** `rules_version = '2'` (`firestore.rules`)  

---

## 1. Role-Based Access Control (RBAC) Matrix

The table below documents the authorized operations across roles (Admin, Manager, Cashier) and membership states (Active, Pending, Disabled, Removed/Missing) enforced by `firestore.rules`.

| Resource Collection | Admin (Active) | Manager (Active) | Cashier (Active) | Pending Member | Disabled Member | Removed / Missing |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Products (`/products/{id}`)** | `R, C, U, D` | `R, C, U, D` | `R` (Read-only) | Denied | Denied | Denied |
| **Customers (`/customers/{id}`)** | `R, C, U, D` | `R, C, U, D` | `R` (Read-only) | Denied | Denied | Denied |
| **Invoices (`/invoices/{id}`)** | `R, C, U, D` | `R, C, U*` (No Paid/Del) | `R, C` (Create-only) | Denied | Denied | Denied |
| **Sequential Counters (`/counters/{id}`)** | `R, C, U, D` | `R, U*` (Strict Incr) | `R, U*` (Strict Incr) | Denied | Denied | Denied |
| **Invoice Reservations (`/invoice_numbers/{id}`)** | `R, C*` (No U/D) | `R, C*` (No U/D) | `R, C*` (No U/D) | Denied | Denied | Denied |
| **Business Profile (`/settings/business_profile`)**| `R, C, U, D` | `R` (Read-only) | `R` (Read-only) | Denied | Denied | Denied |
| **Financial Details (`/settings/financial_details`)**| `R, C, U, D` | Denied | Denied | Denied | Denied | Denied |
| **Admin Config (`/settings/admin_config`)** | `R` (Backend write) | Denied | Denied | Denied | Denied | Denied |
| **Admin Guard (`/settings/admin_guard`)** | `R, C, U` | `R` (Read-only) | `R` (Read-only) | Denied | Denied | Denied |
| **Staff Memberships (`/members/{uid}`)** | `R, C, U*, D*` (No Self) | Denied (Get own) | Denied (Get own) | Denied (Get own) | Denied (Get own) | Denied |
| **Pending Registrations (`/pending_registrations/{uid}`)** | `R, C, U, D` | Denied (Get own) | Denied (Get own) | `Get, Create` (Self) | Denied (Get own) | `Get, Create` |
| **Staff Audit Logs (`/staff_audit_logs/{id}`)** | `R, C*` (No U/D) | Denied | Denied | Denied | Denied | Denied |

*Legend & Special Constraints:*
- `R`: Read (Get & List)
- `C`: Create
- `U`: Update
- `D`: Delete
- `U*` (Manager Invoices): Cannot update invoices whose existing status is `Paid` or `Cancelled`. Cannot change `items` or `netPayable` while marking `Paid`.
- `U*` (Counters): Non-admins can ONLY increment sequence by exactly `+1` atomically bound to an invoice creation in the same transaction.
- `C*` (Invoice Reservations): Create-only; `update` and `delete` are permanently blocked (`allow update, delete: if false`).
- `U*, D*` (Staff Memberships): Admin cannot update role/status or delete their own document (`request.auth.uid != uid`). Primary Administrator cannot be demoted, disabled, or deleted.

---

## 2. Resource-by-Resource Enforcement Details

### 2.1 Products (`/businesses/{businessId}/products/{productId}`)
- **Firestore Rule:** Lines 662–676 (`allow read: if isActiveMember; allow create, update, delete: if isAdmin || isManager`)
- **Service Layer:** `src/firebase/services/productService.js` (`getProducts`, `saveProduct`, `deleteProduct`)
- **Backend Function:** Direct client Firestore SDK with rules enforcement.
- **Emulator Verification:** Cashier write attempts rejected; Admin/Manager operations allowed.

### 2.2 Customers (`/businesses/{businessId}/customers/{customerId}`)
- **Firestore Rule:** Lines 681–695 (`allow read: if isActiveMember; allow create, update, delete: if isAdmin || isManager`)
- **Service Layer:** `src/firebase/services/customerService.js` (`getCustomers`, `saveCustomer`, `deleteCustomer`)
- **Backend Function:** Direct client Firestore SDK.
- **Emulator Verification:** Cashier write attempts rejected; Manager update allowed.

### 2.3 Invoices (`/businesses/{businessId}/invoices/{invoiceId}`)
- **Firestore Rule:** Lines 568–657 (`allow read: if isActiveMember; allow create: if isActiveMember && [valid atomic counter/reservation linkage]; allow update: if admin || manager [restricted]; allow delete: if admin`)
- **Service Layer:** `src/firebase/services/invoiceService.js` (`createInvoiceWithCounter`, `updateInvoice`, `deleteInvoice`)
- **Backend Function:** Atomic multi-document transaction (`invoices`, `counters`, `invoice_numbers`).
- **Emulator Verification:** 
  - Cashier update/delete rejected.
  - Manager attempt to delete rejected.
  - Terms tampering in `businessSnapshot` rejected.
  - Modification of `financialYear` rejected.

### 2.4 Sequential Counters (`/businesses/{businessId}/counters/{counterId}`)
- **Firestore Rule:** Lines 737–793 (`allow read: if isActiveMember; allow create, delete: if admin; allow update: if monotonic increment + invoice linkage`)
- **Service Layer:** `src/firebase/services/invoiceService.js` (`runTransaction`)
- **Backend Function:** OCC transactional write.
- **Emulator Verification:** Arbitrary counter increment without invoice rejected; sequence rollbacks rejected.

### 2.5 Invoice Reservations (`/businesses/{businessId}/invoice_numbers/{safeNumber}`)
- **Firestore Rule:** Lines 798–816 (`allow read: if isActiveMember; allow create: if !exists && linked; allow update, delete: if false`)
- **Service Layer:** `src/firebase/services/invoiceService.js` (`createInvoiceWithCounter`)
- **Backend Function:** Transactional unique reservation locking.
- **Emulator Verification:** Updating or deleting reservation is denied for all users including Admin. Duplicate creation rejected.

### 2.6 Financial Details (`/businesses/{businessId}/settings/financial_details`)
- **Firestore Rule:** Lines 703–720 (`allow read, create, update, delete: if isAdmin`)
- **Service Layer:** `src/firebase/services/businessSettingsService.js` (`getFinancialDetails`, `saveFinancialDetails`)
- **Backend Function:** Direct client Firestore SDK under admin authorization.
- **Emulator Verification:** Cashier and Manager get/list queries return `PERMISSION_DENIED`.

### 2.7 Staff Administration & Memberships (`/businesses/{businessId}/members/{uid}`)
- **Firestore Rule:** Lines 532–563 (`allow get: if authenticated && (uid == auth.uid || isAdmin); allow list: if isAdmin; allow create, update, delete: if isAdmin && uid != auth.uid && !isPrimaryAdmin`)
- **Service Layer:** `src/firebase/services/staffService.js` and `trustedStaffBackend.js`
- **Backend Function:** Cloud Functions callable (`updateStaffRoleCallable`, `updateStaffStatusCallable`, `approveStaffMemberCallable`, `removeStaffMemberCallable`) with transactional client fallback.
- **Emulator Verification:** Self-promotion, self-demotion, last-admin demotion, and primary admin deletion strictly rejected.

