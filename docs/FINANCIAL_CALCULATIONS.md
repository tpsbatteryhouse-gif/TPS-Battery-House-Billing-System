# Financial and GST Calculations — TPS BATTERYS HOUSE

This document explains the mathematical formulas, reverse GST tax calculations, multi-HSN grouping, category sales breakdowns, and rounding mechanisms implemented in the application.

> [!NOTE]
> **Statutory Disclaimer:** The calculations below follow standard Indian GST invoicing conventions (intra-state CGST+SGST, inter-state IGST). They do not constitute legal or tax counsel. Actual HSN codes and GST rates vary depending on battery chemistry, inverter topology, solar panel specifications, and composite/mixed supply contracts. Operators must consult their certified Chartered Accountant or tax advisor.

---

## 1. Line Item Calculations (`calculateLineItem`)

Located in [`src/utils/gstCalculations.js`](../src/utils/gstCalculations.js).

The system supports two pricing modes across all product categories:
1. **Tax Inclusive (MRP Mode):** The entered rate includes GST.
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

## 2. Multi-HSN Statutory Summary Table

When an invoice contains items across multiple categories with different HSN codes and tax rates, `calculateInvoiceTotals` groups line items by the composite key `${item.hsn}_${item.gstRate}`:

$$\text{Group Taxable Value} = \sum_{\text{key}} \text{Item Taxable Value}$$
$$\text{Group CGST Amount} = \sum_{\text{key}} \text{Item CGST Amount}$$
$$\text{Group SGST Amount} = \sum_{\text{key}} \text{Item SGST Amount}$$
$$\text{Group IGST Amount} = \sum_{\text{key}} \text{Item IGST Amount}$$

Example of a multi-category invoice summary:
| HSN / SAC | Description | GST Rate | Taxable Value | CGST Amount | SGST Amount | Total Tax |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `8507` | Lead-Acid Storage Battery | 28% | ₹12,109.38 | ₹1,695.31 | ₹1,695.31 | ₹3,390.62 |
| `8504` | Pure Sine Wave Inverter | 18% | ₹5,762.71 | ₹518.64 | ₹518.64 | ₹1,037.29 |
| `8541` | Bifacial Solar Panels (2 Nos) | 12% | ₹24,553.57 | ₹1,473.21 | ₹1,473.21 | ₹2,946.43 |
| `9954` | Rooftop Solar Installation | 18% | ₹5,508.47 | ₹495.76 | ₹495.76 | ₹991.53 |

---

## 3. Category Sales Distribution (No Double Counting)

To report revenue by category accurately on mixed-category invoices, the sales contribution of each line item is mapped strictly to its own category:

$$\text{Category Sales}[\text{cat}] = \sum_{i \in \text{items}, \, i.\text{category} = \text{cat}} \text{Line Total}_i$$

$$\sum_{\text{cat} \in \{\text{battery}, \text{inverter}, \text{solar}, \text{services}\}} \text{Category Sales}[\text{cat}] \equiv \text{Total Invoice Gross}$$

This guarantees that:
- A mixed invoice containing a ₹15,500 battery and a ₹6,800 inverter attributes exactly ₹15,500 to Battery Sales and ₹6,800 to Inverter Sales.
- No mixed invoice is counted more than once in total revenue calculations.

---

## 4. Invoice Deductions & Net Payable

$$\text{Total Gross} = \sum_{i} \text{Line Total}_i$$
$$\text{Subtotal After Deductions} = \max(0, \text{Total Gross} - \text{Scrap Discount} - \text{Additional Discount})$$

### Rounding:
- **Auto Round-off (`roundOffManual === null`):**
  $$\text{Net Payable} = \text{round}(\text{Subtotal After Deductions})$$
  $$\text{Round-off Adjustment} = \text{Net Payable} - \text{Subtotal After Deductions}$$
- **Manual Round-off:**
  $$\text{Net Payable} = \max(0, \text{Subtotal After Deductions} + \text{roundOffManual})$$

### Number to Words ([`src/utils/numberToWords.js`](../src/utils/numberToWords.js)):
Converts the net payable amount to official Indian accounting currency text (e.g., *"Forty-Seven Thousand Nine Hundred Twenty-Five Rupees Only"*).
