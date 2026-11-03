# Quality Assurance & Testing Suite — TPS BATTERYS HOUSE

This document records the verification procedures, automated test suites, multi-category scenario test matrices, build validations, and responsive viewport evaluations performed on the application.

---

## 1. Automated Build & Static Analysis Validation

### A. Static Code Analysis (Oxlint)
- **Command:** `npm run lint`
- **Tool:** Oxlint
- **Result:** **Passed** (0 warnings, 0 errors across all 25 files).

```text
> amal@0.0.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 57ms on 25 files with 104 rules using 8 threads.
```

### B. Production Bundle Compilation (Vite)
- **Command:** `npm run build`
- **Tool:** Vite v8.3.5
- **Result:** **Passed** (Built in 972ms with zero compilation errors).

### C. Save Data Integrity & A4 Layout Regression Suite
- **Command:** `node scratch/test_save_integrity_suite.js`
- **Result:** **64 Passed, 0 Failed.**
- **Coverage:** Tests A through J (save without change, repeated save idempotency, inclusive/exclusive pricing preservation, item and invoice discount deductions, scrap deductions, decimal values, 0% GST rate preservation, B2B/B2C transaction type persistence, historical invoice backward compatibility, and A4 PDF bottom positioning).

### D. Multi-Category Automated Test Suite
- **Command:** `node scratch/test_multi_category_suite.js`
- **Result:** **41 Passed, 0 Failed.**

### E. Traditional Template Layout Suite
- **Command:** `node scratch/test_traditional_invoice_suite.js`
- **Result:** **25 Passed, 0 Failed.**

**Total Automated Test Assertions:** **130 Passed, 0 Failed.**

---

## 2. Multi-Category Test Matrix (Scenarios A through J)

| Test ID | Scenario | Test Configuration | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Test A** | **Battery-Only Invoice** | 2 different battery products (Exide IT500 + Amaron CR1500TT), 36M/48M warranty, ₹2,200 scrap battery exchange, 28% GST. | Total gross ₹30,300, scrap deduction ₹2,200, net payable ₹28,100. Category sales Battery = ₹30,300. | All calculations exact; scrap deduction active; battery warranty preserved. | **Passed** |
| **Test B** | **Inverter-Only Invoice** | 1 Home Inverter (Luminous EcoVolt Neo 1050, 900VA / 756W, Pure Sine Wave, 24M warranty), 18% GST (HSN 8504). | Inverter sales = ₹6,800. Net payable = ₹6,800. HSN 8504 summary generated at 18%. | Technical capacity and waveform displayed; scrap deduction disabled by default. | **Passed** |
| **Test C** | **Solar-Only Invoice** | 2x Tata Power 550W Mono PERC Solar Panels (HSN 8541 @ 12%) + 1x Microtek Solar PCU 1435 (HSN 8504 @ 12%), total ₹35,900. | Solar sales = ₹35,900. Multi-item solar wattage and technology specs displayed. | Wp wattage ratings and solar technology render cleanly in preview and PDF. | **Passed** |
| **Test D** | **Mixed-Category Invoice** | 1x Battery (150Ah @ 28%) + 1x Inverter (900VA @ 18%) + 2x Solar Panels (550W @ 12%) + 1x Solar Installation Service (Job @ 18%). | All 4 items on one invoice. Total gross = ₹53,550. 4 distinct HSN/GST summary rows. Category sales sum equals total gross. | No double counting; each item maintains its own category, HSN, and GST rate. | **Passed** |
| **Test E** | **GST Verification** | Intra-state (State Code 32) vs Inter-state (State Code 33, Tamil Nadu), mixed tax rates (28%, 18%, 12%), auto rounding. | Intra-state: CGST+SGST split evenly. Inter-state: CGST=0, SGST=0, IGST=total tax. Summary totals match invoice gross. | Statutory rules strictly verified; rounding matches nearest rupee. | **Passed** |
| **Test F** | **Product Catalog CRUD** | Add product ('Adani 540W Bifacial Panel'), Edit product, Search by brand/rating, Delete with confirmation, 1-click 'Add to Bill'. | Full CRUD operations working; catalog stored in `localStorage` under `tps_product_catalog`. | Catalog filters by category/brand; 'Add to Bill' appends item into active invoice. | **Passed** |
| **Test G** | **Backward Compatibility** | Open historical battery invoices lacking the `category` field in `tps_invoice_records`. | `normalizeInvoiceItem` safely interprets item as 'battery' category without crashing or modifying historical values. | Legacy invoices open, calculate, edit, and export without data loss. | **Passed** |
| **Test H** | **PDF Export Generation** | Generate vector PDF for Battery-only, Inverter-only, Solar-only, and Mixed-category invoices. | High-resolution vector A4 PDF generated under 85 KB; selectable text; embedded UPI QR code. | Crisp vector lines; category specifications rendered cleanly in line items table. | **Passed** |
| **Test I** | **Persistence Verification** | Create new products and invoices, reload browser window (`F5`), verify persistence. | Records remain available across reloads via `tps_invoice_records` and `tps_product_catalog`. | Local storage maintains integrity across sessions. | **Passed** |
| **Test J** | **Responsive UI Across Viewports** | Test on 320px, 375px, 430px, 768px, 1024px, 1440px. | No horizontal overflow; product forms wrap gracefully; mobile card views render cleanly. | Forms, tables, catalog, and dashboard adapt seamlessly. | **Passed** |

