# TPS BATTERY HOUSE — CATEGORY REVENUE RECONCILIATION
## Proportional Deduction Allocation & Mathematical Reconciliation Invariant

**Document Reference:** `docs/audit/dashboard-financial-reconciliation/CATEGORY_REVENUE_RECONCILIATION.md`  
**App Version:** Priority 1 Implementation  
**Target Module:** `src/utils/dashboardFinancialMetrics.js`

---

## 1. Problem Statement

In the previous version of the dashboard:
- Category sales were computed by taking the sum of raw line items:
  $$\text{CategoryGross}_c = \sum_{\text{item } \in c} \text{item.lineTotal}$$
- Total Billed was computed from invoice `netPayable`:
  $$\text{Total Billed} = \sum_{\text{inv}} \text{inv.netPayable}$$
- Because invoices contain invoice-level deductions:
  $$\text{netPayable} = \sum \text{lineTotals} - \text{ScrapBuyback} - \text{AdditionalDiscount} \pm \text{RoundOff}$$
- The raw category sums exceeded Total Billed whenever discounts or scrap buybacks were applied.
- In the initial dataset, this produced a **₹2,900.00 discrepancy** (Gross ₹1,66,800 vs Net ₹1,63,900).

---

## 2. Reconciled Accounting Model: Proportional Allocation

To guarantee exact reconciliation without double-counting or losing track of invoice deductions, TPS Battery House employs **Proportional Net Category Allocation**.

### Mathematical Model
For each issued invoice $k$:
1. Calculate gross line totals per category:
   $$\text{InvGross}_{k, c} = \sum_{j \in \text{items}_{k, c}} \text{calculateLineItem}(j).\text{lineTotal}$$
2. Calculate total invoice gross:
   $$\text{InvGrossTotal}_k = \sum_{c} \text{InvGross}_{k, c}$$
3. If $\text{InvGrossTotal}_k > 0$ and $\text{netPayable}_k > 0$, the net allocated revenue for category $c$ on invoice $k$ is:
   $$\text{Alloc}_{k, c} = \text{roundToTwoDecimals}\left(\text{InvGross}_{k, c} \times \frac{\text{netPayable}_k}{\text{InvGrossTotal}_k}\right)$$

### Residual Paise Distribution
Because arithmetic rounding to 2 decimals on fractional allocations may produce a 1 or 2 paise residual:
$$\text{Residual}_k = \text{netPayable}_k - \sum_{c} \text{Alloc}_{k, c}$$
The residual paise (positive or negative) is deterministically added to the category with the highest gross amount on invoice $k$:
$$\text{Alloc}_{k, c_{\max}} \leftarrow \text{Alloc}_{k, c_{\max}} + \text{Residual}_k$$

This guarantees that:
$$\sum_{c} \text{Alloc}_{k, c} \equiv \text{netPayable}_k \quad \forall k$$

Summing across all issued invoices in the period:
$$\sum_{c} \text{CategoryNetSales}_c \equiv \sum_{k} \text{netPayable}_k \equiv \text{Total Billed}$$

---

## 3. The Reconciliation Invariant

$$\mathbf{\sum_{c \in \text{Categories}} \text{CategoryNetSales}_c \equiv \text{Total Billed}}$$

- **Tolerance:** `0.00` (Exact mathematical equality).
- **Status Reporting:**
  - If discrepancy is `0.00`: Dashboard displays `<ShieldCheck /> Reconciled (100% Balanced)`.
  - If discrepancy $> 0.00$: Dashboard immediately renders an alert banner: `<AlertTriangle /> Discrepancy: ₹{discrepancy}`.

---

## 4. Audit Trail & Financial Transparency

To ensure accounting transparency, the dashboard also tracks and exposes the Gross-to-Net bridge:
1. **Gross Item Subtotal:** Total gross of line items before invoice deductions.
2. **Invoice Deductions:** Total scrap buybacks and additional discounts applied.
3. **Net Authoritative Billed:** Gross Subtotal minus Deductions.

In the initial 6 issued invoices:
- Gross Item Subtotal: **₹1,40,300.00**
- Invoice Deductions: **-₹2,400.00** (Scrap Buyback ₹2,000 + Discount ₹400)
- Net Authoritative Billed: **₹1,37,900.00**
- Sum of Reconciled Category Sales: **₹1,37,900.00**
- Discrepancy: **₹0.00**

