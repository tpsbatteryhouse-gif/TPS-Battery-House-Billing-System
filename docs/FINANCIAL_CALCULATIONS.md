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
$$\text{Gross Amount} = \max(0, (\text{Rate} \times \text{Qty}) - \text{Item Discount})$$
$$\text{Taxable Value} = \frac{\text{Gross Amount}}{1 + \frac{\text{GST Rate}}{100}}$$
$$\text{Total GST Amount} = \text{Gross Amount} - \text{Taxable Value}$$

#### B. When Tax Exclusive (`isTaxInclusive === false`):
$$\text{Taxable Value} = \max(0, (\text{Rate} \times \text{Qty}) - \text{Item Discount})$$
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
Converts the net payable amount to official Indian accounting currency text (e.g., *"Forty-Seven Thousand Multiple Hundred Twenty-Five Rupees Only"*).

---

## 5. Save Data Integrity & Mathematical Invariants

To guarantee that invoice values never mutate automatically when saving, editing, or reopening a bill, the calculation engine adheres to the following strict mathematical invariants:

### A. Idempotent Tax Calculation
Tax extraction from MRP rates is strictly a derived projection:
$$\text{Taxable Value} = \frac{\text{Rate} \times \text{Qty}}{1 + \frac{\text{GST Rate}}{100}}$$
The operator's raw `rate` is stored unchanged. Saving or reloading an invoice never overwrites `rate` with `Taxable Value`.

### B. Decimal Precision Preservation
- Unit rates are parsed using floating-point decimals (`parseFloat(val) || 0`), ensuring prices such as `₹1,234.56` or `₹149.95` never suffer integer rounding truncation.
- Quantities are parsed safely with `parseFloat`, supporting fractional values (e.g. `1.5 kW`, `2.5 Sets`).

### C. Non-Duplication of Deductions
Trade-in scrap allowances and additional discounts are applied strictly once during final aggregation:
$$\text{Net Payable} = \text{Round}\left(\sum \text{Line Total}_i - \text{Scrap Allowance} - \text{Additional Discount}\right)$$
Deductions are never subtracted from individual line items or persisted twice.

### D. HSN Splicing Accuracy
When displaying half-rates for CGST and SGST in the statutory summary, formatting uses exact 2-decimal notation:
$$\text{Display Rate} = \left(\frac{\text{GST Rate}}{2}\right).\text{toFixed}(2) + \text{"%"}$$
This ensures a 5% GST slab correctly renders as `2.50%` rather than producing invalid decimal string concatenations (`2.5.00`).
