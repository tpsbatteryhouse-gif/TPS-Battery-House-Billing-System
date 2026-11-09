# TPS BATTERY HOUSE — Security Rule Review & RBAC Conformance

## 1. Executive Summary
This document reviews the production Firestore Security Rules (`firestore.rules`) governing invoice persistence, counter increments, uniqueness reservations, and role-based permissions in the TPS Battery House GST Billing System.

---

## 2. Core Rule Architecture & Role Model

| Role | Invoice Create | Invoice Update | Invoice Delete | Counter Create | Counter Update |
|---|---|---|---|---|---|
| **Admin** | Yes (Atomic) | Full (includes finalized) | Yes (Exclusive) | Yes (Exclusive) | Yes (Maintenance + Billing) |
| **Store Manager** | Yes (Atomic) | Limited (Draft/Pending only) | No | No (Denied) | Yes (Sequential + Linked) |
| **Cashier** | Yes (Atomic) | No (Strictly Denied) | No | No (Denied) | Yes (Sequential + Linked) |
| **Pending / Disabled / Unauthenticated** | No (All Denied) | No (All Denied) | No (All Denied) | No (All Denied) | No (All Denied) |

---

## 3. Detailed Rule Review by Collection

### 3.1. `/businesses/{businessId}/counters/{counterId}`
- **Read (`firestore.rules` L746):** `allow read: if isActiveMember(businessId);`
  - Active staff can inspect current sequences for billing.
- **Create (`firestore.rules` L750):** `allow create: if isAdmin(businessId) && isValidCounter(request.resource.data, counterId);`
  - **Security Invariant:** Managers and cashiers cannot create or reset counters. Only authorized administrators can seed or initialize counter documents.
- **Update (`firestore.rules` L762-L796):**
  - **Managers & Cashiers:**
    - Strictly monotonic sequence increment: `request.resource.data.lastSeq == resource.data.lastSeq + 1`
    - Invariant prefix check: `request.resource.data.prefix == resource.data.prefix`
    - Audit identity check: `request.resource.data.updatedBy == request.auth.uid`
    - Number format regex check: `request.resource.data.lastInvoiceNumber.matches('^' + resource.data.prefix + '0*' + string(request.resource.data.lastSeq) + '$')`
    - Bidirectional transactional linkage to invoice: `existsAfter(invoiceDocRef)` and `getAfter(invoiceDocRef).data.invoiceNumber == lastInvoiceNumber`
    - Payment status guard: `getAfter(invoiceDocRef).data.paymentStatus != 'Draft'`

### 3.2. `/businesses/{businessId}/invoices/{invoiceId}`
- **Read (`firestore.rules` L573):** `allow read: if isActiveMember(businessId);`
- **Create (`firestore.rules` L580-L627):**
  - Key whitelist enforcement via `keys().hasOnly([...])`
  - Data schema validation via `isValidInvoice(request.resource.data, invoiceId)`
  - Normal billing requires:
    1. Pre-existing counter document: `exists(counters/invoices_${fy})`
    2. Active migration not in progress: `migration_status.data.status != 'in_progress'`
    3. Counter linkage: `getAfter(counterRef).data.lastInvoiceId == invoiceId` and `lastInvoiceNumber == invoiceNumber`
    4. Uniqueness reservation created in same transaction: `existsAfter(invoice_numbers/$(getReservationDocId(invoiceNumber)))`
- **Update (`firestore.rules` L637-L654):**
  - Admins can update any valid invoice.
  - Managers can update Pending invoices without altering `netPayable` or `items` during finalization.
  - Cashiers are strictly denied from updating any invoice.
  - Immutable identity fields (`id`, `invoiceNumber`, `financialYear`, `createdAt`, `createdBy`) are enforced across all roles.
- **Delete (`firestore.rules` L659):** Strictly `isAdmin(businessId)` only.

### 3.3. `/businesses/{businessId}/invoice_numbers/{safeNumber}`
- **Create (`firestore.rules` L814-L819):**
  - `!exists(...)` ensures collision prevention.
  - `isValidInvoiceReservation(...)` enforces schema.
  - Atomic linkage: `existsAfter(...)` and `invoice.invoiceNumber == request.resource.data.invoiceNumber`.
- **Update & Delete (`firestore.rules` L822):** `allow update, delete: if false;`
  - Permanent, immutable tombstone reservations guarantee that deleted invoice numbers can **never** be reused.

---

## 4. Security Implications of the Local Fix
1. **Zero Rule Degradation:** The security rules in `firestore.rules` were **not weakened or modified**. All least-privilege role boundaries remain 100% intact.
2. **Admin-Only Counter Seeding Preserved:** Managers and cashiers remain strictly forbidden from creating counter documents.
3. **Atomic Monotonic Protection:** No possibility of gap injection, invoice number reuse, or unreserved numbers.
4. **Client-Side Validation & Feedback:** Front-end contract changes prevent accidental transaction errors and eliminate premature print dialog triggers.

