# TPS BATTERY HOUSE — PHASE 5.3
# STATUTORY FINANCIAL PRECISION & ROUNDING POLICY

**Target Architecture:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Implementation Modules:** `src/utils/gstCalculations.js`, `src/utils/categories.js`, `src/firebase/services/invoiceService.js`  
**Statutory Framework:** Central Goods and Services Tax (CGST) Act, 2017 (Sections 15 & 33) & CGST Rules, 2017 (Rule 46)  
**Date:** November 2026  
**Status:** **AUTHORITATIVE & VERIFIED**  

---

## 1. Executive Policy Framework

In retail and commercial battery, inverter, and solar equipment distribution in India, invoices must comply strictly with statutory GST rules while remaining mathematically predictable, reproducible, and resilient against floating-point anomalies.

This policy defines the precision standards, computational boundaries, rounding conventions, and validation contracts enforced throughout TPS Battery House.

---

## 2. Core Financial Parameter Specifications

| Parameter | Policy Limit / Specification | Enforcement Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **1. Max Invoice Amount** | **₹10,00,00,000.00** (₹10 Crores / 100M INR) | `FINANCIAL_BOUNDS.MAX_INVOICE_AMOUNT` in `validateFinancialInput` | **Active** |
| **2. Max Unit Price** | **₹10,00,000.00** (₹10 Lakhs / 1M INR) | `FINANCIAL_BOUNDS.MAX_UNIT_PRICE` | **Active** |
| **3. Max Line Quantity** | **100,000 units** | `FINANCIAL_BOUNDS.MAX_QUANTITY` | **Active** |
| **4. Min Line Quantity** | **0.001 units** (e.g., 1 ml / 1 gram / 1 mm) | `FINANCIAL_BOUNDS.MIN_QUANTITY` & `normalizeInvoiceItem` | **Active** |
| **5. Input Decimal Places** | Rates: 2 decimals; Qty: 3 decimals; Tax: whole slabs | Validation and formatting contracts | **Active** |
| **6. Internal Representation** | Bounded IEEE 754 Float (in INR Rupees) | JavaScript runtime numbers evaluated within safe integer mantissa ($< 2^{53}$) | **Active** |
| **7. Unit-Price Precision** | 2 decimal places (Rupees & Paise) | `roundToTwoDecimals(rate)` | **Active** |
| **8. Taxable-Value Precision**| 2 decimal places (Rupees & Paise) | `roundToTwoDecimals(taxableValue)` | **Active** |
| **9. GST Precision** | 2 decimal places (Rupees & Paise) | `roundToTwoDecimals(cgst, sgst, igst)` | **Active** |
| **10. Line-Item Rounding** | Commercial Round-Half-Up | Decimal exponential shift: `sign * Math.round(abs + 'e2') + 'e-2'` | **Active** |
| **11. Invoice-Level Summation**| Additive aggregation of line components | $\sum \text{taxableValue}$, $\sum \text{tax}$, $\sum \text{gross}$ | **Active** |
| **12. CGST/SGST Split** | Exact 50% / 50% split of line GST | Intrastate tax: $50\%$ to CGST, $50\%$ to SGST | **Active** |
| **13. IGST Computation** | 100% of GST rate to IGST | Interstate tax: $100\%$ to IGST, $0\%$ to CGST/SGST | **Active** |
| **14. Discount Limits** | $\text{Discount} \le \text{Rate} \times \text{Qty}$ | Prevented from exceeding line subtotal | **Active** |
| **15. Scrap Exchange Credit** | Post-tax payment credit / deduction | Subtracted from total gross invoice amount | **Active** |
| **16. Final Payable Amount** | $\text{Gross} - \text{Scrap} - \text{Discount} + \text{RoundOff}$ | Stored as `netPayable` in Firestore snapshot | **Active** |
| **17. Rupee Round-Off** | Auto: Nearest Rupee ($\pm ₹0.50$); Manual: $\pm ₹500.00$ | `roundOff` field with exact reconciliation | **Active** |
| **18. Negative Values** | Rates, quantities, taxes strictly $\ge 0$ | Disallowed except bounded manual round-off | **Active** |

