# TPS BATTERY HOUSE — INVOICE SCREEN REDESIGN
## 5. VISUAL COMPARISON SPECIFICATION

**Project:** TPS Battery House — GST Billing & Invoice Management  
**Scope:** Side-by-Side Visual & Structural Comparison (Before vs. Redesigned)  
**Date:** November 9, 2026  
**Status:** COMPLETED & VERIFIED

---

### 1. Structural Comparison: Before vs. After

| Visual Dimension | Previous Invoice Screen | Redesigned Production Screen (Simple New Bill) |
| :--- | :--- | :--- |
| **Visual Language** | Dense, blue-tinted dark interface (`#0f172a`, `#1e293b`) with multiple nested borders. | Clean, matte dark interface (`#0F1216`, `#181C22`, `#12161B`) with warm off-white typography (`#F2EFE9`). |
| **Section Layout** | Unnumbered, fragmented cards scattered across stacked 7/5 grids. | Large, numbered circle steps (**1 — Who is buying?**, **2 — What are they buying?**, **3 — How is the customer paying?**). |
| **Customer Selection** | Small text inputs with dense labels and a small dropdown menu. | Touch-friendly B2C / B2B choice cards (`.inv-choice`) with search autocomplete and inline clear. |
| **Invoice Line Items** | Dense 12-column horizontal spreadsheet table requiring horizontal scroll. | Spacious card-based line item layout (`.inv-card`) with stepper buttons (`−` / `+`), price each, line total, and remove link. |
| **Item Quick-Add** | Cramped category bar with small icon buttons. | Friendly chip buttons (`+ Exide InvaMaster 150Ah · ₹14,800`) and clear "See all items" link. |
| **Deductions & Scrap** | Heavy dedicated panel with switches and dense explanatory text. | Lightweight toggles (`+ Give a discount`, `+ Customer is giving an old battery`) revealing inline inputs. |
| **Payment Selection** | Dropdown select box hidden inside financial calculation block. | Large "Paid now" vs "Pay later" choice cards and payment mode pills (`Cash`, `UPI`, `Card`, `Bank transfer`). |
| **Calculations & Totals** | Buried table inside a bottom right card. | Pinned desktop sticky sidebar (`aside aria-label="Bill total"`) with customer summary, breakdown, and huge hero payable box. |
| **Primary Actions** | Fixed bottom toolbar at bottom of window. | Prominent 60px amber "Save & Print Bill" button inside the sidebar, plus WhatsApp pill and draft link. |
| **Technical Settings** | Visible to all users on every bill, cluttering the view. | Grouped into a neat collapsible drawer: "Extra details (not needed for most bills)". |

---

### 2. Form Section Visual Evolution

````carousel
```markdown
### 1. Customer Particulars (Step 1)
- Previous: Squeezed text fields with small labels and confusing PAN/GSTIN requirements for retail walk-ins.
- Redesigned:
  - Step 1 Amber Circle.
  - Two prominent choice cards: "Regular customer (B2C)" vs "Business customer (B2B)".
  - Search autocomplete: "Regular customer? Find them".
  - Name and Phone number side-by-side.
  - Business GST number appears ONLY when B2B is active.
```
<!-- slide -->
```markdown
### 2. Product Items (Step 2)
- Previous: 12-column spreadsheet table requiring mouse scrolling to see totals and tax rates.
- Redesigned:
  - Step 2 Amber Circle.
  - Each item is a comfortable, spacious card (#12161B).
  - Prominent quantity stepper with 44px minus and plus buttons.
  - "Price each ₹" input with automatic line total computation.
  - Fast-add catalog preset chips.
  - Deductions toggled on-demand without visual clutter.
```
<!-- slide -->
```markdown
### 3. Payment & Totals (Step 3 & Sidebar)
- Previous: Action buttons pinned to the browser viewport footer; totals split from actions.
- Redesigned:
  - Step 3 Amber Circle with "Paid now" vs "Pay later".
  - Mode pills for Cash, UPI, Card, Bank transfer with QR hint.
  - Pinned sticky sidebar on desktop:
    - Customer overview and item count.
    - Gross, discount, scrap, taxable, GST breakdown, and round-off.
    - Amber hero box: "Customer pays ₹26,000.00" in 42px bold font.
    - 60px primary action: "Save & Print Bill".
```
````

