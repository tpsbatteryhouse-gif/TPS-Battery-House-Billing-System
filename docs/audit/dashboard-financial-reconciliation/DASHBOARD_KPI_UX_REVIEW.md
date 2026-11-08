# TPS BATTERY HOUSE — DASHBOARD KPI UX REVIEW
## Information Hierarchy, Visual Balance, Interaction Design & Accessibility

**Document Reference:** `docs/audit/dashboard-financial-reconciliation/DASHBOARD_KPI_UX_REVIEW.md`  
**App Version:** Priority 1 Implementation  
**Auditor:** Senior UI/UX Designer & Frontend Architect

---

## 1. UX Review of Previous Dashboard

The previous dashboard suffered from critical UX and information architecture flaws:
1. **Lumped "Pending / Overdue" Card:** Grouping normal payment terms with delinquent debt obscured high-risk accounts. A business owner had no quick way of assessing immediate collection needs.
2. **Ambiguous Total Invoices:** Displayed count included draft invoices without clear segregation.
3. **Missing Period Control:** The dashboard calculated figures across all time, giving no way to evaluate current month or current financial year progress.
4. **Disconnected Category Sales:** Category sales figures did not add up to Total Billed, eroding trust in the financial calculations.

---

## 2. Redesigned Financial Hierarchy

The redesigned layout adheres to the strict TPS Battery House dark navy (`slate-950/900`) and warm amber (`amber-400/500`) design identity while establishing an authoritative 4-card hierarchy:

```
+---------------------------------------------------------------------------------------------------------+
| [Calendar] Reporting Period: FY 2026-27     [ All Time ] [ FY 2026-27 ] [ This Month ] [ This Week ] [ Today ] |
+---------------------------------------------------------------------------------------------------------+

+--------------------+  +--------------------+  +--------------------+  +--------------------+
|   TOTAL INVOICES   |  | COLLECTED REVENUE  |  |    OUTSTANDING     |  |    OVERDUE DEBT    |
|       6 issued     |  |    ₹79,500.00      |  |    ₹32,000.00      |  |    ₹26,400.00      |
| [1 draft active >] |  | 3 paid • 57.6% col |  | 2 pending in terms |  | 1 past due date    |
+--------------------+  +--------------------+  +--------------------+  +--------------------+

+---------------------------------------------------------------------------------------------------------+
| [•] Total Uncollected Debt: ₹58,400.00 (3 invoices)   |   Authoritative Billed: ₹1,37,900.00   |   50% Settled   |
+---------------------------------------------------------------------------------------------------------+
```

### Card 1 — Total Invoices (Blue)
- Primary metric: Issued invoice count (`6 issued`).
- Secondary element: Interactive draft pill button (`1 draft in progress`). Clicking filters the invoice list directly to Draft status.
- Card click: Resets status filter to `All`.

### Card 2 — Collected Revenue (Emerald)
- Primary metric: Cash collected (`₹79,500.00`).
- Secondary element: Settled count and collection percentage (`3 settled • 57.6% collected`).
- Card click: Filters invoice list directly to `Paid`.

### Card 3 — Outstanding Balance (Amber)
- Primary metric: Uncollected balance within terms (`₹32,000.00`).
- Secondary element: Number of pending invoices within terms (`2 pending within terms`).
- Card click: Filters invoice list directly to `Pending`.

### Card 4 — Overdue Debt (Rose)
- Primary metric: Critical delinquent debt (`₹26,400.00`).
- Secondary element: Count of overdue invoices with a prominent "Follow-up" pill (`1 past due date`).
- Card click: Filters invoice list directly to `Overdue`.

---

## 3. Responsive Quality

- **Desktop (>= 1024px):** 4-column balanced grid with generous padding and tabular numerals (`font-mono`).
- **Tablet (640px – 1023px):** 2x2 grid maintaining equal card heights and clean truncation.
- **Mobile (< 640px):** 2-column compact grid, stacked period filter with smooth horizontal scrolling for period chips.

---

## 4. Accessibility (a11y) & Usability

1. **Semantic Structure:**
   - `<section aria-label="Authoritative Financial KPI Hierarchy">`
   - `<section aria-label="Reporting Period Filter">`
   - Role attributes on period selector: `role="radiogroup"` and `role="radio"` with `aria-checked`.
2. **Color Contrast:**
   - Text colors (`text-white`, `text-slate-200`, `text-amber-400`, `text-emerald-400`, `text-rose-400`) achieve `>= 4.5:1` contrast against dark slate backgrounds.
   - Information is never conveyed through color alone: textual labels (`issued`, `settled`, `pending within terms`, `past due date`) accompany every metric.
3. **Tabular Numerals:**
   - All financial figures utilize `font-mono` to prevent layout jitter when numbers change or filter between periods.

