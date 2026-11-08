# TPS BATTERY HOUSE — FINANCIAL METRIC CONTRACT
## Authoritative Metric Definitions, Lifecycle Rules & Calculation Contracts

**Document Reference:** `docs/audit/dashboard-financial-reconciliation/FINANCIAL_METRIC_CONTRACT.md`  
**App Version:** Phase 6B.1 / Priority 1  
**Target Module:** `src/utils/dashboardFinancialMetrics.js` & `src/components/Dashboard.jsx`

---

## 1. Purpose

This document establishes the binding financial contract for all dashboard metrics in TPS Battery House. Every displayed figure must adhere strictly to these lifecycle, inclusion, and calculation rules.

---

## 2. Invoice Lifecycle Status Segregation

The system recognizes five distinct lifecycle statuses:

```
[Draft] ----------> [Issued: Pending] ----------> [Issued: Paid]
                          |
                          v (Past due terms)
                    [Issued: Overdue]

(Any non-settled invoice may transition to [Cancelled])
```

1. **Issued Invoices (`issuedInvoices`):**
   - Invoices with `paymentStatus` equal to `Paid`, `Pending`, or `Overdue`.
   - Represents legally binding, issued tax invoices sent or committed to customers.
   - **Exclusively forms the population for all sales, revenue, and outstanding metrics.**

2. **Draft Invoices (`draftInvoices`):**
   - Invoices with `paymentStatus` equal to `Draft`.
   - Represents uncommitted work-in-progress bills.
   - **MUST NEVER be added into Total Billed, Category Sales, or Outstanding Debt.**
   - Tracked separately as informational work-in-progress count (`draftCount`) and amount (`draftBilled`).

3. **Cancelled Invoices (`cancelledInvoices`):**
   - Invoices with `paymentStatus` equal to `Cancelled`.
   - Represents voided or annulled transactions.
   - **MUST NEVER be added into Billed, Collected, or Outstanding totals.**

---

## 3. Financial Metrics Contract

### 3.1 Total Billed
- **Definition:** The total gross value of all finalized sales committed to customers during the selected period.
- **Formula:**
  $$\text{Total Billed} = \sum_{i \in \text{Issued Invoices}} \text{netPayable}_i$$
- **Precision:** `roundToTwoDecimals` applied at invoice addition.
- **Inclusions:** Includes GST, item discounts, scrap exchange deductions, additional discounts, and manual round-off.
- **Exclusions:** Excludes `Draft` and `Cancelled` invoices.

### 3.2 Collected Revenue
- **Definition:** Authoritative cash / digital payments settled into the business accounts from fully settled invoices during the period.
- **Formula:**
  $$\text{Collected Revenue} = \sum_{i \in \text{Paid Invoices}} \text{netPayable}_i$$
- **Precision:** `roundToTwoDecimals`.
- **Exclusions:** Unpaid portions, pending invoices, overdue invoices, drafts.

### 3.3 Outstanding Amount (Pending vs Overdue)
- **Pending Balance (Within Terms):**
  $$\text{Pending Balance} = \sum_{i \in \text{Pending Invoices}} \text{netPayable}_i$$
- **Overdue Debt (Past Terms):**
  $$\text{Overdue Debt} = \sum_{i \in \text{Overdue Invoices}} \text{netPayable}_i$$
- **Total Outstanding Debt:**
  $$\text{Total Outstanding} = \text{Pending Balance} + \text{Overdue Debt}$$
- **Invariant:**
  $$\text{Total Billed} \equiv \text{Collected Revenue} + \text{Total Outstanding}$$

### 3.4 Rate Metrics
- **Invoice Payment Rate (%):**
  $$\text{Payment Rate} = \begin{cases} \text{roundToTwoDecimals}\left(\frac{|\text{Paid Invoices}|}{|\text{Issued Invoices}|} \times 100\right), & |\text{Issued Invoices}| > 0 \\ 0, & \text{otherwise} \end{cases}$$
- **Revenue Collection Rate (%):**
  $$\text{Collection Rate} = \begin{cases} \text{roundToTwoDecimals}\left(\frac{\text{Collected Revenue}}{\text{Total Billed}} \times 100\right), & \text{Total Billed} > 0 \\ 0, & \text{otherwise} \end{cases}$$

---

## 4. Reporting Period Boundaries

All periods are evaluated based on the business's local date calendar:
- **Today (`TODAY`):** `00:00:00.000` to `23:59:59.999` of current day.
- **This Week (`THIS_WEEK`):** Monday `00:00:00.000` to Sunday `23:59:59.999`.
- **This Month (`THIS_MONTH`):** 1st day `00:00:00.000` to last day `23:59:59.999`.
- **This Financial Year (`THIS_FY`):** April 1 `00:00:00.000` to March 31 `23:59:59.999` (Indian Fiscal Year).
- **All Time (`ALL`):** Unbounded across all historical records.

---

## 5. Failure and Data Corruption Safeguards

1. If an invoice record has a missing or malformed `netPayable`, it is coerced safely via `Math.max(0, Number(inv.netPayable) || 0)`.
2. Empty datasets (`invoices = []`) return clean zeros (`0`) for all financial totals and rates without throwing `NaN` or `Infinity`.
3. Non-numeric or negative inputs in line items are sanitized prior to aggregation using `normalizeInvoiceItem`.

