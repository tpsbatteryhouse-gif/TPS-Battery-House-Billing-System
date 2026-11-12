# Security Rule Review: Invoices & Counters

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**System Location:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-10  
**Audit Target:** `firestore.rules` (Lines 600–780)  

---

## 1. Rule Analysis: Invoices (`/businesses/{businessId}/invoices/{invoiceId}`)

### Read Permissions:
- Active staff members (`admin`, `manager`, `cashier`) can read all invoices for their business.
- Customers can read invoices where their phone number matches their verified auth identity.

### Create Permissions:
```javascript
allow create: if isActiveMember(businessId) &&
                 isValidInvoice(request.resource.data, invoiceId) &&
                 (
                   // Draft Invoices: Allowed for active staff
                   (request.resource.data.paymentStatus == 'Draft' && ...) ||
                   // Permanent Invoices: Strict statutory & financial year requirements
                   (
                     ('financialYear' in request.resource.data &&
                      isValidFinancialYearForDate(request.resource.data.invoiceDate, request.resource.data.financialYear) &&
                      exists(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear))) &&
                     (
                       !exists(/databases/$(database)/documents/businesses/$(businessId)/counters/migration_status) ||
                       get(/databases/$(database)/documents/businesses/$(businessId)/counters/migration_status).data.status != 'in_progress'
                     ) &&
                     (
                       existsAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)) &&
                       ('lastInvoiceId' in getAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)).data) &&
                       getAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)).data.lastInvoiceId == invoiceId
                     )
                   )
                 );
```

### Critical Invariants Enforced:
1. `exists(/counters/invoices_{fy})`: Counter MUST exist prior to transaction.
2. `existsAfter(/counters/invoices_{fy})`: Counter MUST be updated in the same transaction.
3. `lastInvoiceId == invoiceId`: Bi-directional link between counter update and invoice document.
4. `isValidFinancialYearForDate()`: Invoice date and financial year must strictly correspond.

---

## 2. Rule Analysis: Sequential Counters (`/businesses/{businessId}/counters/{counterId}`)

### Read Permissions:
```javascript
allow read: if isActiveMember(businessId);
```
All active staff (Admin, Store Manager, Cashier) can inspect counters.

### Create Permissions:
```javascript
allow create: if isAdmin(businessId) &&
                 isValidCounter(request.resource.data, counterId);
```
**Administrator Only.** Managers and cashiers cannot create new counters.

### Update Permissions:
```javascript
allow update: if isActiveMember(businessId) &&
                 isValidCounter(request.resource.data, counterId) &&
                 (
                   // Admin: Maintenance, migration seeding, or recovery
                   (isAdmin(businessId) && request.resource.data.lastSeq >= resource.data.lastSeq) ||
                   // Manager & Cashier: Strictly monotonic increment during invoice creation
                   (
                     request.resource.data.lastSeq == resource.data.lastSeq + 1 &&
                     (!('prefix' in resource.data) || request.resource.data.prefix == resource.data.prefix) &&
                     (!('updatedBy' in request.resource.data) || request.resource.data.updatedBy == request.auth.uid) &&
                     existsAfter(/databases/$(database)/documents/businesses/$(businessId)/invoices/$(request.resource.data.lastInvoiceId)) &&
                     // ...
                   )
                 );
```

---

## 3. Security Boundary Verification

- **Did our fix weaken any rule?** NO. `firestore.rules` remained completely intact and unmodified.
- **Did our fix grant non-admins write access to counters outside transactions?** NO. Non-admins can only advance existing counters by exactly `+1` atomically linked to a valid invoice write.
- **Are role checks preserved?** YES. Pending, disabled, or unauthenticated users are rejected by `isActiveMember()`.

