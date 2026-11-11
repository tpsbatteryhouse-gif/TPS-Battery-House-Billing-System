# Implementation Summary: Save for Later (Draft) Repair

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Working Directory:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-11  
**Status:** Completed & Fully Verified  

---

## 1. Summary of Code & Architecture Changes

### A. Dedicated Draft Persistence Service (`src/firebase/services/invoiceService.js`)
- **Introduced `saveInvoiceDraft(businessId, draftData, user, options)`:**
  * Checks if document already exists to preserve `createdAt` and `createdBy` immutable fields.
  * Ensures `invoiceNumber` uses a `DRAFT-` prefix and `paymentStatus: 'Draft'`.
  * Does NOT check, read, or require `/counters/invoices_{fy}`.
  * Does NOT increment any sequence counter or create number reservations.
  * Persists full form state (customer, line items, discounts, scrap trade-in, notes).
- **Updated `createInvoiceWithCounter`:**
  * If `invoiceData.paymentStatus === 'Draft'`, routes cleanly to `saveInvoiceDraft`.
  * When issuing an existing draft, reads the existing document inside the transaction to preserve `createdAt` and `createdBy` while atomically updating `invoiceNumber` to the allocated permanent sequence number and committing counter increment + reservation.

### B. Hook & Service Layer Decoupling (`src/hooks/useInvoices.js`)
- Exported dedicated `saveDraft(draftData)` hook method.
- Updated `saveInvoice(invoiceData)`:
  * If `invoiceData.paymentStatus === 'Draft'`, delegates to `saveInvoiceDraft`.
  * If `isExistingIssued` is false (either new invoice or an un-issued draft), routes through `createInvoiceWithCounter` to allocate official number.

### C. UI Separation in Editor (`src/App.jsx` & `src/components/InvoiceForm.jsx`)
- Implemented `handleSaveDraftInEditor` in `src/App.jsx`:
  * Saves draft without requiring strict print-validation or mandatory customer name.
  * Updates active editor state and `invoices` list synchronously.
  * Shows toast: `Draft saved successfully`.
- Passed `onSaveDraft={handleSaveDraftInEditor}` to `<InvoiceForm />`.
- Updated `InvoiceForm.jsx` to call `onSaveDraft()` on **Save for later** clicks.

### D. Hardened Firestore Security Rules (`firestore.rules`)
- `areImmutableInvoiceFieldsUnchanged()` allows transitioning `invoiceNumber` from `DRAFT-...` to an official sequential number only during Draft-to-Issued transitions (`Draft -> Pending | Paid`). Once issued, permanently immutable forever.
- `allow update` permits Admin, Manager, and Cashier (for own drafts) to update existing drafts without counters.
- Draft-to-issued transition requires atomic counter increment and reservation document creation (`isValidSequentialIssuance`).
- Cashiers strictly denied from updating already-issued invoices.

