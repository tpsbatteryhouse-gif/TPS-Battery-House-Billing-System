# Implementation Summary: Save for Later on Issued Invoices

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management  
**Focus:** Lifecycle & Payment Disambiguation, Atomic Updates, and Form State Management  
**Date:** 2026-11-12  
**Status:** IMPLEMENTED & VERIFIED

---

## 1. Overview of Changes

To resolve the issue where clicking "Save for later" on an already-issued invoice (e.g., `TPS/2026-27/010`) failed with `Cannot save as draft: This bill has already been issued as Pending`, the billing engine was refactored to cleanly decouple **Invoice Lifecycle** (Draft vs. Issued) from **Payment Status** (Paid vs. Pending).

---

## 2. File-by-File Changes

### A. `src/utils/draftState.js`
- **Updated `isIssuedInvoice(invoice)`:**
  Previously checked only if `paymentStatus` was in `['Pending', 'Paid', 'Cancelled', 'Overdue']`, which caused false positives for newly initialized templates and when editing issued bills.
  Now checks both `invoiceNumber` (cannot start with `DRAFT-` and cannot contain `---`) and valid statutory `paymentStatus` (`Pending`, `Paid`, `Cancelled`, `Overdue`), accurately distinguishing unpersisted templates, drafts, and issued invoices.
- **Updated `createDraftSnapshot(invoice)`:**
  Added `paymentStatus` to the serialized draft snapshot. This ensures that when a user toggles between "Paid now" and "Pay later", `isDraftModified(current, snapshot)` correctly detects the change and marks the form as dirty.

### B. `src/utils/permissions.js`
- **Added `canUserEditIssuedInvoice(member, existingInvoice)`:**
  Evaluates permission boundaries before attempting an update on an issued invoice:
  - Validates active staff status.
  - Cashiers are strictly denied (`canEdit: false`, reason: "Only Administrators and Managers can update already-issued bills").
  - Managers cannot edit bills originally issued as `Paid` or `Cancelled` (`canEdit: false`, reason: "Only Administrators can edit bills that have already been issued as Paid or Cancelled").
  - Administrators are granted full editing access (`canEdit: true`).

### C. `src/firebase/services/invoiceService.js`
- **Enhanced `updateInvoice(businessId, invoiceId, invoiceData, member)`:**
  Before writing the update, `updateInvoice` fetches the existing document snapshot from Firestore.
  It extracts the authoritative immutable fields (`invoiceNumber`, `financialYear`, `createdAt`, `createdBy`, `businessSnapshot`) from `existingData` and merges them with the update payload.
  This guarantees that client-side payload differences never violate Firestore CEL rules (`areImmutableInvoiceFieldsUnchanged`).

### D. `src/hooks/useInvoices.js`
- **Strengthened `saveInvoice(invoiceData)`:**
  Updated the `isExistingIssued` condition to check `invoiceData.invoiceNumber && !invoiceData.invoiceNumber.startsWith('DRAFT-') && !invoiceData.invoiceNumber.includes('---')`.
  Even if the invoice is not present in the local React state cache, it correctly routes to `updateInvoice` and never inadvertently calls `createInvoiceWithCounter` or increments the counter document.

### E. `src/App.jsx`
- **Refactored `handleSaveDraftInEditor` (Case B Resolution):**
  When an issued invoice is open in the editor and the user clicks "Save for later", the handler checks `canUserEditIssuedInvoice(member, invoice)`.
  - If unauthorized, displays an explanatory toast message with the specific policy restriction.
  - If authorized, invokes `handleSaveInvoiceInEditor(invoice.paymentStatus)` to save the modifications directly to the existing invoice document, preserving `invoiceNumber` and document ID, and updates `lastSavedSnapshotRef.current`.
- **Refactored `handleOpenInvoiceInEditor`:**
  Initializes `lastSavedSnapshotRef.current = createDraftSnapshot(openedInvoice)` for both drafts and issued invoices, ensuring that clean/dirty state tracking works consistently across all invoice types.
- **Wrapped handlers in `useCallback`:**
  Ensured all handlers (`showToast`, `handleSaveInvoiceInEditor`, `handleSaveDraftInEditor`) have clean hook dependency graphs, resolving React compiler purity and dependency warnings.

---

## 3. Comparison: Previous vs. Corrected Behavior

| Scenario | Previous Behavior | Corrected Behavior |
| :--- | :--- | :--- |
| **Case A: Existing Draft** | Saved as draft, preserved draft ID. | Saves existing draft, preserves draft ID, does not allocate sequence. |
| **Case B: Existing Issued Invoice (e.g. `TPS/2026-27/010`)** | Failed with error toast: `Cannot save as draft: This bill has already been issued as Pending.` | Checks role permissions. If Admin, updates the existing invoice document in place via `updateInvoice`. Preserves `TPS/2026-27/010`, updates payment status to `Pending`, adjusts financial balances, and notifies user: *"Invoice TPS/2026-27/010 updated successfully."* |
| **Case C: Brand New Unsaved Invoice** | At risk of false positive if initialized with `paymentStatus: 'Paid'`. | Correctly recognized as new draft. Allocates `DRAFT-XXXXXX` without touching official counter sequence. |
| **Cashier attempting to edit Issued Bill** | Obscure draft demotion error. | Clear, immediate notification: *"Only Administrators and Managers can update already-issued bills."* (CEL rule denies at database level). |
| **Manager attempting to edit Paid Bill** | Obscure draft demotion error. | Clear, immediate notification: *"Only Administrators can edit bills that have already been issued as Paid or Cancelled."* (CEL rule denies at database level). |

