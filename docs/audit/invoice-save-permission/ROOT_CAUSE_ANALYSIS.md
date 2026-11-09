# TPS BATTERY HOUSE — Firestore Invoice Save Permission Failure
## Root Cause Analysis Report

**Date:** 2026-11-09  
**System:** TPS BATTERYS HOUSE GST Billing Application  
**Primary Issue:** Clicking **Save & Print Bill** displayed:  
`Error saving invoice: Missing or insufficient permissions.`  
The browser print dialog opened, but invoice persistence failed.

---

## 1. Verified Primary Root Cause: Uninitialized Financial-Year Counter Document

### The Failure Mechanism
In the Cloud Firestore database architecture, sequential invoice numbers are strictly scoped per financial year (e.g. `2026-27`), stored at:
`/businesses/tps-battery-house/counters/invoices_2026-27`

In `firestore.rules`:
1. **Invoice Creation Requirement (`firestore.rules` L613):**
   ```javascript
   exists(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear))
   ```
   A permanent billing invoice can **only** be created if the sequential counter document for that financial year **already exists** prior to the transaction.
2. **Counter Creation Restriction (`firestore.rules` L750):**
   ```javascript
   allow create: if isAdmin(businessId) && isValidCounter(request.resource.data, counterId);
   ```
   **Only an active Administrator** has authorization to create or initialize counter documents. Store Managers and Cashiers are strictly denied from creating counters.

### The Breakdown in `createInvoiceWithCounter`
Prior to the fix, when an invoice was saved:
1. `createInvoiceWithCounter` checked `counterSnap.exists()`.
2. When `invoices_2026-27` did not exist in Firestore, it fell into:
   ```javascript
   // PREVIOUS BUGGY FALLBACK
   nextSeq = 1;
   // ...
   transaction.set(counterRef, counterData, { merge: true });
   ```
3. Because `counterRef` did not exist, `transaction.set()` attempted a **`create`** operation on `/counters/invoices_2026-27`.
4. When performed by a **Store Manager** (e.g. Navaneeth P.P) or Cashier:
   - Rule L750 evaluated `isAdmin(businessId)` as **`false`**.
   - Rule L613 evaluated `exists(...)` on the invoice creation as **`false`**.
5. Firestore rejected the atomic transaction with:
   `PERMISSION_DENIED: Missing or insufficient permissions.`

---

## 2. Secondary Root Cause: Premature Print Invocation on Failed Save

### The Sequence Error
In `InvoiceSummary.jsx`, the "Save & Print Bill" button handler was implemented as:
```javascript
// PREVIOUS IMPLEMENTATION IN InvoiceSummary.jsx
const handleSaveAndPrint = async () => {
  if (onSaveInvoice) {
    const res = await onSaveInvoice();
    if (res === false) return;
  }
  if (onPrint) {
    onPrint();
  }
};
```

In `App.jsx`, `handleSaveInvoiceInEditor` caught the Firestore error:
```javascript
// PREVIOUS IMPLEMENTATION IN App.jsx
try {
  const saved = await saveInvoice(invoiceToSave);
  // ...
} catch (err) {
  console.error('Failed to save invoice in editor:', err);
  showToast(`Error saving invoice: ${err.message}`);
  // Implicitly returned undefined!
}
```

Because `handleSaveInvoiceInEditor` returned `undefined` instead of `false`, `res === false` evaluated to **`false`**.
As a result:
- The print dialog was opened despite the database persistence failure.
- A blank or unpersisted invoice document was spooled to the printer.

---

## 3. Tertiary Root Cause: Desynchronized Legacy Counter Updates

In `createInvoiceWithCounter`, the transaction previously attempted to write `counterData` to both `invoices_2026-27` and the legacy generic counter `invoices`:
```javascript
transaction.set(counterRef, counterData, { merge: true });
if (legacySnap.exists() && legacySnap.data().prefix === prefix) {
  transaction.set(legacyCounterRef, counterData, { merge: true });
}
```
In `firestore.rules` L785, every counter update requires:
`request.resource.data.lastSeq == resource.data.lastSeq + 1`

If the legacy counter document existed with a desynchronized `lastSeq` (e.g., from prior historical data), writing `counterData` to `legacyCounterRef` failed the monotonic increment check on the legacy document, aborting the entire invoice creation transaction even if the year-specific counter was valid.

---

## 4. Summary of Repairs Applied
1. **Pre-flight Counter Initialization Guard:**
   `createInvoiceWithCounter` verifies that `counters/invoices_${fy}` exists before executing the transaction.
   - If missing and user is an **Administrator**: Automatically seeds/initializes the counter document via `initializeInvoiceCounter`.
   - If missing and user is **Manager or Cashier**: Fails fast with an informative, user-friendly message without attempting an unauthorized counter write.
2. **Authorized Administrator Counter Initialization Workflow:**
   Exported `initializeInvoiceCounter()` conforming strictly to Rule L750.
3. **Legacy Counter Isolation:**
   The transaction only mirrors to `legacyCounterRef` if its `lastSeq` precisely matches the active sequence.
4. **Strict Save & Print Contract:**
   `handleSaveInvoiceInEditor` and `handleSaveInvoice` explicitly return `saved` on success or `false` on failure. `handleSaveAndPrint` strictly checks that `saved` is non-falsy and contains a permanent sequential invoice number before opening `onPrint()`.

