# TPS BATTERY HOUSE — Role Permission Tests & Verification

## 1. Test Overview
All role permission boundaries were verified against the live Cloud Firestore Emulator using `@firebase/rules-unit-testing` in `scratch/test_firestore_invoice_save_permission.mjs`.

---

## 2. Role-by-Role Test Matrix

### 2.1. Administrator (`admin`)
- **Invoice Creation:** Admin can create valid billing invoices in atomic transactions. (Scenario 1 — **PASS**)
- **Counter Initialization:** Admin can initialize or seed the counter document `/counters/invoices_2026-27`. (Scenario 8 — **PASS**)
- **Counter Maintenance:** Admin can advance sequence numbers for recovery without violating monotonic bounds. (**PASS**)
- **Invoice Update:** Admin can update issued and finalized invoices (authorized corrections). (**PASS**)
- **Invoice Deletion:** Admin can delete invoices. (**PASS**)
- **Reservation Deletion:** Admin **CANNOT** delete number reservations (`allow update, delete: if false`). (Hardening 4.5c — **PASS**)

### 2.2. Store Manager (`manager`)
- **Invoice Creation:** Manager can create valid billing invoices using an existing valid counter. (Scenario 2 & 9 — **PASS**)
- **Counter Initialization:** Manager **CANNOT** initialize or create counter documents (`allow create: if isAdmin()`). (Scenario 7 — **PASS**)
- **Counter Update:** Manager can increment the counter sequence by exactly +1 atomically linked to an invoice. (Scenario 10 — **PASS**)
- **Invoice Update:** Manager can update Draft and Pending invoices, but **CANNOT** modify Paid or Cancelled invoices. (**PASS**)
- **Invoice Deletion:** Manager **CANNOT** delete invoices (`allow delete: if isAdmin()`). (**PASS**)

### 2.3. Cashier (`cashier`)
- **Invoice Creation:** Cashier can create valid billing invoices using an existing counter. (Scenario 3 — **PASS**)
- **Counter Initialization:** Cashier **CANNOT** create counter documents. (**PASS**)
- **Counter Update:** Cashier can update existing counter only within an atomic invoice transaction. (**PASS**)
- **Invoice Update:** Cashier is strictly denied from updating any invoice. (**PASS**)
- **Invoice Deletion:** Cashier is strictly denied from deleting any invoice. (**PASS**)

### 2.4. Unauthorized / Inactive Accounts
- **Pending Staff:** Cannot create or update invoices. (Scenario 4 — **PASS**)
- **Disabled Staff:** Cannot read, create, or update invoices. (Scenario 5 — **PASS**)
- **Unauthenticated Visitors:** Cannot read, create, or update invoices. (Scenario 6 — **PASS**)
- **Cross-Business Access:** Active members from `other-business` cannot access or write to `tps-battery-house` invoices. (Scenario 15 — **PASS**)

