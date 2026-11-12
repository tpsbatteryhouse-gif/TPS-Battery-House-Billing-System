# Root Cause Analysis: Save for Later Failure on Issued Invoices

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management  
**Severity:** High (Functional Bug in Invoice Editing Workflow)  
**Date:** 2026-11-12  
**Status:** RESOLVED & VERIFIED

---

## 1. Issue Description

In the TPS Battery House billing application, an existing invoice that was previously issued with payment status **Paid** (e.g. `TPS/2026-27/010`) could not be saved after changing its payment status to **Pay later** (`Pending`).
When clicking **Save for later**, the application displayed the error toast:
```
Cannot save as draft: This bill has already been issued as Pending.
```

---

## 2. Forensic Discovery & Root Cause Investigation

### A. Conflation of Invoice Lifecycle and Payment Status
The application previously lacked a clear programmatic boundary between:
1. **Invoice Lifecycle State:**
   - `Draft`: Provisional quotation/staging document. Identified by provisional draft IDs (`inv_draft_...`), DRAFT prefixes (`DRAFT-XXXXXX`), and payment status `'Draft'`. Unconnected to official counter sequence.
   - `Issued`: Statutory tax invoice. Identified by permanent sequential statutory numbers (`TPS/2026-27/010`), linked to counter reservations and immutable historical audit fields.
2. **Payment Status:**
   - `Paid`: Customer has settled the full balance.
   - `Pending`: Customer has outstanding balance to be paid later.

### B. The False Demotion Guard
In `src/App.jsx` line 245, `handleSaveDraftInEditor` previously contained:
```javascript
if (isIssuedInvoice(invoice)) {
  showToast(
    `Cannot save as draft: This bill has already been issued as ${invoice.paymentStatus}.`,
    'error'
  );
  return false;
}
```
Furthermore, `isIssuedInvoice` in `src/utils/draftState.js` was implemented as:
```javascript
export function isIssuedInvoice(invoice) {
  if (!invoice || typeof invoice !== 'object') return false;
  const status = invoice.paymentStatus;
  return ['Pending', 'Paid', 'Cancelled', 'Overdue'].includes(status);
}
```

### C. The Failure Cascade
1. An administrator opened existing issued invoice `TPS/2026-27/010` (payment status was `Paid`).
2. The user toggled Step 3 ("How is the customer paying?") to "Pay later".
3. `InvoicePaymentSection.jsx` updated `invoice.paymentStatus` in React state to `'Pending'`.
4. The user clicked "Save for later" in `InvoiceSummary.jsx` to save this payment change without printing a receipt.
5. `handleSaveDraftInEditor` was invoked. It evaluated `isIssuedInvoice(invoice)`, which saw `invoice.paymentStatus == 'Pending'`.
6. `handleSaveDraftInEditor` assumed the user was attempting to demote the invoice back into a draft quotation, rejecting the save and displaying:
   `Cannot save as draft: This bill has already been issued as Pending.`
7. Because no alternate save button existed on `InvoiceSummary` (only "Save & Print Bill"), the user was blocked from saving valid payment modifications without printing paper.

---

## 3. Secondary Deficiencies Identified

1. **Unpersisted Template Misclassification:**
   In `createEmptyInvoice` (`src/utils/defaults.js`), the default blank template was initialized with `paymentStatus: 'Paid'`. Because `isIssuedInvoice` only checked `['Pending', 'Paid', ...].includes(status)`, even a brand-new unsaved bill was at risk of false positive classification.
2. **Counter Increment Vulnerability:**
   In `src/hooks/useInvoices.js`, `saveInvoice` checked for `existingInv` only in the in-memory array. If `existingInv` was not found locally, `saveInvoice` fell back to `createInvoiceWithCounter`, risking duplicate sequence allocation for an existing issued number.
3. **Draft Snapshot Missing Payment Status:**
   In `src/utils/draftState.js`, `createDraftSnapshot` excluded `paymentStatus`. As a result, dirty-checking (`isDraftModified`) could not detect when a user altered payment terms between Paid and Pay later.

---

## 4. Remediation Strategy

1. **Three-Tier Lifecycle Classifier:**
   - **Case A (Existing Draft):** Persist updates to the existing draft document using `saveInvoiceDraft`.
   - **Case B (Existing Issued Invoice):** Save changes to the existing document using `updateInvoice`. Strictly preserve original `invoiceNumber` (`TPS/2026-27/010`), `id`, `createdAt`, `createdBy`, and `businessSnapshot`. Never demote to draft. Never allocate another counter sequence.
   - **Case C (New Unsaved Bill):** Save as provisional draft with a `DRAFT-XXXXXX` prefix without consuming counter sequence.
2. **Role-Based Authority Enforcement:**
   - Administrators can update issued invoices across all payment states.
   - Managers cannot edit invoices previously issued as `Paid` or `Cancelled`.
   - Cashiers are strictly denied from altering issued invoices.
3. **Dirty-State Tracking:**
   - Added `paymentStatus` to `createDraftSnapshot`.

