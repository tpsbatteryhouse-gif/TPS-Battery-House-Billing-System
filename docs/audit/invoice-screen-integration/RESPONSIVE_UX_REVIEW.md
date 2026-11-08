# Deliverable 5: Responsive UI/UX & Cross-Platform Review

**Document Version:** 1.0.0  
**Phase:** New Tax Invoice Screen — Google Stitch Design Integration  
**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** November 2026  

---

## 1. Responsive Viewport Strategy

The new Tax Invoice screen was tested across mobile, tablet, and ultra-wide desktop viewports:

| Viewport Breakpoint | Target Device | Layout Strategy |
| :--- | :--- | :--- |
| **`< 768px` (Mobile)** | Smart Phones (iOS / Android) | Stacked single-column card layout. Item rows convert into vertical cards with full touch tap-targets. Sticky bottom action bar collapses auxiliary labels. |
| **`768px - 1024px` (Tablet)** | iPad / Android Tablets | 2-column metadata and customer sections. Sticky action bar displays icons and essential metrics. |
| **`1024px - 1536px` (Desktop)** | Standard Laptops & Monitors | Full high-density financial table with tabular alignment. 2-column bottom layout (Deductions/Terms on Left, Summary Card on Right). |
| **`> 1536px` (Wide Desktop)** | 2K / 4K Workstations | Max-w-7xl centered container maintaining comfortable line length and optimal scanning ergonomics. |

---

## 2. Touch Friendliness & Mobile Card Transformation

In traditional desktop billing interfaces, 10-column tables cause horizontal scrolling and broken input layouts on mobile phones.
`InvoiceItemRow.jsx` implements an adaptive dual-template design:
- **Desktop (`hidden md:table-row`):** Standard table row with precise column alignments (`w-40`, `w-20`, `w-28`, etc.).
- **Mobile (`md:hidden`):** Distinct bordered cards featuring:
  - Top category badge and quick delete trash icon.
  - Large full-width item description input.
  - Grid of secondary fields (HSN, Warranty, Qty, Unit, Price).
  - Mode toggle and GST % selector pills.
  - Highlighted computed taxable and line total summary bar.

---

## 3. High-Contrast Dark Theme Accessibility

- Surfaces: `bg-slate-950` and `bg-slate-900/60` provide deep contrast against high-visibility text (`text-slate-100` / `text-slate-300`).
- Accent Badges: Industrial amber (`text-amber-400 bg-amber-500/10 border-amber-500/20`), Sky (`text-sky-400`), Emerald (`text-emerald-400`), Purple (`text-purple-400`).
- Focus States: All interactive inputs feature `focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none`.
- Contrast Ratio: Exceeds WCAG 2.1 AA standards (minimum 4.5:1 for normal text, 7:1 for bold headers).

