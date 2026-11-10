# Root Cause Analysis: Invoice Save Permission Failure & Line Item Total Display

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**System Location:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-10  
**Severity:** Critical (Invoice Persistence & Financial Display Integrity)  
**Status:** Resolved  

---

## Executive Summary

During testing of the GST billing application, two critical defects were detected on the New Tax Invoice screen:

1. **Part A — Firestore Permission Failure on Invoice Save:**
   When the Store Manager clicked **Save & Print Bill**, the UI displayed:
   `Error saving invoice: Permission denied: Please ensure you are an active staff member and that the financial year counter has been initialized by an administrator.`
   The preview displayed prospective invoice number `TPS/2026-27/009`, but persistence failed.

2. **Part B — Line Item Card Total Displaying ₹0.00:**
   Individual product cards in the line item list rendered ₹0.00 for the line total (e.g., Exide InvaMaster Battery Qty 2 × ₹14,800.00 showed ₹0.00; Luminous Cruze Inverter Qty 1 × ₹28,500.00 showed ₹0.00), while the Bill Total sidebar correctly computed ₹58,100.00.

Both defects have been comprehensively diagnosed, traced to their root architectural origins, and fixed without weakening any Firestore security boundaries or bypassing role-based access control.

---

## Detailed Root Cause Analysis

### Part A: Firestore Invoice Save Permission Failure

#### 1. Counter Pre-Condition & Role Boundary in `firestore.rules`
In `firestore.rules`, sequential invoice numbering is partitioned per financial year at `/businesses/{businessId}/counters/invoices_{fy}`:
- **Rule L750 (`allow create` on `/counters/{counterId}`):**
  ```javascript
  allow create: if isAdmin(businessId) && isValidCounter(request.resource.data, counterId);
  ```
  Only users with the `admin` role are permitted to create or initialize a counter document. Store Managers (`manager`) and Cashiers (`cashier`) are strictly forbidden from creating counters.
- **Rule L613 (`allow create` on `/invoices/{invoiceId}`):**
  ```javascript
  exists(/databases/$(database)/documents/businesses/$(businessId)/counters/$('invoices_' + request.resource.data.financialYear))
  ```
  An invoice write transaction cannot proceed unless the corresponding financial year counter document already exists prior to the transaction.

#### 2. Root Cause 1: Desynchronization Between In-Memory Preview & Firestore Counter
The preview invoice number in the UI (`TPS/2026-27/009`) is computed by `peekNextInvoiceNumber` in `src/hooks/useInvoices.js`. This function iterates through the in-memory/cached `invoices` array (which contained 8 sample/mock invoices `TPS/2026-27/001` through `TPS/2026-27/008`), yielding `maxSeq = 8` and `nextSeq = 9`.
However, in Firestore:
- The actual document `/businesses/tps-battery-house/counters/invoices_2026-27` had not been initialized by an administrator.
- When the Store Manager submitted the invoice, `createInvoiceWithCounter` checked `counterSnap.exists()`. Finding it absent, and knowing the user was not an administrator, it rejected the creation with:
  `Invoice counter for financial year 2026-27 is not initialized. Please ask a store administrator to initialize the invoice counter.`
- When translated through `App.jsx`, permission errors map to:
  `Permission denied: Please ensure you are an active staff member and that the financial year counter has been initialized by an administrator.`

#### 3. Root Cause 2: Auth Object Passing Missing Staff Membership Role
In `src/hooks/useInvoices.js`, `useAuth()` returns `{ user, member, permissions }`.
- `user` is the Firebase Authentication `User` object (which only carries `uid`, `email`, etc.).
- `member` is the Firestore staff record (which carries `role: 'manager'`, `status: 'active'`).
Prior to this repair, `useInvoices.js` was passing bare `user` to `createInvoiceWithCounter`. Because `user.role` was undefined, pre-flight administrative checks `Boolean(user?.role === 'admin' || user?.permissions?.canManageSettings)` failed even for administrator sessions.

---

### Part B: Incorrect Line Item Card Total Displaying ₹0.00

#### 1. Data Contract Mismatch in `InvoiceItemRow.jsx`
In `src/components/invoice/InvoiceItemRow.jsx`:
- Line 28 computes the live financial breakdown using `calculateLineItem(item, isInterstate)`:
  ```jsx
  const lineCalcs = calculateLineItem(item, isInterstate);
  ```
- Line 142 previously rendered:
  ```jsx
  <div className="min-w-[100px] text-right text-lg sm:text-xl font-bold font-mono text-[#F2EFE9] shrink-0">
    ₹{formatNumber(lineCalcs.total)}
  </div>
  ```
- However, `calculateLineItem` in `src/utils/gstCalculations.js` returned:
  ```javascript
  return {
    ...normalized,
    // ...
    totalGstAmount: roundToTwoDecimals(totalGstAmount),
    lineTotal: roundToTwoDecimals(grossAmount),
  };
  ```
- Notice that `calculateLineItem` returned `lineTotal`, NOT `total`!
- Therefore, `lineCalcs.total` evaluated to `undefined`.
- In `formatNumber(undefined)`, the formatter defensively coerces non-numeric/undefined inputs to `0.00`.
- As a result, every item card in the UI displayed `₹0.00` despite having valid quantities, rates, and GST calculations.

Meanwhile, the bill summary sidebar uses `calculateInvoiceTotals(invoice, stateCode)`, which computes `totalGross` by summing `item.lineTotal`. Thus the sidebar showed ₹58,100.00 correctly while the item cards erroneously displayed ₹0.00.

---

## Architectural Resolution Strategy

1. **For Part B (Card Totals):**
   - Updated `InvoiceItemRow.jsx` line 142 to reference `lineCalcs.lineTotal ?? lineCalcs.total`.
   - Updated `calculateLineItem` in `src/utils/gstCalculations.js` to also return `total: roundToTwoDecimals(grossAmount)` as a defensive canonical alias alongside `lineTotal`.
   - Verified that both single-item and multi-item invoices match the sidebar subtotal down to the exact rupee and paisa.

2. **For Part A (Invoice Save Permission):**
   - Updated `src/hooks/useInvoices.js` to pass `authUser = { ...user, role: member?.role, status: member?.status, permissions }` into `createInvoiceWithCounter`, `updateInvoice`, and migration services.
   - Built an administrative CLI tool (`scripts/initialize-invoice-counter.js`) with `--dry-run` and `--confirm` modes to safely inspect and initialize counters (e.g. to `lastSeq: 8` for financial year 2026-27).
   - Preserved all Phase 4 and Phase 5 security constraints in `firestore.rules`: managers and cashiers can atomically increment existing counters during invoice creation, but cannot create or reset counters.

