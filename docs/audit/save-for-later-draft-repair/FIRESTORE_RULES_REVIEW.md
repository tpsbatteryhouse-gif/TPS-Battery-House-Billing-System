# Firestore Security Rules Review: Draft & Issuance Hardening

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Working Directory:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-11  
**Target:** `firestore.rules` (Lines 260–280, 520–545, 640–715)  

---

## 1. Updated Permission Model

| Role | Create Draft | Update Draft | Issue Draft to Permanent Invoice | Update Already-Issued Invoice |
| :--- | :---: | :---: | :---: | :---: |
| **Administrator (`admin`)** | Yes | Yes | Yes (Atomic + Counter + Reservation) | Yes (Authorized correction rights) |
| **Store Manager (`manager`)** | Yes | Yes | Yes (Atomic + Counter + Reservation) | Restricted (Pending only; cannot touch Paid/Cancelled) |
| **Cashier (`cashier`)** | Yes | **Own Drafts Only** (`createdBy == auth.uid`) | **Own Drafts Only** (Atomic + Counter + Reservation) | **Strictly Denied** |
| **Disabled / Removed Staff** | **Denied** | **Denied** | **Denied** | **Denied** |

---

## 2. Key Rule Hardening Details

### A. Controlled Immutability (`areImmutableInvoiceFieldsUnchanged()`)
```javascript
function areImmutableInvoiceFieldsUnchanged() {
  return request.resource.data.id == resource.data.id &&
    (
      // 1. If invoice was already issued, invoiceNumber can NEVER change under any circumstances
      (resource.data.paymentStatus != 'Draft' && request.resource.data.invoiceNumber == resource.data.invoiceNumber) ||
      // 2. If keeping as Draft, invoiceNumber must remain unchanged
      (resource.data.paymentStatus == 'Draft' && request.resource.data.paymentStatus == 'Draft' && request.resource.data.invoiceNumber == resource.data.invoiceNumber) ||
      // 3. If transitioning from Draft to Issued ('Pending' or 'Paid'), invoiceNumber transitions to allocated sequential number
      (resource.data.paymentStatus == 'Draft' && request.resource.data.paymentStatus in ['Pending', 'Paid'])
    ) &&
    (
      resource.data.paymentStatus == 'Draft' ||
      !('financialYear' in resource.data) ||
      request.resource.data.financialYear == resource.data.financialYear
    ) &&
    (!('createdAt' in resource.data) || request.resource.data.createdAt == resource.data.createdAt) &&
    (!('createdBy' in resource.data) || request.resource.data.createdBy == resource.data.createdBy) &&
    (!('businessSnapshot' in resource.data) ||
     (('businessSnapshot' in request.resource.data) &&
      request.resource.data.businessSnapshot == resource.data.businessSnapshot));
}
```

### B. Extracted Issuance Invariant Validator (`isValidSequentialIssuance`)
```javascript
function isValidSequentialIssuance(businessId, invoiceId) {
  return ('financialYear' in request.resource.data &&
          isValidFinancialYearForDate(request.resource.data.invoiceDate, request.resource.data.financialYear) &&
          exists(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear))) &&
         (
           !exists(/databases/$(database)/documents/businesses/$(businessId)/counters/migration_status) ||
           get(/databases/$(database)/documents/businesses/$(businessId)/counters/migration_status).data.status != 'in_progress'
         ) &&
         (
           existsAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)) &&
           ('lastInvoiceId' in getAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)).data) &&
           (getAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)).data.lastInvoiceId == invoiceId) &&
           ('lastInvoiceNumber' in getAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)).data) &&
           (getAfter(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear)).data.lastInvoiceNumber == request.resource.data.invoiceNumber)
         ) &&
         existsAfter(/databases/$(database)/documents/businesses/$(businessId)/invoice_numbers/$(getReservationDocId(request.resource.data.invoiceNumber)));
}
```

### C. Hardened `allow update` on `/invoices/{invoiceId}`
- Draft updates (`Draft -> Draft`): No counter or reservation required.
- Draft issuance (`Draft -> Pending | Paid`): Must pass `isValidSequentialIssuance`.
- Already-issued invoices: Cashier denied; Manager restricted; cannot be demoted back to Draft.

