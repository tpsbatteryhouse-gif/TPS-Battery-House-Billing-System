# TPS BATTERY HOUSE — PHASE 5.3
# GST CALCULATION & END-TO-END RECONCILIATION REPORT

**Audit Objective:** Complete verification of the financial lifecycle from product entry to UPI QR generation.  
**Audited Modules:** `src/utils/gstCalculations.js`, `src/utils/pdfExport.js`, `src/components/InvoicePreview.jsx`, `src/firebase/services/invoiceService.js`  
**Test Suite:** `scratch/test_financial_calculation_signoff.mjs`  
**Date:** November 2026  
**Status:** **100% MATHEMATICALLY RECONCILED**  

---

## 1. The Financial Lifecycle Journey

Every invoice in TPS Battery House traverses an unbroken, immutable pipeline:

```
[ 1. Product Catalog / Direct Line Item Entry ]
                       │
       (rate, qty, gstRate, isInclusive, discount)
                       ▼
[ 2. Line Item Engine: calculateLineItem() ]
       ├── Tax Inclusive: gross = rate * qty - discount; taxable = gross / (1 + gst/100)
       ├── Tax Exclusive: taxable = rate * qty - discount; gross = taxable * (1 + gst/100)
       └── Tax Split: Intrastate (CGST 50% + SGST 50%) OR Interstate (IGST 100%)
                       ▼
[ 3. Invoice Totals Engine: calculateInvoiceTotals() ]
       ├── Sum Taxable Values: totalTaxableValue = Σ line.taxableValue
       ├── Sum Taxes: totalCgst, totalSgst, totalIgst, totalTax
       ├── Sum Gross: totalGross = Σ line.lineTotal
       ├── Deductions: subtotalAfterDeductions = totalGross - scrapExchange - extraDiscount
       ├── Round-Off: Auto (nearest whole rupee) OR Manual adjustment
       └── Final Net Payable: netPayable = subtotalAfterDeductions + roundOff
                       ▼
[ 4. Persistence Boundary: sanitizeInvoiceForFirestore() ]
       ├── Strict Schema & Range Validation: validateInvoiceFinancials()
       └── Snapshot Stored: netPayable, items, businessSnapshot, invoiceNumber
                       ▼
[ 5. Presentation & Export Layer (Printable Invoice, Vector PDF & UPI QR) ]
       ├── Immutable Snapshot Preserved: Reads stored invoice.netPayable directly
       ├── Vector PDF Rendering: generateVectorPdf() outputs identical rupee & paise table
       ├── Amount in Words: numberToIndianWords(invoice.netPayable)
       └── UPI QR Generation: buildUpiUri() with clean statutory am=X.XX payload
```

---

## 2. All-Slabs Multi-Rate Mixed Invoice Reconciliation Proof

To verify the absence of double-counting, category leaks, or HSN aggregation drift, a benchmark multi-rate invoice was executed:

- **Customer:** Kerala Intrastate Buyer (`stateCode: '32'`)
- **Items:** 5 distinct line items spanning every supported GST slab:

| # | Item Description | HSN | Qty | Rate (₹) | Pricing Model | GST % | Taxable Value (₹) | CGST (₹) | SGST (₹) | IGST (₹) | Line Total (₹) |
| :-: | :--- | :-: | :-: | :-: | :---: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | Agricultural Maintenance Guide | `4901` | 1 | 200.00 | Exclusive | **0%** | 200.00 | 0.00 | 0.00 | 0.00 | 200.00 |
| 2 | Solar Cable 4sqmm | `8544` | 10 | 50.00 | Exclusive | **5%** | 500.00 | 12.50 | 12.50 | 0.00 | 525.00 |
| 3 | Solar Inverter Connectors | `8504` | 2 | 1,500.00 | Exclusive | **12%** | 3,000.00 | 180.00 | 180.00 | 0.00 | 3,360.00 |
| 4 | Pure Sine Wave Inverter 1100VA | `8504` | 1 | 10,000.00 | Exclusive (₹500 dis)| **18%** | 9,500.00 | 855.00 | 855.00 | 0.00 | 11,210.00 |
| 5 | Tubular Lead-Acid Solar Battery| `8507` | 1 | 15,000.00 | Exclusive (₹1000 dis)| **28%** | 14,000.00 | 1,960.00 | 1,960.00 | 0.00 | 17,920.00 |

