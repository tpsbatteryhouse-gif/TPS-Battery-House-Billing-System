# TPS BATTERY HOUSE — FINANCIAL DASHBOARD AUDIT REPORT
## Priority 1: Financial Dashboard Hierarchy, KPI Accuracy & Reconciliation

**Document Reference:** `docs/audit/dashboard-financial-reconciliation/DASHBOARD_FINANCIAL_AUDIT.md`  
**Date:** November 8, 2026  
**Auditor:** Senior Financial Product Engineer & Application Architect  
**Status:** COMPLETE  
**Verdict:** **PASS**

---

## 1. Executive Summary

This audit was initiated to investigate, reconcile, and resolve financial metric discrepancies observed on the primary management dashboard of TPS Battery House.

### The Initial Discrepancy (As observed in screenshot):
- **Total Billed displayed:** ₹1,63,900.00
- **Category Sales breakdown displayed:**
  - Battery Sales: ₹26,400.00 (16%)
  - Inverter Sales: ₹1,17,500.00 (70%)
  - Solar Sales: ₹4,500.00 (3%)
  - Service Revenue: ₹18,400.00 (11%)
  - **Sum of Category Sales:** ₹1,66,800.00
- **Observed Discrepancy:** ₹2,900.00 difference between Total Billed and Category Sales.

Additionally, critical financial hierarchy issues were identified:
1. **Draft Invoices Polluting Sales Totals:** Draft invoices (specifically invoice `TPS/2026-27/007` for ₹26,000.00) were being added directly into `Total Billed`, distorting revenue metrics.
2. **Payment Rate Distortion:** Payment rate was calculated as `paidCount / totalInvoices` (3 / 7 = 43%), treating uncommitted draft invoices as defaulted or uncollected debt.
3. **Pending and Overdue Lumping:** Pending invoices (within payment terms) and Overdue debts (past due terms) were merged into a single card ("Pending / Overdue"), obscuring critical credit risk.

---

## 2. Root Cause Analysis

A line-by-line inspection of `src/components/Dashboard.jsx` (lines 45–115) revealed two independent root causes:

### Root Cause A: Omission of Invoice-Level Deductions from Category Sales
In the previous implementation:
- `Total Billed` summed `Number(inv.netPayable) || 0`.
- Category Sales calculated line items as `qty * rate` (tax-inclusive) or `qty * rate * (1 + gstRate/100)`.
- Invoice-level deductions (`scrapExchange.amount`, `additionalDiscount`, and `roundOffManual`) were applied only at the invoice footer to compute `netPayable`, but were **never allocated back across line items or categories**.
- In the initial dataset, invoice deductions totaled exactly **₹2,900.00**:
  - `TPS/2026-27/001`: Scrap Battery Buyback deduction = ₹2,000.00
  - `TPS/2026-27/002`: Additional Special Discount = ₹400.00
  - `TPS/2026-27/007`: Additional Discount = ₹500.00
  - **Total Deductions = ₹2,000 + ₹400 + ₹500 = ₹2,900.00**.
- Consequently, gross line-item sales exceeded net billed revenue by exactly ₹2,900.00.

### Root Cause B: Inclusion of Draft Invoices in Authoritative Totals
- The aggregation loop iterated over all records in `invoices` without filtering `inv.paymentStatus === 'Draft'`.
- Invoice `TPS/2026-27/007` (Net ₹26,000.00) was in `Draft` state.
- Issued billed revenue was actually **₹1,37,900.00**, but was inflated to **₹1,63,900.00** by counting unissued draft state.

---

## 3. Implemented Corrections

1. **Centralized Financial Metrics Aggregation Engine (`src/utils/dashboardFinancialMetrics.js`):**
   - Implemented a pure, deterministic aggregation engine adopting the Phase 5.3 financial precision standard (`roundToTwoDecimals`).
   - Implemented strict lifecycle segregation: `Issued` (Paid, Pending, Overdue) vs `Draft` vs `Cancelled`.
   - Proportional allocation of invoice-level deductions (Scrap buybacks, discounts, round-off) across item categories, guaranteeing that `Sum of Category Net Sales === Total Billed` (100% Balanced Reconciliation Invariant).
   - Residual paise caused by division are deterministically assigned to the category with the largest gross share on that invoice.

2. **Refactored KPI Hierarchy (`src/components/Dashboard.jsx`):**
   - **Card 1 — Total Invoices:** Prominently displays issued count (6). Secondary clickable filter indicates draft count (`1 draft in progress`).
   - **Card 2 — Collected Revenue:** Displays actual settled cash from paid invoices (`₹79,500.00`), showing collection rate (`57.6%`).
   - **Card 3 — Outstanding Balance:** Displays pending balance within terms (`₹32,000.00`, 2 invoices).
   - **Card 4 — Overdue Debt:** Dedicated debt risk card displaying overdue balance (`₹26,400.00`, 1 invoice) with immediate follow-up status.
   - **Debt Summary Callout:** Directly links total uncollected balance (`₹58,400.00`) to authoritative billed revenue (`₹1,37,900.00`).

3. **Reporting Period Selector:**
   - Added period filters: **All Time**, **FY 2026-27** (Indian Fiscal Year Apr 1–Mar 31), **This Month**, **This Week**, and **Today**.
   - Full timezone safety and midnight boundary preservation.

4. **Category Performance Reconciliation Banner:**
   - Visual reconciliation pill displaying `Reconciled (100% Balanced)` when invariant holds, or immediate discrepancy warning if mismatch occurs.
   - Transparent bridge disclosing Gross Item Subtotal, Invoice Deductions, and Net Authoritative Billed.

---

## 4. Reconciliation Table

| Metric | Previous Broken State | Corrected Authoritative State | Accounting Basis |
|---|---|---|---|
| **Total Invoices** | 7 (mixed) | **6 issued** (1 draft tracked) | Authoritative issued count |
| **Total Billed** | ₹1,63,900.00 | **₹1,37,900.00** | Net Payable of Issued Invoices |
| **Collected Revenue** | ₹79,500.00 | **₹79,500.00** | Net Payable of Paid Invoices |
| **Pending Balance** | ₹58,400.00 (lumped) | **₹32,000.00** | Net Payable of Pending (within terms) |
| **Overdue Debt** | Included in Pending | **₹26,400.00** | Net Payable of Overdue (past terms) |
| **Total Outstanding** | Not segregated | **₹58,400.00** | Pending (32k) + Overdue (26.4k) |
| **Battery Sales (Net)** | ₹26,400.00 | **₹26,400.00 (19%)** | Reconciled Category Sales |
| **Inverter Sales (Net)** | ₹1,17,500.00 | **₹93,100.00 (68%)** | Reconciled Category Sales |
| **Solar Sales (Net)** | ₹4,500.00 | **₹0.00 (0%)** | Draft items correctly excluded |
| **Services (Net)** | ₹18,400.00 | **₹18,400.00 (13%)** | Reconciled Category Sales |
| **Category Sum** | ₹1,66,800.00 | **₹1,37,900.00** | Exact Match with Total Billed |
| **Discrepancy** | **₹2,900.00 (MISMATCH)** | **₹0.00 (BALANCED)** | **100% Reconciled Invariant** |

---

## 5. Verification Sign-Off

- **Automated Test Suite:** `scratch/test_dashboard_financial_metrics.mjs` (69/69 passed).
- **Full Regression Runner:** 1094/1094 assertions passed across 26 test suites.
- **Code Quality:** Oxlint passed with 0 warnings, 0 errors across 86 files.
- **Production Build:** Vite built clean in 1.44s with zero leakage.

