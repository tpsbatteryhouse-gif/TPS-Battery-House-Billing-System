# PRINT CSS & PAGED MEDIA AUDIT

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Stylesheet:** `src/index.css` (`@media print`)  

---

## 1. Paged Media Configuration

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 8mm 8mm 8mm 8mm;
  }
```
- **Page Size:** Explicitly declared `A4 portrait` (210mm × 297mm).
- **Physical Margins:** Fixed at `8mm` symmetrically on all sides to comply with commercial laser and thermal printer unprintable margin boundaries.

---

## 2. Color & Dark Theme Invalidation

### Previous Defect:
Tailwind classes like `bg-slate-950` applied `#020617` on `<div className="min-h-screen bg-slate-950 ...">`. In print mode, browsers honored the dark container background, resulting in a black canvas.

### Remediation:
```css
  html, body, #root, #root > div, .min-h-screen {
    background: #ffffff !important;
    background-color: #ffffff !important;
    color: #000000 !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: auto !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
```
- Forces every potential parent container (`html`, `body`, `#root`, `.min-h-screen`) to `#ffffff` background with `!important` priority.
- Enforces `color: #000000 !important` to ensure text ink is black and high-contrast.
- Overrides `min-h-screen` so that extra blank space is not artificially generated.

---

## 3. Visibility Toggling (`.no-print` vs `.print-only`)

```css
  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }
```

- **Hidden from Print:**
  - `<Header>` navigation bar.
  - `<InvoiceForm>` interactive form inputs, sliders, and picker modals.
  - `<InvoiceActionBar>` fixed action toolbar.
  - `<FloatingActionButton>` button.
  - UI toast banners, settings drawers, and profile modals.
- **Rendered Exclusively in Print:**
  - `<InvoicePreview>` mounted within `<div className="hidden print:block print:w-full print:m-0 print:p-0 print-only">`.

---

## 4. Container Layout & Page Break Integrity

```css
  #invoice-printable {
    box-shadow: none !important;
    margin: 0 auto !important;
    padding: 0 !important;
    border: none !important;
    width: 100% !important;
    max-width: 100% !important;
    background: #ffffff !important;
    page-break-inside: avoid;
  }
```
- Ensures natural flow and eliminates viewport constraints.
- Prevents awkward mid-box page splits using `page-break-inside: avoid`.

