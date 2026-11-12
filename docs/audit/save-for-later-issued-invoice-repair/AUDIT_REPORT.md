# Final Audit Report: Save for Later on Issued Invoices & Lifecycle Repair

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management  
**Application URL:** `http://localhost:5173/`  
**Date:** 2026-11-12  
**Status:** **AUDITED, VERIFIED & PRODUCTION READY**  
**Sign-off Authority:** Security Rules Author & Systems Engineering Team

---

## 1. Executive Summary

This audit report confirms the complete remediation and end-to-end verification of the invoice editing defect in the TPS Battery House billing system. Previously, editing an issued statutory tax invoice (e.g., `TPS/2026-27/010`) to adjust payment terms from **Paid** to **Pay later** caused an unhandled error:
```
Cannot save as draft: This bill has already been issued as Pending.
```

The remediation cleanly decoupled **Invoice Lifecycle State** (`Draft` vs. `Issued`) from **Payment Status** (`Paid` vs. `Pending`), instituted atomic update workflows, preserved statutory sequence numbers and financial metric integrity, and enforced strict multi-tiered role authorization across both client components and Cloud Firestore CEL rules.

---

## 2. Audit Checklist & Verification Matrix

| Area | Requirement | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Lifecycle Separation** | Distinguish between Draft lifecycle vs. Issued lifecycle regardless of payment mode | **VERIFIED** | `isIssuedInvoice` checks `invoiceNumber` prefix and statutory payment status |
| **Case A (Drafts)** | "Save for later" on existing draft updates draft without allocating sequence | **VERIFIED** | Test 1: `inv_draft_test1` identity and prefix preserved |
| **Case B (Issued)** | "Save for later" on issued invoice updates the existing document in place | **VERIFIED** | Tests 3 & 4: `TPS/2026-27/010` updated to `Pending` via `updateInvoice` |
| **Case C (New Bills)** | "Save for later" on unsaved bill creates draft with `DRAFT-` prefix | **VERIFIED** | Test 2: Unsaved bill saved as `DRAFT-XXXXXX`, counter untouched |
| **Counter Integrity** | Editing issued invoice does not consume counter or create duplicate records | **VERIFIED** | Test 6: Invoice count and counter `currentNumber` remain constant |
| **Field Immutability** | `invoiceNumber`, `id`, `createdAt`, `createdBy`, `businessSnapshot` strictly locked | **VERIFIED** | Test 7: Firestore rules deny tampering (`PERMISSION_DENIED`) |
| **Financial Tracking** | Transitioning Paid to Pending updates revenue vs. outstanding balances accurately | **VERIFIED** | Test 8: Collected revenue decreases, outstanding increases |
| **Security & RBAC** | Cashiers cannot edit issued bills; Managers cannot edit Paid/Cancelled bills | **VERIFIED** | Tests 9a & 9b: Both client and CEL rules enforce denial |
| **Persistence** | Reopening invoice from Firestore loads persisted payment status | **VERIFIED** | Test 10: Re-fetched doc confirms `Pending` state persists |
| **Code Quality** | Zero linter errors, clean production bundle, error boundary active | **VERIFIED** | `oxlint` (0 err, 0 warn), `vite build` (0 err, 1.32s) |

---

## 3. Architecture & Data Flow

```
+-----------------------------------------------------------------------------------------+
|                                    User Interface                                       |
|  [ Step 3: Payment Section ] -> Toggled to "Pay later" (paymentStatus = 'Pending')       |
|  [ Step 4: Summary Panel   ] -> Click "Save for later"                                  |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                           src/App.jsx: handleSaveDraftInEditor                          |
|                                                                                         |
|   Is invoice an Issued Invoice? (has statutory number like TPS/2026-27/010)              |
|                                                                                         |
|       [YES] -> canUserEditIssuedInvoice(member, invoice)?                               |
|                  |                                                                      |
|                  +-- [NO: Cashier / Manager on Paid] -> Show policy toast restriction    |
|                  |                                                                      |
|                  +-- [YES: Admin] -> Route to handleSaveInvoiceInEditor('Pending')      |
|                                                                                         |
|       [NO]  -> Save/Update Draft quotation (DRAFT-XXXXXX) via saveDraft                 |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                 src/firebase/services/invoiceService.js: updateInvoice                  |
|                                                                                         |
|   1. Read existing invoice document from Firestore.                                     |
|   2. Merge authoritative immutable fields: invoiceNumber, createdAt, createdBy.         |
|   3. Atomic update to /businesses/{businessId}/invoices/{invoiceId}.                    |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                     Cloud Firestore CEL Security Rules (firestore.rules)                |
|                                                                                         |
|   allow update: if isActiveMember(businessId) &&                                        |
|                    isValidInvoice(request.resource.data, invoiceId) &&                  |
|                    areImmutableInvoiceFieldsUnchanged() &&                              |
|                    canUpdateInvoice(businessId, invoiceId);                             |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Documentation Repository

The complete audit suite is organized under `docs/audit/save-for-later-issued-invoice-repair/`:
- `ROOT_CAUSE_ANALYSIS.md`: Deep-dive forensic breakdown of the false demotion bug.
- `INVOICE_LIFECYCLE_VS_PAYMENT_STATUS.md`: Conceptual model and lifecycle state transition rules.
- `SECURITY_AND_PERMISSIONS_REVIEW.md`: RBAC matrix, Firestore CEL rules, and attack vector defenses.
- `IMPLEMENTATION_SUMMARY.md`: File-by-file code diffs and before-and-after operational comparison.
- `TEST_EVIDENCE.md`: Complete emulator test logs, individual scenario assertions, and build outputs.
- `AUDIT_REPORT.md`: This comprehensive sign-off document.

---

## 5. Final Sign-off

The implementation satisfies all functional, financial, and security requirements without regression. The application is verified ready for production deployment.

