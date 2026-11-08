# TPS BATTERY HOUSE — PHASE 5.3
# CODE MODIFICATIONS & REGRESSION CHANGELOG

**Date:** November 2026  
**Scope:** Financial precision hardening, scientific notation resilience, boundary validation, and snapshot preservation.  

---

## 1. Summary of Changes

| File Modified | Nature of Change | Purpose |
| :--- | :--- | :--- |
| [`src/utils/gstCalculations.js`](file:///home/navaneeth/Documents/Amal/src/utils/gstCalculations.js) | Enhanced `roundToTwoDecimals`; added `FINANCIAL_BOUNDS`, `validateFinancialInput`, `validateInvoiceFinancials` | Eliminates scientific notation truncation, defines policy constants, and validates financial payloads before calculation |
| [`src/utils/categories.js`](file:///home/navaneeth/Documents/Amal/src/utils/categories.js) | Adjusted minimum quantity threshold from `0.01` to `0.001` in `normalizeInvoiceItem` | Supports standard 3-decimal fractional retail units (e.g., 0.001 L electrolyte) |
| [`src/firebase/services/invoiceService.js`](file:///home/navaneeth/Documents/Amal/src/firebase/services/invoiceService.js) | Added `validateInvoiceFinancials(rawInvoice)` to `sanitizeInvoiceForFirestore` | Intercepts malformed prices, quantities, and GST slabs before Firestore persistence |
| [`src/utils/pdfExport.js`](file:///home/navaneeth/Documents/Amal/src/utils/pdfExport.js) | Updated `generateVectorPdf` to use stored `invoice.netPayable` snapshot | Guarantees exact historical invoice snapshot preservation in vector PDF and UPI QR |
| [`src/components/InvoicePreview.jsx`](file:///home/navaneeth/Documents/Amal/src/components/InvoicePreview.jsx) | Updated `InvoicePreview` to use stored `invoice.netPayable` snapshot | Guarantees exact historical invoice snapshot preservation on printable bill view |
| [`scratch/run_all_suites.js`](file:///home/navaneeth/Documents/Amal/scratch/run_all_suites.js) | Added `test_financial_calculation_signoff.mjs` to continuous regression suite | Expands continuous regression test coverage to 23 suites and 990 assertions |
| [`scratch/test_financial_calculation_signoff.mjs`](file:///home/navaneeth/Documents/Amal/scratch/test_financial_calculation_signoff.mjs) | Created Phase 5.3 comprehensive automated sign-off test suite | 11/11 passing test scenarios verifying edge cases, large scales, and reconciliation |

---

## 2. Detailed File Diffs & Descriptions

### 2.1 `src/utils/gstCalculations.js`
- **Before:** `roundToTwoDecimals` directly concatenated string `'e2'`. If `abs` formatted in scientific notation (e.g. `1e-7` or `1e21`), `abs + 'e2'` produced `'1e-7e2'`, which evaluated to `NaN`.
- **After:** Mantissa and exponent are extracted via `String(abs).toLowerCase().split('e')`. Exponents are mathematically shifted, and non-finite values/negative zero are safely handled.
- **Added:** `validateFinancialInput` and `validateInvoiceFinancials` to prevent malformed strings, `NaN`, `Infinity`, negative numbers, and invalid GST slabs from silently becoming zero.

### 2.2 `src/utils/categories.js`
- **Line 319:** Changed `Math.max(0.01, Number(rawQty) || 1)` to `Math.max(0.001, Number(rawQty) || 1)`.
- **Impact:** Legitimate 3-decimal commercial quantities (such as 0.001 Liters of specialized battery acid or 0.005 kg of terminal grease) calculate with exact precision rather than being clamped to 0.01.

### 2.3 `src/firebase/services/invoiceService.js`
- **Lines 25 & 171:** Imported `validateInvoiceFinancials` and invoked it inside `sanitizeInvoiceForFirestore`.
- **Impact:** Any attempt to save an invoice with invalid financial data (corrupted string rates, negative quantities, illegal GST slabs) is immediately rejected with a clear, descriptive validation error.

### 2.4 `src/utils/pdfExport.js` & `src/components/InvoicePreview.jsx`
- **Snapshot Preservation:** If `invoice.netPayable` is a valid stored number $\ge 0$, both the PDF export and on-screen printable preview prioritize `invoice.netPayable` over dynamic recalculation.
- **Impact:** Guarantees that historical customer invoices are never altered if external tax rules change in the future.

---

## 3. Regression Verification Ledger

- **All 23 Automated Test Suites:** **990 PASSED, 0 FAILED**.
- **Oxlint:** **0 warnings, 0 errors across 82 project files**.
- **Vite Production Build:** Clean build in **1.23s** with zero `firebase-admin` leakage.

