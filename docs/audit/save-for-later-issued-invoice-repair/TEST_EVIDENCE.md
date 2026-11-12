# Test Evidence: Save for Later on Issued Invoices

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management  
**Environment:** Local Node v24.14.0 + Cloud Firestore Emulator v1.22.0 (OpenJDK 21.0.10)  
**Date:** 2026-11-12  
**Test Suite:** `scratch/test_save_for_later_issued_invoice_repair.mjs`  
**Result:** **11 PASSED, 0 FAILED** (100% Pass Rate)

---

## 1. Automated Test Execution Log

```
================================================================
TPS BATTERY HOUSE — SAVE FOR LATER ON ISSUED INVOICE TEST SUITE
================================================================

[Suite] Starting Firestore emulator with /tmp/jdk-21/bin/java...
[Suite] Emulator is ready.

--- TEST GROUP 1: DRAFT PERSISTENCE (CASES A & C) ---
  ✓ PASS: 1. Saving an existing draft preserves identity and DRAFT prefix
  ✓ PASS: 2. Saving a new unsaved invoice as a draft does not consume official counter

--- TEST GROUP 2: ISSUED INVOICE EDITING & PAYMENT STATUS TRANSITION (CASE B) ---
  ✓ PASS: 3. Editing an issued invoice preserves original invoiceNumber and doc id
  ✓ PASS: 4. Changing an issued invoice from Paid to Pending succeeds via updateInvoice
  ✓ PASS: 5. Preventing accidental conversion of issued invoices into drafts
  ✓ PASS: 6. Editing an issued invoice does not create duplicate documents or increment counter
  ✓ PASS: 7. Preserving invoice numbers: attempt to tamper with invoiceNumber is rejected
  ✓ PASS: 8. Financial metrics correctly reflect transition from Paid to Pending

--- TEST GROUP 3: SECURITY & AUTHORIZATION BOUNDARIES ---
  ✓ PASS: 9a. Cashier cannot edit an issued invoice (client check & emulator rules)
  ✓ PASS: 9b. Manager cannot edit an invoice that was previously Paid (client check & emulator rules)
  ✓ PASS: 10. Reopening invoice from Firestore verifies that Pending status persists

================================================================
FINAL RESULT: 11 PASSED, 0 FAILED
================================================================
```

---

## 2. Test Scenario Details & Verification Assertions

### Scenario 1: Saving an Existing Draft (Case A)
- **Action:** Open draft `inv_draft_test1` (`DRAFT-100001`), modify customer address, click save draft.
- **Assertion:** Document ID remains `inv_draft_test1`, `invoiceNumber` remains `DRAFT-100001`, counter document `invoices_2026-27` is untouched.
- **Status:** **PASS**

### Scenario 2: Saving a New Unsaved Invoice as a Draft (Case C)
- **Action:** Create brand-new invoice with items, save as draft.
- **Assertion:** Draft is created with `DRAFT-` prefix, `paymentStatus == 'Draft'`, official counter `invoices_2026-27` is NOT incremented.
- **Status:** **PASS**

### Scenario 3: Editing an Issued Invoice (Case B)
- **Action:** Admin opens issued invoice `TPS/2026-27/010` (`inv_010`), updates notes, saves changes.
- **Assertion:** Original `invoiceNumber` (`TPS/2026-27/010`) and document ID (`inv_010`) are preserved.
- **Status:** **PASS**

### Scenario 4: Changing an Issued Invoice from Paid to Pending
- **Action:** Admin opens `TPS/2026-27/010` (originally `paymentStatus: 'Paid'`), toggles to "Pay later" (`paymentStatus: 'Pending'`), clicks save.
- **Assertion:** Firestore write succeeds via `updateInvoice`. `paymentStatus` is updated to `'Pending'`.
- **Status:** **PASS**

### Scenario 5: Preventing Accidental Conversion of Issued Invoices into Drafts
- **Action:** Attempt to call `updateInvoice` with `paymentStatus: 'Draft'` on issued invoice `inv_010`.
- **Assertion:** Cloud Firestore CEL rules reject the write with `PERMISSION_DENIED` (`request.resource.data.paymentStatus != 'Draft'`).
- **Status:** **PASS**

