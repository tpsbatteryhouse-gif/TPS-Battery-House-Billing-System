# TPS Battery House — Cloud Firestore Security Rules Matrix

**Rules File:** [`firestore.rules`](file:///home/navaneeth/Documents/Amal/firestore.rules) (Version 2, 900 Lines)  
**Root Scope:** `/databases/{database}/documents/businesses/{businessId}`  
**Catch-All Rule:** `match /{document=**} { allow read, write: if false; }` (Strict Default Deny)

---

## Complete Collection Permission Matrix

| Collection Path | Read Permitted | Create Permitted | Update Permitted | Delete Permitted | Immutable / Server-Only Fields | Schema Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`/members/{uid}`** | `isActiveMember(bizId)` | `isAdmin(bizId)` | `isAdmin(bizId)` | `false` (Direct deletion denied; must use Cloud Function) | `uid`, `createdAt`, `createdBy` immutable; self-modification denied | Role in `['admin', 'manager', 'cashier']`; status in `['active', 'disabled']`; RFC email format. |
| **`/invoices/{invoiceId}`** | `isActiveMember(bizId)` | `isActiveMember(bizId)` | `isAdmin(bizId) \|\| (isManager(bizId) && status != 'Paid')` | `isAdmin(bizId)` only | `id`, `invoiceNumber`, `createdAt`, `createdBy`, nested `businessSnapshot` | Status in `['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled']`; Customer name required; Items list non-empty; Net payable >= 0. |
| **`/products/{productId}`** | `isActiveMember(bizId)` | `isAdmin(bizId) \|\| isManager(bizId)` | `isAdmin(bizId) \|\| isManager(bizId)` | `isAdmin(bizId) \|\| isManager(bizId)` | `id`, `sku`, `createdAt`, `createdBy` | Valid category, sellingPrice >= 0, gstRate >= 0, HSN code string. |
| **`/customers/{customerId}`** | `isActiveMember(bizId)` | `isAdmin(bizId) \|\| isManager(bizId)` | `isAdmin(bizId) \|\| isManager(bizId)` | `isAdmin(bizId) \|\| isManager(bizId)` | `id`, `createdAt`, `createdBy` | Customer name required (size 1-150), valid phone format, stateCode required. |
| **`/settings/business_profile`** | `isActiveMember(bizId)` | `isAdmin(bizId)` | `isAdmin(bizId)` | `isAdmin(bizId)` | `createdAt`, `createdBy` | Size <= 45 keys; businessName size 1-150; stateCode size 1-10. |
| **`/settings/financial_details`** | `isAdmin(bizId)` only | `isAdmin(bizId)` | `isAdmin(bizId)` | `isAdmin(bizId)` | `createdAt`, `createdBy` | Restricted to Administrators; active staff cannot read or write. |
| **`/settings/admin_config`** | `isAdmin(bizId)` only | `false` (Admin SDK only) | `false` (Admin SDK only) | `false` (Admin SDK only) | **Entire document is client-immutable** | Client writes completely blocked; managed exclusively by offline CLI script or UID migration. |
| **`/settings/admin_guard`** | `isActiveMember(bizId)` | `isAdmin(bizId)` | `isAdmin(bizId)` | `isAdmin(bizId)` | None | Stores activeAdminCount and lastSequence for OCC synchronization. |
| **`/counters/{counterId}`** | `isActiveMember(bizId)` | `isAdmin(bizId)` | `isActiveMember(bizId)` (Strict monotonic increment linked to invoice in same tx) | `isAdmin(bizId)` only | Sequence rollback blocked (`lastSeq >= prev.lastSeq`); prefix immutable | Linked to permanent invoice in same transaction; monotonic +1 step. |
| **`/invoice_numbers/{safeNumber}`** | `isActiveMember(bizId)` | `isActiveMember(bizId)` (Unique reservation key linked to new invoice) | `false` (Permanent & immutable) | `false` (Permanent & immutable) | **Entire document is permanent and immutable** | Guarantees an invoice number can NEVER be reused even if invoice is deleted. |
| **`/pending_registrations/{uid}`** | Requesting user (`auth.uid == uid`) or `isAdmin(bizId)` | `auth.uid == uid` (Status must be `'pending'`) | `isAdmin(bizId)` (Target user cannot self-approve) | `isAdmin(bizId)` | `uid`, `requestedAt` | Target cannot approve own registration (`request.auth.uid != uid`). |
| **`/staff_audit_logs/{logId}`** | `isAdmin(bizId)` only | `isAdmin(bizId)` (Verified actorUid == auth.uid & matching member state) | `false` (Strictly immutable) | `false` (Strictly immutable) | **Entire document is immutable once created** | Actor UID verified; Actor email verified; Target UID validated; Timestamp matches server time or ISO. |
| **`/{document=**}` (All other paths)** | `false` | `false` | `false` | `false` | All fields | **Default Deny Catch-All**. |

---

## Key Security Rule Invariants

1. **Multi-Tenant Isolation:**
   Every collection is path-scoped under `/businesses/{businessId}/...`. Functions `isMember(businessId)` and `isActiveMember(businessId)` verify that `request.auth.uid` possesses an active document in `/businesses/{businessId}/members/{request.auth.uid}`. Cross-tenant access is strictly denied.

2. **Invoice Snapshot Immutability:**
   Function `areImmutableInvoiceFieldsUnchanged()` evaluates 12 separate nested fields in `resource.data.businessSnapshot` (e.g. `businessName`, `address`, `gstin`, `phone`, `email`, `bankName`, `accountNo`, `ifsc`, `upiId`, `terms`, `footerText`, `authorizedSignatory`). Replacing any snapshot value with a different string is rejected by rules.

3. **Permanent Invoice Reservation Locking:**
   Collection `/invoice_numbers/{safeNumber}` enforces `allow update, delete: if false;`. Once a reservation is created, it can never be deleted or modified. Even if an administrator deletes an invoice, the corresponding reservation remains in Firestore, making duplicate invoice numbers mathematically impossible.

