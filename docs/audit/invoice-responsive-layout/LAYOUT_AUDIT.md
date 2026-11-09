# TPS BATTERY HOUSE — INVOICE SCREEN LAYOUT & OVERFLOW AUDIT
## Layout Defect Identification, Visual Root Cause Analysis & UI Hierarchy

**Audit Date:** November 9, 2026  
**Auditor:** Senior UI/UX Engineer & React Frontend Architect  
**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Workspace:** `/home/navaneeth/Documents/Amal`  
**Primary Screen:** Tax Bill Generator / New Tax Invoice Screen (`activeView === 'editor'`)

---

## 1. Executive Summary & Defect Scope

Visual analysis of user-provided screenshots (`media_1794187681571_661a52d7.jpg` and `media_1794185468038_dc7b4fdf.jpg`) revealed severe layout cramping, overlapping typography, and clipped text in the New Tax Invoice interface:

1. **Date Truncation in Metadata Card:** The `Invoice Date *` field displays `10/29/202`, clipping the final year digit (`6`).
2. **Horizontal Collision in Due Date Field:** The `Payment Due Date` label and the three quick-term pill buttons (`Immediate`, `15 Days`, `30 Days`) collided directly, rendering the label unreadable.
3. **Clipped Select Dropdown:** The `Reverse Charge Applicable` selector truncated the default text to `No (Standar...`.
4. **Cramped Optional Reference Fields:** `Buyer PO / Work Order No (Optional)`, `E-Way Bill Number (Optional)`, and `IRN / E-Invoice Hash (Optional)` labels were forced into narrow vertical wrappings over squeezed 100px text inputs.
5. **Vertical Grid Asymmetry:** The top container split Customer Details (`lg:col-span-2`) and Metadata (`lg:col-span-1`) across a 3-column grid, failing to align with the bottom 12-column grid (`lg:col-span-7` Deductions/Terms and `lg:col-span-5` Summary).
6. **Desktop Table Column Squashing:** The Line Items table lacked a minimum width barrier, causing item descriptions and numeric fields to squeeze on 1024px–1280px viewports.

---

## 2. Root Cause Analysis

### 2.1 The 3-Column Squeeze in `InvoiceForm.jsx`
In `src/components/InvoiceForm.jsx` (lines 232–253):
```jsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
  <div className="lg:col-span-2">
    <CustomerDetailsSection ... />
  </div>
  <div className="lg:col-span-1">
    <InvoiceMetadataSection ... />
  </div>
</div>
```
- In a standard desktop viewport (1024px–1280px), after taking into account sidebar/page padding and gutters, the total width of the form container is roughly 980px–1160px.
- `lg:col-span-1` allocated exactly **one-third** of the grid (~320px–380px) to `InvoiceMetadataSection`.

### 2.2 The Nested 3-Column Disaster in `InvoiceMetadataSection.jsx`
Inside `InvoiceMetadataSection.jsx`:
```jsx
<div className="grid grid-cols-12 gap-3 sm:gap-4 text-xs">
  {/* Invoice Date */}
  <div className="col-span-12 sm:col-span-6 lg:col-span-4 space-y-1">
    ...
```
- The component was written with `lg:col-span-4` (meaning 4/12 = 1/3 of the parent container).
- Because its parent was already restricted to 1/3 of the page, the component attempted to render **three columns inside a 320px card**:
  $$\text{Effective Column Width} = \frac{320\text{px} - \text{gutters}}{3} \approx 95\text{px} - 105\text{px}$$
- Standard HTML `<input type="date">` requires an intrinsic width of **130px–140px** to render `MM/DD/YYYY` plus the calendar picker icon. Inside a 100px cell, the native date picker truncated the text to `10/29/202`.

### 2.3 The Unwrapped Flex Collision in Due Date
In `InvoiceMetadataSection.jsx`:
```jsx
<div className="flex justify-between items-center">
  <label ...>Payment Due Date</label>
  <div className="flex items-center gap-1">
    <button>Immediate</button>
    <button>15 Days</button>
    <button>30 Days</button>
  </div>
</div>
```
- Label width: ~110px.
- Chips width: ~135px.
- Total required width: ~245px.
- In a 100px column, the flexbox forced text collision and severe label overlap.

### 2.4 Lack of Horizontal Bounds on Desktop Table
In `src/components/invoice/InvoiceItemsSection.jsx`:
- The desktop `<table>` had no `min-w-[...]` constraint.
- When rendered on viewports between 1024px and 1280px, the 12 columns squeezed against each other, truncating item description text inputs.

---

## 3. Component Layout Audit Findings

| Component | Defect Observed | Architectural Fix |
| :--- | :--- | :--- |
| `InvoiceForm.jsx` | Top grid 3-col split mismatched with bottom 12-col grid | Upgraded top grid to `lg:grid-cols-12` (`lg:col-span-7` Customer, `lg:col-span-5` Metadata) |
| `InvoiceMetadataSection.jsx` | 3 nested columns inside 320px card; date clipped; chips colliding | Converted internal grid to 2-column `grid-cols-1 sm:grid-cols-2`; added `flex-wrap`, `min-w-0`, and `shrink-0` |
| `CustomerDetailsSection.jsx` | Input blowouts on extreme viewports; tight label spacing | Added `min-w-0` to all inputs, `space-y-1.5`, and `flex-wrap` on header and GSTIN status pill |
| `InvoiceItemsSection.jsx` | Table compressed on 1024px displays | Enforced `min-w-[1060px]` with smooth `overflow-x-auto` wrapper |
| `InvoiceItemRow.jsx` | Currency amounts wrapping onto two lines | Applied `whitespace-nowrap` on monetary values; minimum column widths (`min-w-[260px]` for description) |
| `InvoiceSummary.jsx` | Hero metric wrap risk; long amount in words overflow | Added `whitespace-nowrap` to monetary totals, `break-words` on `amountInWords` |
| `InvoiceTermsSection.jsx` | Textareas could expand horizontally into adjacent columns | Added `min-w-0` and `resize-y` |

