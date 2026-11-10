# Line Item Calculation & Display Review

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**System Location:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-10  
**Scope:** Mathematical Precision, Line Item Card Totals, and Invoice Summary Reconciliation  

---

## 1. Line Item Calculation Contract (`src/utils/gstCalculations.js`)

`calculateLineItem(item, isInterstate = false)` is the pure, deterministic statutory calculation engine.

### Mathematical Formulation:

#### Case A: Tax Inclusive Pricing (MRP Reverse Calculation)
When `isTaxInclusive === true`:
$$\text{Gross Amount} = \max(0, (\text{rate} \times \text{qty}) - \text{discount})$$
$$\text{Taxable Value} = \frac{\text{Gross Amount}}{1 + \frac{\text{gstRate}}{100}}$$
$$\text{Total GST} = \text{Gross Amount} - \text{Taxable Value}$$

#### Case B: Tax Exclusive Pricing
When `isTaxInclusive === false`:
$$\text{Taxable Value} = \max(0, (\text{rate} \times \text{qty}) - \text{discount})$$
$$\text{Total GST} = \text{Taxable Value} \times \frac{\text{gstRate}}{100}$$
$$\text{Gross Amount} = \text{Taxable Value} + \text{Total GST}$$

### Intra-State vs Inter-State Apportionment:
- If `isInterstate === false` (Intra-state, e.g. Kerala to Kerala):
  $$\text{CGST} = \text{Total GST} / 2, \quad \text{SGST} = \text{Total GST} / 2, \quad \text{IGST} = 0$$
- If `isInterstate === true` (Inter-state):
  $$\text{IGST} = \text{Total GST}, \quad \text{CGST} = 0, \quad \text{SGST} = 0$$

---

## 2. The Return Payload & Data Contract

`calculateLineItem` returns:
```javascript
return {
  ...normalized,
  qty,
  rate,
  gstRate,
  discount: roundToTwoDecimals(discount),
  taxableValue: roundToTwoDecimals(taxableValue),
  cgstRate,
  cgstAmount: roundToTwoDecimals(cgstAmount),
  sgstRate,
  sgstAmount: roundToTwoDecimals(sgstAmount),
  igstRate,
  igstAmount: roundToTwoDecimals(igstAmount),
  totalGstAmount: roundToTwoDecimals(totalGstAmount),
  lineTotal: roundToTwoDecimals(grossAmount),
  total: roundToTwoDecimals(grossAmount), // Defensive alias ensuring backward & forward compatibility
};
```

---

## 3. Verified Scenarios from the 14-Point Test Matrix

| Scenario | Description | Qty × Rate (Mode, GST) | Card Total | Sidebar Subtotal | Status |
| :---: | :--- | :--- | :---: | :---: | :---: |
| **1** | Exide Battery | 2 × ₹14,800.00 (Incl, 28%) | **₹29,600.00** | ₹29,600.00 | **MATCH** |
| **2** | Luminous Inverter | 1 × ₹28,500.00 (Incl, 18%) | **₹28,500.00** | ₹28,500.00 | **MATCH** |
| **3** | Solar Panels | 4 × ₹12,000.00 (Incl, 12%) | **₹48,000.00** | ₹48,000.00 | **MATCH** |
| **4** | Installation Service | 1 × ₹1,500.00 (Incl, 18%) | **₹1,500.00** | ₹1,500.00 | **MATCH** |
| **5** | Single Battery | 1 × ₹14,800.00 (Incl, 28%) | **₹14,800.00** | ₹14,800.00 | **MATCH** |
| **6** | Tax-Exclusive Item | 2 × ₹10,000.00 (+18% GST) | **₹23,600.00** | ₹23,600.00 | **MATCH** |
| **7** | Discounted Item | 2 × ₹10,000.00 (-₹1,000 disc) | **₹19,000.00** | ₹19,000.00 | **MATCH** |
| **8** | Decimal Quantity | 2.5 × ₹1,000.00 (Incl) | **₹2,500.00** | ₹2,500.00 | **MATCH** |
| **9** | Large Quantity | 100 × ₹500.00 (Incl) | **₹50,000.00** | ₹50,000.00 | **MATCH** |
| **10** | Zero-Rate Service | 1 × ₹0.00 (Complimentary) | **₹0.00** | ₹0.00 | **MATCH** |
| **11** | Combo Multi-Item | Card 1 (₹29,600) + Card 2 (₹28,500) | **₹58,100.00** | **₹58,100.00** | **EXACT MATCH** |
| **12** | Reactive Qty Change | 1 -> 2 (₹14,800 -> ₹29,600) | **₹29,600.00** | ₹29,600.00 | **MATCH** |
| **13** | Reactive Price Change | ₹14,800 -> ₹15,000 | **₹30,000.00** | ₹30,000.00 | **MATCH** |
| **14** | Reactive Item Discount | Applying ₹600 discount | **₹29,000.00** | ₹29,000.00 | **MATCH** |

In all 14 scenarios, the sum of card totals equals the sidebar `totalGross` with zero discrepancies.