### Scenario 6: Preventing Duplicate Invoice Creation & Counter Consumption
- **Action:** Verify invoice count and counter value before and after editing `TPS/2026-27/010`.
- **Assertion:** Total invoice count remains constant (no duplicate docs created). Official counter `currentNumber` remains unchanged.
- **Status:** **PASS**

### Scenario 7: Preserving Invoice Numbers (Field Immutability)
- **Action:** Attempt to tamper with `invoiceNumber` from `TPS/2026-27/010` to `TPS/2026-27/999` on update.
- **Assertion:** Cloud Firestore CEL rules reject with `PERMISSION_DENIED` (`areImmutableInvoiceFieldsUnchanged`).
- **Status:** **PASS**

### Scenario 8: Financial Integrity Metrics Transition
- **Action:** Evaluate financial metrics before and after transitioning `TPS/2026-27/010` from `Paid` to `Pending`.
- **Assertion:**
  - `totalBilled` remains identical (`₹12,500.00`).
  - `collectedRevenue` decreases by invoice total (`₹12,500.00 -> ₹0.00`).
  - `totalOutstanding` / `pendingAmount` increases by invoice total (`₹0.00 -> ₹12,500.00`).
- **Status:** **PASS**

### Scenario 9a: Security Boundary — Cashier Editing Issued Invoice
- **Action:** Cashier (`cashier_uid`) attempts to update issued invoice `inv_010`.
- **Assertion:** Client check `canUserEditIssuedInvoice` returns `canEdit: false`. Live Firestore emulator rules reject with `PERMISSION_DENIED`.
- **Status:** **PASS**

### Scenario 9b: Security Boundary — Manager Editing Previously Paid Invoice
- **Action:** Manager (`manager_uid`) attempts to edit invoice `inv_paid_mgr_test` with existing `paymentStatus: 'Paid'`.
- **Assertion:** Client check returns `canEdit: false`. Live Firestore emulator rules reject with `PERMISSION_DENIED`.
- **Status:** **PASS**

### Scenario 10: Reopening and Persistence Verification
- **Action:** Re-fetch `inv_010` from Firestore after all mutations.
- **Assertion:** Fetched document has `paymentStatus == 'Pending'`, `invoiceNumber == 'TPS/2026-27/010'`, and `updatedAt` is populated.
- **Status:** **PASS**

---

## 3. Code Quality & Build Verification

### Linter (`npx oxlint`)
```
$ export PATH="/home/navaneeth/.nvm/versions/node/v24.14.0/bin:$PATH" && npx oxlint
Found 0 warnings and 0 errors.
Finished in 96ms on 115 files with 104 rules using 8 threads.
```

### Production Build (`npm run build`)
```
$ export PATH="/home/navaneeth/.nvm/versions/node/v24.14.0/bin:$PATH" && npm run build
vite v8.3.5 building client environment for production...
✓ 2258 modules transformed.
dist/index.html                             4.32 kB │ gzip:   1.80 kB
dist/assets/index-Bgzu1fEj.css             51.84 kB │ gzip:   9.78 kB
dist/assets/rolldown-runtime-XKyaHtl9.js    0.72 kB │ gzip:   0.42 kB
dist/assets/pdfExport-BCgNb4nO.js          15.56 kB │ gzip:   5.37 kB
dist/assets/purify.es-Dqk5qvad.js          29.02 kB │ gzip:  11.45 kB
dist/assets/icons-vendor-BDYVwecJ.js       30.45 kB │ gzip:  10.34 kB
dist/assets/index.es-DPJ30RVm.js          151.42 kB │ gzip:  48.91 kB
dist/assets/index-DErX6zOh.js             550.22 kB │ gzip: 134.29 kB
dist/assets/pdf-vendor-Bf6mcfS6.js        598.60 kB │ gzip: 176.05 kB
dist/assets/firebase-vendor-CA1XbSvg.js   695.80 kB │ gzip: 206.01 kB
✓ built in 1.32s
```

