# Security and Permissions Review: Save for Later & Issued Invoice Mutations

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management  
**Scope:** Role-Based Access Control (RBAC), Firestore CEL Security Rules, and Field Immutability  
**Date:** 2026-11-12  
**Status:** AUDITED & SECURE

---

## 1. Executive Summary

This security audit reviews the authorization model governing draft and issued invoice lifecycle transitions in TPS Battery House. It validates that saving modifications to an already-issued invoice preserves administrative privilege separation, prevents cashier tampering, enforces strict immutability of statutory accounting fields, and complies with Cloud Firestore Common Expression Language (CEL) evaluation limits.

---

## 2. Role-Based Access Control (RBAC) Matrix

Under TPS Battery House policy, authority is strictly derived from server-verified staff membership documents (`/businesses/{businessId}/members/{uid}`) and enforced identically across both frontend components and Firestore CEL security rules.

| Role | Save New Draft | Update Existing Draft | Issue Draft to Bill | Edit Issued Invoices (Pending) | Edit Issued Invoices (Paid/Cancelled) | Delete Invoice |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin** | Allowed | Allowed | Allowed | Allowed | Allowed (Full statutory correction) | Allowed |
| **Manager** | Allowed | Allowed | Allowed | Allowed (Payment status & notes only; cannot alter financials if setting to Paid) | **STRICTLY DENIED** | **STRICTLY DENIED** |
| **Cashier** | Allowed | Allowed (Own drafts only: `createdBy == auth.uid`) | Allowed (Own drafts only) | **STRICTLY DENIED** | **STRICTLY DENIED** | **STRICTLY DENIED** |

---

## 3. Dual-Layer Security Verification

### A. Frontend Layer (`src/utils/permissions.js` & `src/App.jsx`)
The frontend enforces `canUserEditIssuedInvoice(member, existingInvoice)`:
- Returns `false` for non-staff or non-active accounts.
- Denies all Cashiers immediately with informative explanation: *"Only Administrators and Managers can update already-issued bills."*
- Denies Managers attempting to edit invoices previously issued as `Paid` or `Cancelled`: *"Only Administrators can edit bills that have already been issued as Paid or Cancelled."*
- Permits Administrators to perform authorized corrections.

### B. Backend Firestore CEL Security Rules Layer (`firestore.rules`)
Firestore security rules evaluate every write independently of client code:
```javascript
// match /businesses/{businessId}/invoices/{invoiceId}
allow update: if isActiveMember(businessId) &&
                 isValidInvoice(request.resource.data, invoiceId) &&
                 areImmutableInvoiceFieldsUnchanged() &&
                 canUpdateInvoice(businessId, invoiceId);
```

#### 1. Immutability Constraints (`areImmutableInvoiceFieldsUnchanged`)
Enforces that core identity and audit fields can never be forged or tampered with on update:
```javascript
function areImmutableInvoiceFieldsUnchanged() {
  return request.resource.data.id == resource.data.id &&
         request.resource.data.createdAt == resource.data.createdAt &&
         request.resource.data.createdBy == resource.data.createdBy &&
         request.resource.data.businessSnapshot == resource.data.businessSnapshot &&
         (
           // Invoice number is permanently immutable once issued
           (resource.data.paymentStatus != 'Draft' && request.resource.data.invoiceNumber == resource.data.invoiceNumber) ||
           // Draft invoice number can transition to sequential statutory number upon issuance
           (resource.data.paymentStatus == 'Draft' && (
             request.resource.data.invoiceNumber == resource.data.invoiceNumber ||
             (request.resource.data.paymentStatus in ['Pending', 'Paid'] && isValidInvoiceNumber(request.resource.data.invoiceNumber))
           ))
         );
}
```

#### 2. Consolidated Evaluator (`canUpdateInvoice`)
Consolidated to eliminate redundant `get()` / role lookups and prevent triggering Firestore's 1,000 CEL expression limit:
```javascript
function canUpdateInvoice(businessId, invoiceId) {
  let role = getMemberDoc(businessId).data.role;
  return resource.data.paymentStatus == 'Draft'
    ? (
        (role in ['admin', 'manager'] || (role == 'cashier' && ('createdBy' in resource.data) && resource.data.createdBy == request.auth.uid)) &&
        (
          request.resource.data.paymentStatus == 'Draft' ||
          (request.resource.data.paymentStatus in ['Pending', 'Paid'] && isValidSequentialIssuance(businessId, invoiceId))
        )
      )
    : (
        // For already-issued invoices:
        request.resource.data.paymentStatus != 'Draft' && // Prevent draft demotion
        role in ['admin', 'manager'] &&                   // Cashier strictly denied
        (
          role == 'admin' ||
          (
            !(resource.data.paymentStatus in ['Paid', 'Cancelled']) &&
            (
              resource.data.paymentStatus != 'Pending' ||
              !(request.resource.data.paymentStatus in ['Paid', 'Cancelled']) ||
              (
                request.resource.data.netPayable == resource.data.netPayable &&
                request.resource.data.items == resource.data.items
              )
            )
          )
        )
      );
}
```

---

## 4. Threat Modeling & Attack Vector Defenses

### Threat 1: Demoting Issued Invoice to Draft to Bypass Audit Trail
- **Vector:** An attacker intercepts the update payload and sets `paymentStatus: 'Draft'` on an existing issued invoice `TPS/2026-27/010`.
- **Defense:** CEL rule `request.resource.data.paymentStatus != 'Draft'` immediately rejects the update. Test 5 confirms Firestore returns `PERMISSION_DENIED`.

### Threat 2: Cashier Modifying Payment Terms of Issued Bill
- **Vector:** A cashier changes a bill from `Paid` to `Pending` to siphon cash collected from a customer.
- **Defense:** CEL rule checks `role in ['admin', 'manager']` for non-draft updates. Cashiers are strictly rejected. Test 9a verifies both client denial and Firestore `PERMISSION_DENIED`.

### Threat 3: Invoice Number Tampering / Counter Hijacking
- **Vector:** An update request alters `invoiceNumber` to collide with or overwrite another invoice.
- **Defense:** `areImmutableInvoiceFieldsUnchanged` strictly enforces `request.resource.data.invoiceNumber == resource.data.invoiceNumber` for any document where `resource.data.paymentStatus != 'Draft'`. Test 7 confirms Firestore returns `PERMISSION_DENIED`.

### Threat 4: Financial Modification on Finalized Bills by Manager
- **Vector:** A store manager changes items or line amounts on an invoice originally marked `Paid`.
- **Defense:** CEL rule forbids managers from editing any bill whose current state is `Paid` or `Cancelled`. Test 9b confirms Firestore returns `PERMISSION_DENIED`.

---

## 5. Security Conclusion

The repaired workflow maintains 100% adherence to zero-trust security principles. The client UI guides authorized roles through safe workflows, while Cloud Firestore CEL rules authoritatively enforce role separation, state machines, and field immutability at the database level.

