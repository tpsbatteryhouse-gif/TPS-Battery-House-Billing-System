# TPS BATTERY HOUSE — DASHBOARD CHANGELOG
## Modifications, Additions & Architectural Updates

**Document Reference:** `docs/audit/dashboard-financial-reconciliation/DASHBOARD_CHANGELOG.md`  
**Phase:** Priority 1: Financial Dashboard Hierarchy, KPI Accuracy & Reconciliation  
**Date:** November 8, 2026

---

## 1. Summary of Changes

| File | Type | Description |
|---|---|---|
| `src/utils/dashboardFinancialMetrics.js` | **NEW** | Centralized financial aggregation engine with proportional deduction allocation, lifecycle segregation, date boundary calculations, and 100% reconciliation invariant. |
| `src/components/Dashboard.jsx` | **REFACTOR** | Integrated centralized metrics, added reporting period selector (All Time, FY 2026-27, This Month, This Week, Today), redesigned 4-card KPI hierarchy with distinct Overdue Debt, added Reconciliation status badge and transparent deductions bridge. |
| `src/data/mockData.js` | **UPDATE** | Added `CANCELLED: 'Cancelled'` to `INVOICE_STATUSES` to ensure full alignment with `firestore.rules` and `invoiceService.js`. |
| `scratch/test_dashboard_financial_metrics.mjs` | **NEW** | 69 automated unit and property-based assertions verifying lifecycle exclusions, proportional allocation, residual paise handling, and reporting periods. |
| `scratch/run_all_suites.js` | **UPDATE** | Added `test_dashboard_financial_metrics.mjs` to the continuous regression test runner (totaling 26 suites and 1094 assertions). |
| `docs/audit/dashboard-financial-reconciliation/` | **NEW** | 7 comprehensive audit deliverables documenting root causes, formulas, UX review, test evidence, changelog, and residual considerations. |

---

## 2. Detailed Code Modifications

### `src/utils/dashboardFinancialMetrics.js`
- Exported `DASHBOARD_PERIODS` and `PERIOD_LABELS`.
- Implemented `getIndianFinancialYear(date)` for fiscal year rollover (Apr 1 - Mar 31).
- Implemented `getPeriodDateBoundaries(period, referenceDate)` returning exact start and end day timestamps (`00:00:00.000` to `23:59:59.999`).
- Implemented `isInvoiceInDateRange(invoice, start, end)` supporting both ISO strings and `YYYY-MM-DD` date strings without timezone shifts.
- Implemented `normalizeInvoiceStatus(rawStatus)` mapping to `PAID`, `PENDING`, `OVERDUE`, `DRAFT`, `CANCELLED`.
- Implemented `calculateDashboardMetrics(invoices, options)` with proportional deduction allocation, zero-division guards, and residual paise assignment.

### `src/components/Dashboard.jsx`
- Replaced manual `invoices.forEach` loop with `useMemo(() => calculateDashboardMetrics(invoices, { period: selectedPeriod }), [invoices, selectedPeriod])`.
- Added lazy-initialized state `currentFyLabel` to satisfy React Compiler purity standards.
- Replaced 4 previous KPI cards with:
  1. Total Invoices (Issued count prominent; interactive draft filter).
  2. Collected Revenue (Settled ₹ prominent; collection rate).
  3. Outstanding Balance (Pending ₹ within terms).
  4. Overdue Debt (Past terms ₹ with follow-up badge).
- Added total uncollected debt summary bar.
- Added reporting period selector chip bar.
- Added Category Performance reconciliation status badge (`Reconciled (100% Balanced)`).
- Added Gross Subtotal vs Invoice Deductions vs Net Billed audit bridge.

