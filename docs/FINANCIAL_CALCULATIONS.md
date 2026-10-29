# Financial and GST Calculations — TPS BATTERYS HOUSE

This document explains the mathematical formulas, reverse GST tax calculations, rounding mechanisms, and metric aggregations implemented in the application.

> [!NOTE]
> **Statutory Disclaimer:** The formulas and calculations documented below are implemented in accordance with general Indian GST invoicing conventions (CGST, SGST, IGST split). They do not constitute formal legal or tax counsel. Tax rates, classification codes, and exemptions should be independently verified with a registered Chartered Accountant or GST practitioner.

---

## 1. Line Item Calculations (`calculateLineItem`)

Located in [`src/utils/gstCalculations.js`](../src/utils/gstCalculations.js).

The system supports two pricing modes common in automotive retail:
1. **Tax Inclusive (MRP Mode):** The entered rate is the gross retail price including GST.
2. **Tax Exclusive (+GST Mode):** The entered rate is the net taxable value before tax.

### Formulas

#### A. When Tax Inclusive (`isTaxInclusive === true`):
$$\text{Gross Amount} = \text{Rate} \times \text{Qty}$$
$$\text{Taxable Value} = \frac{\text{Gross Amount}}{1 + \frac{\text{GST Rate}}{100}}$$
$$\text{Total GST Amount} = \text{Gross Amount} - \text{Taxable Value}$$

#### B. When Tax Exclusive (`isTaxInclusive === false`):
$$\text{Taxable Value} = \text{Rate} \times \text{Qty}$$
$$\text{Total GST Amount} = \text{Taxable Value} \times \frac{\text{GST Rate}}{100}$$
$$\text{Gross Amount} = \text{Taxable Value} + \text{Total GST Amount}$$

#### C. Tax Component Breakdown:
- **Intrastate (Within Kerala, Customer State Code = 32):**
  $$\text{CGST Rate} = \frac{\text{GST Rate}}{2}, \quad \text{CGST Amount} = \frac{\text{Total GST Amount}}{2}$$
  $$\text{SGST Rate} = \frac{\text{GST Rate}}{2}, \quad \text{SGST Amount} = \frac{\text{Total GST Amount}}{2}$$
  $$\text{IGST Amount} = 0$$
- **Interstate (Outside Kerala, Customer State Code ≠ 32):**
  $$\text{IGST Rate} = \text{GST Rate}, \quad \text{IGST Amount} = \text{Total GST Amount}$$
  $$\text{CGST Amount} = 0, \quad \text{SGST Amount} = 0$$

---

## 2. Worked Example 1: Fuze 1100 Combo Set (28% GST, Inclusive)

- **Product:** Fuze 1100 Inverter + 150 Ah Tubular Battery (Combo Set)
- **HSN:** 8507
- **Qty:** 1 Set
- **Unit Rate (Inclusive):** ₹22,000.00
- **GST Rate:** 28% (Intrastate Kerala)

### Step-by-Step Calculation:
1. $\text{Gross Amount} = 22,000.00 \times 1 = \mathbf{₹22,000.00}$
2. $\text{Taxable Value} = \frac{22,000.00}{1 + 0.28} = \frac{22,000.00}{1.28} = \mathbf{₹17,187.50}$
3. $\text{Total GST} = 22,000.00 - 17,187.50 = \mathbf{₹4,812.50}$
4. $\text{CGST (14\%)} = \frac{4,812.50}{2} = \mathbf{₹2,406.25}$
5. $\text{SGST (14\%)} = \frac{4,812.50}{2} = \mathbf{₹2,406.25}$
6. **Line Total:** $\mathbf{₹22,000.00}$

---

## 3. Invoice-Level Aggregations (`calculateInvoiceTotals`)

Located in [`src/utils/gstCalculations.js`](../src/utils/gstCalculations.js).

### Formulas:
$$\text{Total Gross} = \sum \text{Line Total}_i$$
$$\text{Subtotal After Deductions} = \max(0, \text{Total Gross} - \text{Scrap Discount} - \text{Special Discount})$$

### Rounding Adjustment (`roundOff`):
- If `roundOffManual` is provided:
  $$\text{Net Payable} = \max(0, \text{Subtotal After Deductions} + \text{roundOffManual})$$
- If `roundOffManual === null` (Automatic Rounding):
  $$\text{Net Payable} = \text{round}(\text{Subtotal After Deductions})$$
  $$\text{Round Off Adjustment} = \text{Net Payable} - \text{Subtotal After Deductions}$$

---

## 4. Worked Example 2: Complete Invoice with Scrap Exchange

Taking the Fuze 1100 Combo Set above, with an old battery scrap exchange:
- **Total Gross:** ₹22,000.00
- **Scrap Battery Buyback Credit:** -₹2,000.00 (Old 150Ah scrap battery)
- **Special Discount:** ₹0.00
- **Subtotal After Deductions:** $22,000.00 - 2,000.00 = \mathbf{₹20,000.00}$
- **Round-off:** ₹0.00
- **Final Net Payable:** $\mathbf{₹20,000.00}$
- **Amount in Words ([`src/utils/numberToWords.js`](../src/utils/numberToWords.js)):**
  *"Twenty Thousand Rupees Only"*

---

## 5. Dashboard Summary Metrics (`Dashboard.jsx`)

Located in [`src/components/Dashboard.jsx`](../src/components/Dashboard.jsx).

Metrics are calculated reactively via `useMemo` from the `invoices` array:

| Metric Card | Calculation Formula |
| :--- | :--- |
| **Total Invoices** | $\text{count}(\text{invoices})$ |
| **Paid Invoices** | $\text{count}(\{i \in \text{invoices} \mid i.\text{paymentStatus} === \text{'Paid'}\})$ |
| **Pending Invoices**| $\text{count}(\{i \in \text{invoices} \mid i.\text{paymentStatus} === \text{'Pending'}\})$ |
| **Total Revenue** | $\sum \{i.\text{netPayable} \mid i.\text{paymentStatus} === \text{'Paid'}\}$ |
| **Pending Balance** | $\sum \{i.\text{netPayable} \mid i.\text{paymentStatus} === \text{'Pending'}\}$ |

### Status Categorization Rules:
- **`Paid`:** Counted in Paid card and added to Total Revenue.
- **`Pending`:** Counted in Pending card and added to Pending Balance.
- **`Overdue`:** Highlighted in red in the list; excluded from settled revenue.
- **`Draft`:** Work-in-progress quotations; excluded from revenue figures.