---

## 3. Save Data Integrity & Layout Test Matrix (`test_save_integrity_suite.js`)

| Test Case | Objective | Input / Conditions | Expected Behavior | Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Test A: Save Without Changes** | Ensure saving an existing invoice without edits does not mutate any fields. | Load existing invoice `TPS/2026-27/007`, execute save handler without modifications. | Exact match across invoice number, transaction type, customer, items, tax values, net payable. | All 19 checked fields identical; 0 mutations. | **Passed** |
| **Test B: Repeated Save Idempotency** | Prevent duplicate invoices and amount drift across repeated save cycles. | Create invoice, save to storage, reopen, save 3 consecutive times. | Single record maintained in `localStorage`, net payable and line rates remain constant. | Exactly 1 record in storage; amounts 100% stable. | **Passed** |
| **Test C: MRP-Inclusive Pricing** | Prevent double-deduction of GST on tax-inclusive products across saves. | MRP item `₹15,500` @ 28% GST (`isTaxInclusive: true`). | Taxable value extracted to `₹12,109.38`; raw rate preserved as `15500`; line total stays `15500`. | GST deducted exactly once; rate never mutated. | **Passed** |
| **Test D: Exclusive Pricing Stability** | Prevent rate drift on tax-exclusive items. | Exclusive rate `₹10,000` @ 18% GST (`isTaxInclusive: false`). | Taxable value `₹10,000`, GST `₹1,800`, line total `₹11,800`. | Exact rate and taxable amounts preserved. | **Passed** |
| **Test E: Deductions & Exchange** | Prevent double-subtraction of scrap exchange and special discounts. | Gross `₹25,000`, scrap allowance `₹2,500`, special discount `₹500`. | Net payable `₹22,000`. Reopening does not subtract deductions again. | Net payable strictly `₹22,000` across all save cycles. | **Passed** |
| **Test F: Decimal Precision** | Verify floating-point price and decimal quantity preservation. | Unit rate `₹1,234.56`, quantity `1.5 kW`, discount `₹149.95`. | Decimal quantity parsed as `1.5` without integer truncation; rate kept as `1234.56`. | Quantities and currency cents preserved with full precision. | **Passed** |
| **Test G: B2B Invoice Persistence** | Verify B2B transaction type and GSTIN format validation. | Transaction type `B2B`, Buyer GSTIN `32AABCT1332L1ZV`. | `transactionType: 'B2B'` stored, GSTIN validated, ITC title rendered. | B2B persisted cleanly; title `TAX INVOICE (B2B)`. | **Passed** |
| **Test H: B2C Invoice Persistence** | Verify B2C retail flow without GSTIN requirement. | Transaction type `B2C`, consumer phone and address, empty GSTIN. | `transactionType: 'B2C'`, no false validation error, GSTIN omitted. | B2C persisted cleanly; title `RETAIL TAX INVOICE (B2C)`. | **Passed** |
| **Test I: Historical Invoice Compatibility** | Verify backward-compatible inference on legacy records. | Invoice lacking `transactionType` field. | `inferTransactionType` defaults safely to `B2B` if buyer GSTIN present, else `B2C`. Original record not mutated. | Legacy record rendered cleanly without mutation. | **Passed** |
| **Test J: A4 PDF Bottom Positioning** | Verify exact A4 dimensions and dynamic bottom anchoring. | Export 2-item, 4-item, and 10-item invoices to jsPDF. | Width = 210mm, Height = 297mm. On 2-item invoice, Subtotal anchors at `202.5mm`, Footers at `284mm`. Multi-page pagination on 10 items. | Exact A4 dimensions; financial summary properly bottom-anchored. | **Passed** |

---

## 4. Responsive Viewport Verification Matrix

| Viewport Width | Device Category | Key Areas Verified | Observation | Result |
| :--- | :--- | :--- | :--- | :--- |
| **320px** | Ultra-compact phone (iPhone SE / older Android) | Header nav, summary cards, mobile invoice cards, catalog cards. | Single-column stacking; no horizontal overflow. | **Passed** |
| **375px** | Standard smartphone (iPhone 13/14/15) | Welcome section, search input, category filter pills, FAB. | 2 compact cards per row; category filter pills scroll smoothly without scrollbars. | **Passed** |
| **430px** | Large smartphone (iPhone Pro Max / Pixel XL) | Catalog add modal, quick create modal, line item cards. | Modals fit within viewport height with smooth internal scrolling. | **Passed** |
| **768px** | Tablet (iPad portrait) | 2x2 grid for summary cards, category sales distribution bars. | Spacing and touch-accessible buttons render cleanly. | **Passed** |
| **1024px** | Laptop / Tablet landscape | Dual-panel GST studio layout toggle. | Split view and responsive table columns render without clipping. | **Passed** |
| **1440px** | Desktop monitor | Full dashboard, wide tables, catalog grid, and A4 invoice preview sheet. | Centered A4 sheet preview with authentic paper drop-shadow. | **Passed** |