---

## 3. Monetary Representation Evaluation & Selection

Three architectural models were evaluated during Phase 5.3:

### Option A: Integer Paise (Sub-unit Representation)
- *Concept:* Store and calculate all monetary quantities as whole integer paise (e.g. ₹100.00 = 10,000 paise).
- *Evaluation:* While integer arithmetic eliminates floating-point addition drift, **GST tax calculation inherently requires division by statutory factors** (e.g., $1.18$ for MRP reverse calculation, or $18/100$ for exclusive tax). Dividing integer paise by $1.18$ yields recurring fractions (e.g. $720338.983...$ paise), requiring rounding regardless.
- *Limitation:* Storing invoices in integer paise would break backward compatibility with historical Firestore documents and client interfaces expecting rupee numbers.

### Option B: Decimal Arithmetic Library (`decimal.js` / `big.js`)
- *Concept:* Introduce an arbitrary-precision decimal mathematics engine.
- *Evaluation:* Adds external bundle weight (30–50 kB) and requires serialization transforms for Cloud Firestore queries and documents.
- *Limitation:* The highest supported invoice amount (₹10 Crores = $10^9$ rupees = $10^{11}$ paise) requires only 37 bits of precision, well within the 53-bit exact mantissa of standard IEEE 754 numbers ($9 \times 10^{15}$). An external library introduces unnecessary complexity.

### Option C: Native Number with Decimal Exponential Round-Half-Up (Selected)
- *Concept:* Use standard 64-bit IEEE 754 floats bounded within $[0, 10^8]$ INR, coupled with an exact decimal exponential shifting algorithm that shifts into decimal space (`e2`) prior to rounding.
- *Verdict:* **ACCEPTED.** Zero bundle overhead, exact commercial round-half-up for all decimal midpoints, full Firestore compatibility, and 100% backward compatibility with all historical invoices.

---

## 4. Behavior Classification

### 4.1 Existing Application Behavior (Preserved)
1. **Tax Inclusive (MRP) Pricing:** Taxable base is reverse-calculated: $\text{Taxable} = \text{Gross} / (1 + \text{GSTRate}/100)$.
2. **Tax Exclusive Pricing:** Taxable base is $\text{Rate} \times \text{Qty} - \text{Discount}$. Total GST is added to taxable base.
3. **State Code Scoping:** Kerala state code (`32`) triggers intrastate CGST + SGST split; other codes trigger interstate IGST.
4. **Scrap Exchange:** Old battery buyback is treated as a post-tax settlement deduction, keeping taxable turnover accurate.
5. **Automatic Round-Off:** Automatically adjusts net payable to the nearest integer rupee with a fraction in the range $[-0.50, +0.50]$.

### 4.2 Proposed & Implemented Hardening (Phase 5.3)
1. **Scientific-Notation Safe Rounding:** `roundToTwoDecimals` parses mantissa and exponent components, preventing `NaN` when numbers format in exponential notation.
2. **Strict Financial Input Validator:** `validateInvoiceFinancials` intercepts corrupted strings (`"abc"`), `NaN`, `Infinity`, negative rates/quantities, and non-statutory GST rates before storage.
3. **Sub-cent Fractional Quantities:** Lower quantity threshold expanded from $0.01$ to $0.001$ in `normalizeInvoiceItem`.
4. **Snapshot Integrity in PDF & UI:** `pdfExport.js` and `InvoicePreview.jsx` prioritize the stored, immutable `invoice.netPayable` snapshot over dynamic recalculation.

### 4.3 Business Rules Requiring Owner Confirmation
1. **Manual Round-Off Upper Limit:** The system currently allows up to $\pm ₹500.00$ manual round-off adjustments for special customer concessions. *Owner recommendation: Confirm whether manual adjustments above ₹100.00 should require admin role authorization.*
2. **Zero-Rate Invoices:** Zero-rate invoices are currently permitted (for free warranty replacements or complimentary service). *Owner recommendation: Confirm whether a non-zero item warning should be displayed in the cashier UI.*

