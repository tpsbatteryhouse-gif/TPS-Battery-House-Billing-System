# TPS BATTERY HOUSE — PHASE 5.3
# FINANCIAL INPUT VALIDATION & DATA INTEGRITY SPECIFICATION

**Target Architecture:** Validation Gatekeepers in `src/utils/gstCalculations.js` & `src/firebase/services/invoiceService.js`  
**Date:** November 2026  
**Status:** **ACTIVE & ENFORCED**  

---

## 1. Problem Statement: The Danger of Silent Zero-Conversion

In naive JavaScript applications, parsing numbers often relies on patterns like:
```javascript
const rate = Number(rawRate) || 0;
const qty = Number(rawQty) || 1;
```
This pattern presents a severe business risk in commercial billing systems:
- If a cashier enters an invalid string like `"abc"`, `Number("abc")` evaluates to `NaN`.
- `NaN || 0` silently evaluates to `0`.
- An invoice containing 10 units of an expensive battery with a malformed price would **silently save as a ₹0.00 transaction**!
- If a negative price like `-500` is entered, `Math.max(0, -500)` silently evaluates to `0`.
- If an invalid GST rate like `35%` is entered, the invoice computes illegal tax figures.

Phase 5.3 eliminates silent zero-conversion by introducing explicit validation gatekeepers at the application and storage boundaries.

---

## 2. Input Classification Matrix

Every financial input field is classified into one of five categories:

| Input Value | Raw Type | Classification | Treatment | Enforcement Point |
| :--- | :--- | :--- | :--- | :--- |
| `100.50` | `number` | **Accepted** | Evaluated directly | All Layers |
| `"100.50"` | `string` | **Accepted & Normalized** | Parsed via `Number(val.trim())` | Input Gatekeeper |
| `0` | `number` | **Accepted (Conditional)**| Allowed for free items, 0% GST, or zero discount; **Rejected** for quantities | `validateFinancialInput` |
| `null` | `object` | **Treated as Optional** | Defaults to `0` for optional fields (e.g. discount); **Rejected** for required fields | `validateFinancialInput` |
| `undefined` | `undefined` | **Treated as Optional** | Defaults to `0` for optional fields; **Rejected** for required fields | `validateFinancialInput` |
| `""` / `"   "` | `string` | **Treated as Optional** | Defaults to `0` for optional fields; **Rejected** for required fields | `validateFinancialInput` |
| `"-0"` / `-0` | `number` | **Normalized** | Normalized to standard `+0` | `roundToTwoDecimals` |
| `"abc"` | `string` | **Invalid Financial Data** | **REJECTED**: Throws validation error | `validateFinancialInput` |
| `NaN` | `number` | **Invalid Financial Data** | **REJECTED**: Throws validation error | `validateFinancialInput` |
| `Infinity` | `number` | **Invalid Financial Data** | **REJECTED**: Throws validation error | `validateFinancialInput` |
| `-Infinity` | `number` | **Invalid Financial Data** | **REJECTED**: Throws validation error | `validateFinancialInput` |
| `-1`, `"-1.005"`| `number/str` | **Invalid Financial Data** | **REJECTED**: Non-negative rate/qty required | `validateFinancialInput` |
| `true` / `false` | `boolean` | **Invalid Financial Data** | **REJECTED**: Primitive booleans disallowed | `validateFinancialInput` |
| `{}` / `[]` | `object` | **Invalid Financial Data** | **REJECTED**: Complex objects disallowed | `validateFinancialInput` |
| `1e21` / `1e24` | `number/str` | **Invalid Financial Data** | **REJECTED**: Exceeds maximum policy limit | `validateFinancialInput` |

---

## 3. Boundary Validation Implementation

### 3.1 Field-Level Gatekeeper: `validateFinancialInput`
Exported from `src/utils/gstCalculations.js`:
```javascript
export function validateFinancialInput(val, fieldName = 'Amount', {
  min = 0,
  max = FINANCIAL_BOUNDS.MAX_INVOICE_AMOUNT,
  allowZero = true,
  required = false,
} = {}) {
  if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
    if (required) {
      throw new Error(`${fieldName} is required.`);
    }
    return allowZero ? 0 : null;
  }

  if (typeof val === 'boolean' || Array.isArray(val) || (typeof val === 'object')) {
    throw new Error(`${fieldName} must be a valid number, received ${typeof val}.`);
  }

  const n = Number(val);
  if (Number.isNaN(n)) {
    throw new Error(`${fieldName} contains invalid characters and cannot be converted to a number.`);
  }

  if (!Number.isFinite(n)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }

  if (n < min) {
    throw new Error(`${fieldName} cannot be less than ${min}.`);
  }

  if (n > max) {
    throw new Error(`${fieldName} exceeds maximum permitted value of ${max}.`);
  }

  if (!allowZero && n === 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }

  return n;
}
```

### 3.2 Invoice Document Gatekeeper: `validateInvoiceFinancials`
Validates every line item and deduction across an entire invoice before calculation or persistence:
- **Line Items:** Non-empty array, max 100 items.
- **Unit Price (`rate`):** Finite number between ₹0 and ₹10,00,000.
- **Quantity (`qty`):** Finite positive number between $0.001$ and $100,000$.
- **GST Slab (`gstRate`):** Must strictly be one of `[0, 5, 12, 18, 28]`.
- **Item Discount:** Cannot be negative; cannot exceed `rate * qty`.
- **Scrap Exchange:** Cannot be negative; max ₹10,00,000.
- **Invoice Discount:** Cannot be negative; max ₹10,00,000.
- **Manual Round-Off:** Bounded within $[-₹500.00, +₹500.00]$.

### 3.3 Storage Boundary Gatekeeper: `sanitizeInvoiceForFirestore`
In `src/firebase/services/invoiceService.js`:
```javascript
  // Validate items list
  if (!Array.isArray(rawInvoice.items) || rawInvoice.items.length === 0) {
    throw new Error('Invoice must contain at least 1 item.');
  }
  if (rawInvoice.items.length > 100) {
    throw new Error('Invoice cannot contain more than 100 items.');
  }

  // Strict financial input validation: prevents silent conversion of malformed data into zero
  validateInvoiceFinancials(rawInvoice);
```

---

## 4. Legitimate Zero-Value Support

Validation is carefully tuned to allow legitimate commercial zero-value transactions:
1. **Complimentary / Warranty Service Items:** Items with `rate: 0` and `gstRate: 0` (e.g. Free Battery Water Top-Up, Terminal Health Check, or Replacement Warranty Dispatch) are permitted.
2. **GST-Exempt Products:** Items with `gstRate: 0` calculate correctly with zero tax without validation failure.
3. **Zero Adjustments:** Invoices without discounts (`discount: 0`), scrap buybacks, or manual round-offs pass validation seamlessly.

---

## 5. Verification Evidence
All validation assertions were verified in `scratch/test_financial_calculation_signoff.mjs`:
- Blocked malformed rate `"abc"` (throws error).
- Blocked negative price `-500` (throws error).
- Blocked negative quantity `-2` (throws error).
- Blocked zero quantity `0` (throws error).
- Blocked invalid GST slab `35%` (throws error).
- Blocked excessive line discount (throws error).
- Accepted legitimate complimentary service item (`rate: 0, gstRate: 0`).

