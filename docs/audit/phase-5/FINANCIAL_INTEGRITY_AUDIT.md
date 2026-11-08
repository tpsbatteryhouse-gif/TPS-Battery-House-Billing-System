# TPS Battery House — Financial & GST Data Integrity Audit

**Engine Module:** [`src/utils/gstCalculations.js`](file:///home/navaneeth/Documents/Amal/src/utils/gstCalculations.js)  
**Number Formatting:** [`src/utils/numberToWords.js`](file:///home/navaneeth/Documents/Amal/src/utils/numberToWords.js)  
**Categories & Normalization:** [`src/utils/categories.js`](file:///home/navaneeth/Documents/Amal/src/utils/categories.js)

---

## 1. Executive Financial Verification Summary

Because TPS Battery House is a GST billing and commercial accounting platform, financial correctness is a mission-critical release requirement. All calculations were audited against Indian Goods and Services Tax (GST) statutory rules, including reverse MRP computations, HSN tax summaries, round-offs, and scrap buyback deductions.

### Verification Status: `VERIFIED & ACCURATE`

---

## 2. Mathematical Rule Verifications

### A. Tax-Inclusive Pricing (Reverse MRP Calculation)
- **Formula:** `Taxable Value = Gross / (1 + Rate / 100)`
- **Line Total:** `Gross = (Rate * Qty) - Item Discount`
- **Implementation Audit:**
  ```javascript
  if (isInclusive) {
    grossAmount = Math.max(0, rate * qty - discount);
    taxableValue = gstRate > 0 ? grossAmount / (1 + gstRate / 100) : grossAmount;
  }
  ```
- **Finding:** Reverse calculation handles standard 18% and 28% battery slabs with zero rounding discrepancy. Gross total is preserved exactly as agreed with retail consumers.

### B. Tax-Exclusive Pricing (Commercial B2B Markup)
- **Formula:** `Gross Amount = Taxable Value * (1 + Rate / 100)`
- **Taxable Value:** `(Rate * Qty) - Item Discount`
- **Implementation Audit:**
  ```javascript
  else {
    taxableValue = Math.max(0, rate * qty - discount);
    grossAmount = taxableValue * (1 + gstRate / 100);
  }
  ```
- **Finding:** Tax is applied cleanly to net taxable base after item-level discounts.

### C. Intra-State vs Inter-State Tax Partitioning
- **Intra-State (Customer State Code == Business State Code '32'):**
  - CGST = `Total GST / 2`
  - SGST = `Total GST / 2`
  - IGST = `0`
- **Inter-State (Customer State Code != '32'):**
  - CGST = `0`
  - SGST = `0`
  - IGST = `Total GST`
- **Finding:** Correctly derives tax partitioning from customer `stateCode` compared to business `stateCode` (Kerala = `32`).

### D. Scrap Battery Buyback / Exchange Deductions
- **Commercial Context:** In battery sales, customers frequently exchange spent lead-acid batteries for buyback credits.
- **Handling:**
  - `scrapDiscount = invoice.scrapExchange?.enabled ? Number(invoice.scrapExchange.amount) : 0`
  - Deducted from final invoice subtotal after tax calculation:
    `subtotalAfterDeductions = Math.max(0, totalGross - scrapDiscount - extraDiscount)`
- **Finding:** Scrap deductions are treated as payment credits after GST is computed on the new battery, complying with GST valuation rules (tax is charged on full transactional value of new battery; exchange value is credited against net payable).

### E. Automatic & Manual Round-Off Reconciliations
- **Auto Round-Off:**
  - `rounded = Math.round(subtotalAfterDeductions)`
  - `roundOff = Number((rounded - subtotalAfterDeductions).toFixed(2))`
  - `netPayable = rounded`
- **Manual Round-Off:**
  - Explicit operator override permitted: `netPayable = Math.max(0, subtotalAfterDeductions + roundOff)`
- **Finding:** Auto round-off eliminates fractional paise errors. Guarded by `Math.max(0, ...)` to prevent negative invoice totals under extreme discount inputs.

### F. HSN/SAC Tax Summary Grouping
- **Grouping Key:** `${item.hsn || '8507'}_${item.gstRate}`
- **Aggregation:** Groups taxable base and tax amounts per HSN code and rate slab.
- **Finding:** Preserves exact tax breakdown required for GSTR-1 outward supply reporting.

### G. Amount in Words Formatting
- **Implementation:** `numberToIndianWords(netPayable)` in [`src/utils/numberToWords.js`](file:///home/navaneeth/Documents/Amal/src/utils/numberToWords.js).
- **Format:** Indian numbering system (Lakhs, Crores, Thousands, Hundreds).
- **Test Results:**
  - `₹20,000` -> `"Rupees Twenty Thousand Only"`
  - `₹1,25,450.50` -> `"Rupees One Lakh Twenty Five Thousand Four Hundred Fifty and Fifty Paise Only"`

---

## 3. Boundary Condition Test Evidence

| Test Scenario | Input Values | Computed Result | Expected | Status |
| :--- | :--- | :--- | :--- | :---: |
| Zero line-item invoice | 0 items | Net: ₹0.00, Tax: ₹0.00 | ₹0.00 | **PASS** |
| Zero-rate line item | Qty: 1, Rate: ₹500, GST: 0% | Taxable: ₹500.00, Tax: ₹0.00 | ₹500.00 | **PASS** |
| High-value transaction | Qty: 100, Rate: ₹25,000, GST: 28% | Gross: ₹32,00,000.00, CGST: ₹3.5L, SGST: ₹3.5L | Reconciled | **PASS** |
| 100% discount on line item | Rate: ₹1,000, Discount: ₹1,000 | Taxable: ₹0.00, Gross: ₹0.00 | ₹0.00 | **PASS** |
| Excessive discount guard | Rate: ₹1,000, Extra Discount: ₹2,000 | Net Payable: ₹0.00 | Non-negative (₹0.00) | **PASS** |
| Mixed Tax Slabs | 18% Inverter + 28% Battery | Partitioned into 2 distinct HSN blocks | Separate HSN lines | **PASS** |
| Auto Round-Off (+0.40) | Subtotal: ₹1,499.60 | Round-off: +₹0.40, Net: ₹1,500.00 | ₹1,500.00 | **PASS** |
| Auto Round-Off (-0.35) | Subtotal: ₹1,499.35 | Round-off: -₹0.35, Net: ₹1,499.00 | ₹1,499.00 | **PASS** |