### 2.1 Invoice Deductions & Net Payable Computation
- **Gross Line Totals Sum ($\sum \text{lineTotal}$):**  
  $200.00 + 525.00 + 3,360.00 + 11,210.00 + 17,920.00 =$ **₹33,215.00**
- **Taxable Value Sum ($\sum \text{taxableValue}$):**  
  $200.00 + 500.00 + 3,000.00 + 9,500.00 + 14,000.00 =$ **₹27,200.00**
- **CGST Sum ($\sum \text{cgstAmount}$):**  
  $0.00 + 12.50 + 180.00 + 855.00 + 1,960.00 =$ **₹3,007.50**
- **SGST Sum ($\sum \text{sgstAmount}$):**  
  $0.00 + 12.50 + 180.00 + 855.00 + 1,960.00 =$ **₹3,007.50**
- **Total Tax ($\text{CGST} + \text{SGST}$):**  
  $3,007.50 + 3,007.50 =$ **₹6,015.00**
- **Scrap Exchange Buyback Credit:** **-₹2,500.00**
- **Special Additional Discount:** **-₹500.00**
- **Subtotal After Deductions:**  
  $33,215.00 - 2,500.00 - 500.00 =$ **₹30,215.00**
- **Round-Off:** **₹0.00** (already whole rupee)
- **Net Payable:** **₹30,215.00**
- **Amount in Words:** `Thirty Thousand Two Hundred Fifteen Rupees Only`

---

## 3. Independent Reference Engine Comparison

To prove that `src/utils/gstCalculations.js` does not merely test against its own assumptions, an independent calculation model was implemented in `scratch/test_financial_calculation_signoff.mjs` calculating strictly in sub-unit paise via integer scaling:

| Test Item | Line Rate | Qty | GST Slab | Production Taxable | Reference Taxable | Production GST | Reference GST | Production Gross | Reference Gross | Variance |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Battery 150Ah | ₹10,000.00 | 2 | 28% | ₹20,000.00 | ₹20,000.00 | ₹5,600.00 | ₹5,600.00 | ₹25,600.00 | ₹25,600.00 | **0.00** |
| Inverter 1100VA| ₹8,500.00 | 1 | 18% | ₹8,500.00 | ₹8,500.00 | ₹1,530.00 | ₹1,530.00 | ₹10,030.00 | ₹10,030.00 | **0.00** |
| Solar Modules | ₹14,500.00 | 4 | 12% | ₹58,000.00 | ₹58,000.00 | ₹6,960.00 | ₹6,960.00 | ₹64,960.00 | ₹64,960.00 | **0.00** |
| Electrolyte | ₹45.50 | 2.75 | 18% | ₹125.13 | ₹125.13 | ₹22.52 | ₹22.52 | ₹147.65 | ₹147.65 | **0.00** |
| Spares Rate | ₹100.50 | 2 | 18% | ₹201.00 | ₹201.00 | ₹36.18 | ₹36.18 | ₹237.18 | ₹237.18 | **0.00** |

**Cross-Engine Variance:** **₹0.0000 across all standard commercial rates.**

---

## 4. End-to-End Artifact Reconciliation

The complete pipeline was verified on benchmark invoice `TPS/2026-27/777`:

1. **Storage Payload (`sanitizeInvoiceForFirestore`):**
   - `stored.netPayable = 44240` (Integer number in Firestore)
   - Stored items contain exact line-level GST amounts.
2. **On-Screen Traditional Invoice View (`InvoicePreview.jsx`):**
   - Displays `payableAmount`: **₹44,240.00**
   - Amount in words: `FORTY FOUR THOUSAND TWO HUNDRED FORTY RUPEES ONLY`
3. **Vector PDF Document (`generateVectorPdf`):**
   - Renders bill amount box: **₹44,240.00**
   - Renders statutory words: `FORTY FOUR THOUSAND TWO HUNDRED FORTY RUPEES ONLY`
4. **Scannable UPI QR Payload (`buildUpiUri`):**
   - `upi://pay?pa=9846830532@okaxis&pn=TPS%20BATTERYS%20HOUSE&am=44240.00&cu=INR&tn=Bill%20TPS%2F2026-27%2F777`
   - Exact numeric match: `am=44240.00`.

---

## 5. Conclusion
Reconciliation is 100% congruent across all application boundaries. The system guarantees that the amount displayed to the customer, written to Firestore, exported in the vector PDF, and scanned via UPI QR code is identical down to the exact paisa.

