# Root Cause Analysis: Save for Later (Draft) Permission Error

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Working Directory:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-11  
**Severity:** Critical  
**Status:** Resolved  

---

## 1. Problem Description

When a user (Store Manager or Cashier) clicks **Save for later** in the New Bill screen, the application displays:

`Error saving invoice: Permission denied: Please ensure you are an active staff member and that the financial year counter has been initialized by an administrator.`

The draft fails to save in Firestore, despite the user intending only to stage an unfinished invoice without issuing an official bill or consuming an official invoice number.

---

## 2. Event Tracing

The complete event trace of the **Save for later** click action:

```
[UI: InvoiceSummary.jsx / InvoiceActionBar.jsx]
   │  "Save for later" button clicked
   ▼
[onSaveDraft callback]
   │
   ▼
[InvoiceForm.jsx: handleSaveDraft()]
   │  Checks items.length > 0
   │  Calls onSave(INVOICE_STATUSES.DRAFT)
   ▼
[App.jsx: handleSaveInvoiceInEditor('Draft')]
   │  Constructs invoiceToSave with paymentStatus: 'Draft'
   │  Calls saveInvoice(invoiceToSave)
   ▼
[useInvoices.js: saveInvoice(invoiceData)]
   │  Checks if invoiceData is an existing record
   │  If new, calls createInvoiceWithCounter(businessId, invoiceData, authUser, { prefix })
   ▼
[invoiceService.js: createInvoiceWithCounter()]
   │  Checks isDraft (true) AND !hasExistingPermanentNum
   │  PRE-FIX FLAW: invoice.invoiceNumber was pre-populated with prospective preview number "TPS/2026-27/009"
   │  hasExistingPermanentNum evaluated to TRUE!
   │  Bypasses draft saving logic!
   ▼
[createInvoiceWithCounter: Permanent Issuance Logic]
   │  1. Pre-flight check: queries businesses/{bizId}/counters/invoices_2026-27
   │     - Counter missing? Rejects immediately with administrative initialization error!
   │  2. If counter exists: executes runTransaction()
   │     - Attempts to atomically increment counter for an invoice with paymentStatus: 'Draft'
   ▼
[Cloud Firestore Engine & Security Rules Evaluation]
   │  Rule L794 explicitly requires:
   │  getAfter(/invoices/{id}).data.paymentStatus != 'Draft'
   │  for any counter increment!
   ▼
[FIRESTORE REJECTION]
   │  PERMISSION_DENIED
   ▼
[App.jsx catch block]
   Shows: "Error saving invoice: Permission denied: Please ensure you are an active staff member and that the financial year counter has been initialized by an administrator."
```

---

## 3. Four Identified Architectural & Code Flaws

### Flaw 1: False "Existing Permanent Number" Detection
In `createInvoiceWithCounter()`:
```javascript
const isDraft = invoiceData.paymentStatus === 'Draft';
const hasExistingPermanentNum = invoiceData.invoiceNumber &&
  !invoiceData.invoiceNumber.startsWith('DRAFT') &&
  !invoiceData.invoiceNumber.endsWith('/000') &&
  invoiceData.invoiceNumber.includes('/');

if (isDraft && !hasExistingPermanentNum) {
  // Save as draft...
}
```
When opening the New Bill screen, `handleStartNewInvoice` in `App.jsx` sets `invoice.invoiceNumber` to the prospective preview number (e.g. `TPS/2026-27/009`).
Because this string includes `/` and does not start with `DRAFT`, `hasExistingPermanentNum` evaluated to `true`.
Consequently, `(isDraft && !hasExistingPermanentNum)` was `false`, causing the draft to bypass the draft saving branch and enter the permanent issuance transaction.

### Flaw 2: Workflow Conflation in `App.jsx`
Both "Save for later" and "Save & Print Bill" were funnelled into `handleSaveInvoiceInEditor`. Saving a draft requires minimal validation and zero sequential number allocation, whereas issuing an invoice requires full statutory validation, sequential counter increment, and number reservation.

### Flaw 3: Counter Rule Conflict
Under `firestore.rules` (lines 779 & 794), counter updates strictly require that the linked invoice document has `paymentStatus != 'Draft'`. A draft must never increment a counter. When the draft was routed into the issuance transaction, Firestore rules rightfully blocked the counter update with `permission-denied`.

### Flaw 4: Missing Draft-to-Issued Transition in Rules
Prior to this fix, `areImmutableInvoiceFieldsUnchanged()` in `firestore.rules` did not allow transitioning `invoiceNumber` from a `DRAFT-...` identifier to an official sequential number when a user subsequently decided to issue a previously saved draft.

