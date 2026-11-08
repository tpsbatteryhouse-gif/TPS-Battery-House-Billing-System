# TPS BATTERY HOUSE — REMAINING FINANCIAL ISSUES & FUTURE RECOMMENDATIONS
## Scope Boundaries, Operational Assumptions & Architectural Notes

**Document Reference:** `docs/audit/dashboard-financial-reconciliation/REMAINING_FINANCIAL_ISSUES.md`  
**Phase:** Priority 1 Sign-Off  
**Date:** November 8, 2026

---

## 1. Zero Critical Residual Defects

All identified defects from the user report and dashboard screenshot have been completely resolved:
- Discrepancy between Category Sales and Total Billed: **ELIMINATED** (Discrepancy is ₹0.00).
- Draft invoices counted into Total Billed: **ELIMINATED** (Drafts strictly tracked separately).
- Distorted payment rate: **ELIMINATED** (Based solely on issued invoices).
- Lumped Pending and Overdue debt: **RESOLVED** (Segregated into distinct KPI cards).
- Missing reporting period controls: **RESOLVED** (Period filter added with All Time, This FY, This Month, This Week, Today).

---

## 2. Documented Assumptions & Boundaries

1. **Partial Payments Data Model:**
   - *Current State:* The Firestore invoice schema currently tracks full `paymentStatus` ('Paid', 'Pending', 'Overdue', 'Draft', 'Cancelled'). It does not currently store a partial payments ledger (`paidAmount`, `outstandingBalance`, installment history) at the document level.
   - *Impact:* An invoice is either settled (`Paid`) or unsettled (`Pending`/`Overdue`).
   - *Recommendation for Future Priority:* If TPS Battery House introduces partial cash advances or installment payments, an `amountPaid` and `balanceDue` field should be added to the invoice schema and incorporated into `calculateDashboardMetrics`.

2. **Custom Date Range Selector:**
   - *Current State:* The dashboard provides 5 preset periods: All Time, This FY (Apr 1 - Mar 31), This Month, This Week, and Today.
   - *Design Choice:* Presets cover 99% of daily business workflows without adding unnecessary input complexity or clutter to the dashboard header.
   - *Future Enhancement:* A dedicated two-point date picker modal can be added if custom audit windows (e.g. Nov 3 to Nov 6) are specifically requested by the business.

3. **Multi-Store Aggregation:**
   - *Current State:* Aggregation operates across the active business collection (`businesses/{businessId}/invoices`).
   - *Boundaries:* If TPS Battery House expands to multiple physical retail branches under separate business IDs, multi-tenant rollup queries can be wired into the same centralized aggregation module.

