# Deliverable 4: Financial Integrity & Calculation Review

**Document Version:** 1.0.0  
**Phase:** New Tax Invoice Screen — Google Stitch Design Integration  
**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** November 2026  

---

## 1. Compliance with Phase 5.3 Mathematical Standards

The new Tax Invoice screen strictly adheres to the Phase 5.3 Financial Precision Policy:
- **Zero Floating-Point Artifacts:** No native `.toFixed(2)` is used for intermediary financial values. All rounding operations utilize `roundToTwoDecimals(num)` which employs symmetric round-half-up decimal exponential scaling.
- **Strict Bounds Checking:** All rates, quantities, discounts, and deductions are validated through `validateFinancialInput` and `FINANCIAL_BOUNDS`.
- **Negative & Infinite Input Protection:** Quantities must be strictly greater than zero; negative discounts and out-of-range round-off adjustments are blocked.

---

## 2. Tax Mode Formula Verification

### 2.1 Tax Inclusive Mode (MRP Reverse Calculation)
When `isTaxInclusive` is true:
$$\text{Gross Amount} = (\text{Rate} \times \text{Qty}) - \text{Discount}$$
$$\text{Taxable Value} = \text{roundToTwoDecimals}\left(\frac{\text{Gross Amount}}{1 + \frac{\text{GST Rate}}{100}}\right)$$
$$\text{Total GST} = \text{roundToTwoDecimals}(\text{Gross Amount} - \text{Taxable Value})$$

### 2.2 Tax Exclusive Mode
When `isTaxInclusive` is false:
$$\text{Taxable Value} = (\text{Rate} \times \text{Qty}) - \text{Discount}$$
$$\text{Gross Amount} = \text{Taxable Value} \times \left(1 + \frac{\text{GST Rate}}{100}\right)$$
$$\text{Total GST} = \text{roundToTwoDecimals}(\text{Gross Amount} - \text{Taxable Value})$$

---

## 3. Place of Supply & Tax Split

- **Intrastate Supply (e.g. Kerala to Kerala - State Code 32):**
  $$\text{CGST Amount} = \text{roundToTwoDecimals}\left(\frac{\text{Total GST}}{2}\right)$$
  $$\text{SGST Amount} = \text{roundToTwoDecimals}\left(\frac{\text{Total GST}}{2}\right)$$
  $$\text{IGST Amount} = 0$$

- **Interstate Supply (e.g. Kerala 32 to Tamil Nadu 33):**
  $$\text{CGST Amount} = 0, \quad \text{SGST Amount} = 0$$
  $$\text{IGST Amount} = \text{roundToTwoDecimals}(\text{Total GST})$$

---

## 4. Deductions, Scrap Trade-in & Reconciliation

- **Scrap Battery Buyback:** When enabled, the trade-in allowance is subtracted from the gross invoice total prior to net payable computation.
- **Reconciliation Invariant:** As proven by `src/utils/dashboardFinancialMetrics.js`, unallocated scrap buybacks and special discounts are proportionally distributed across category revenue lines, ensuring that:
  $$\sum \text{Category Net Sales} \equiv \text{Total Billed Revenue}$$
  $$\text{Reconciliation Discrepancy} \equiv 0.00$$

