# Quality Assurance & Testing Suite — TPS BATTERYS HOUSE

This document records the verification procedures, automated build/lint commands, manual test suites, and responsive viewport evaluations performed on the application.

---

## 1. Automated Build & Linter Validation

### A. Static Code Analysis (Oxlint)
- **Command:** `npm run lint`
- **Tool:** Oxlint v1.89.0
- **Execution Date:** 2026-10-29
- **Result:** **Passed** (0 errors, 0 warnings across 22 files).

```text
> amal@0.0.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 25ms on 22 files with 104 rules using 8 threads.
```

### B. Production Bundle Build (Vite)
- **Command:** `npm run build`
- **Tool:** Vite v8.3.5
- **Execution Date:** 2026-10-29
- **Result:** **Passed** (Build completed in ~900ms, zero compilation errors).

```text
> amal@0.0.0 build
> vite build

vite v8.3.5 building client environment for production...
✓ 2200 modules transformed.
dist/index.html                      1.31 kB │ gzip:   0.73 kB
dist/assets/index-CpWjHX_C.css      35.33 kB │ gzip:   6.86 kB
dist/assets/purify.es-Dqk5qvad.js   29.02 kB │ gzip:  11.45 kB
dist/assets/index.es-DPomMP2c.js   151.37 kB │ gzip:  48.88 kB
dist/assets/index-BVLSNKFD.js      996.29 kB │ gzip: 286.67 kB
✓ built in 909ms
```

---

## 2. Manual Test Cases & Execution Matrix

| Test ID | Category | Test Scenario | Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-001** | Header | Live Digital Clock Verification | Open application and observe time in header. | Time displays with seconds and updates every 1000ms. | Time advances second-by-second synchronously with local device clock. | **Passed** |
| **TC-002** | Header | Simulated Profile Dropdown | Click user avatar (`AJ`) in header and select "My Profile". | Profile modal opens displaying `Alex Johnson`, Administrator, and mock notice. | Modal renders cleanly with mock disclaimer; Esc/Close closes cleanly. | **Passed** |
| **TC-003** | Dashboard | Summary Metrics Calculation | Compare dashboard cards with `INITIAL_MOCK_INVOICES`. | Total Invoices = 7, Paid = 3, Pending = 2, Total Revenue = ₹83,500.00. | All figures match mathematical sum of mock records. | **Passed** |
| **TC-004** | Search | Client Name Search | Type "Rajesh" in the search input. | Only invoice `TPS/2026-27/001` (Rajesh K.) is displayed in the list. | Exactly 1 matching invoice displayed; summary pill shows count 1. | **Passed** |
| **TC-005** | Search | Search Reset Button | Click the `X` icon in the active search field. | Search input clears; all invoices re-appear. | Full invoice list restored instantly. | **Passed** |
| **TC-006** | Filters | Status Filter Tabs | Click the "Paid" status filter tab. | Only invoices with status `Paid` are displayed. | Filtered to 3 paid invoices (`TPS/001`, `TPS/002`, `TPS/005`). | **Passed** |
| **TC-007** | Creation | Quick Create Invoice Modal | Click `+ New Invoice`, enter "Anil Varma", 2x Amaron Battery @ ₹15,500. | Total payable displays ₹31,000.00; saving adds invoice to dataset. | Saved successfully; Total Invoices count increments to 8; cards update. | **Passed** |
| **TC-008** | Creation | Negative Price / Qty Prevention | Enter `-5` in unit price or `0` in quantity in creation modal. | Validation message appears; submission blocked. | Blocked with clear error message; non-negative values enforced. | **Passed** |
| **TC-009** | Creation | Due Date Preceding Invoice Date | Set Due Date earlier than Invoice Date. | Form validation catches date sequence defect. | "Due date cannot be earlier than invoice date" displayed. | **Passed** |
| **TC-010** | Persistence| LocalStorage Empty Array Retention | Clear all invoices in storage (`[]`) and refresh page. | Empty dataset respected; does not re-seed mock data. | Empty state card displayed correctly without ghost data. | **Passed** |
| **TC-011** | GST Studio | Reverse Tax-Inclusive Calculation | In GST Studio, enter 1 item @ ₹22,000 (Inclusive, 28% GST). | Taxable Value = ₹17,187.50, CGST = ₹2,406.25, SGST = ₹2,406.25. | Calculations match exact statutory breakdown to two decimal places. | **Passed** |
| **TC-012** | Scrap Buyback| Battery Scrap Deduction | Enable scrap exchange with ₹2,000 allowance on ₹22,000 bill. | Net payable drops to ₹20,000.00; words display "Twenty Thousand Rupees Only". | Scrap allowance deducted accurately in both numbers and currency words. | **Passed** |
| **TC-013** | UPI QR | Dynamic NPCI URI Generation | Change payable amount and observe UPI QR canvas. | QR code encodes valid `upi://pay` URI with payee name and exact net amount. | Scannable QR matches standard banking format. | **Passed** |
| **TC-014** | Export | A4 PDF Generation | Click "Download PDF" on the active bill. | PDF generates and saves as `TPS_[InvNo]_[Customer].pdf`. | Crisp A4 document generated without cutting off table lines. | **Passed** |
| **TC-015** | Export | Print Dialog Trigger | Click "Print Bill". | Browser print window opens with A4 portrait styling. | Backgrounds forced on, navbar hidden, table bordered for print. | **Passed** |

---

## 3. Responsive Viewport Verification

| Viewport Width | Device Category | Key Areas Verified | Observation | Result |
| :--- | :--- | :--- | :--- | :--- |
| **320px** | Ultra-compact phone (iPhone SE / older Android) | Header, summary cards, and mobile invoice cards. | Single-column layout; cards stack without horizontal overflow. | **Passed** |
| **375px** | Standard smartphone (iPhone 13/14/15) | Welcome section, search input, status tabs, and FAB. | FAB positioned above safe-area inset; 2 compact summary cards per row. | **Passed** |
| **430px** | Large smartphone (iPhone Pro Max / Pixel XL) | Line items in quick create modal and dialog scrolling. | Modals scroll smoothly within viewport height. | **Passed** |
| **768px** | Tablet (iPad portrait) | 2x2 grid for summary cards, split table controls. | Clear spacing, touch-accessible row actions. | **Passed** |
| **1024px** | Laptop / Tablet landscape | Dual-panel GST studio layout toggle. | Split view and responsive table columns render without clipping. | **Passed** |
| **1440px** | Desktop monitor | Full dashboard, wide tables, and A4 invoice preview sheet. | Centered A4 sheet preview with authentic paper drop-shadow. | **Passed** |

---

## 4. PDF Generation & Optimization QA Test Matrix

Following the PDF system optimization and minimalist redesign, dedicated automated and manual tests were executed across all required operational scenarios:

| Test ID | Scenario | Line Items / Data Profile | Old Implementation (Raster) | Optimized Vector Engine | Page Count | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Test A** | **Standard Invoice** | 2 items (Fuze 1100 + Solar Panel), customer address, GST breakdown, Bank info, UPI QR, Declaration, Terms. | 11.14 MB (11,139,278 bytes) | **78.4 KB (80,231 bytes)** | 1 Page (was 2 pages with 95% blank space) | **Passed** |
| **Test B** | **Multiple Product Invoice** | 8 line items, different HSNs (`8507`, `8504`, `850790`, `9987`), different GST rates (28%, 18%), serial numbers, warranties. | > 12 MB (spilled over 3 pages) | **88.2 KB (90,291 bytes)** | 1 Page (compact & perfectly fitted) | **Passed** |
| **Test C** | **Scrap Exchange Invoice** | Battery purchase with ₹2,500 scrap battery trade-in deduction, ₹500 discount, round-off. | 10.7 MB | **78.7 KB (80,622 bytes)** | 1 Page (financials agree with engine) | **Passed** |
| **Test D** | **Large Customer Details** | M/s. Malabar Agro-Industrial Infrastructure & Logistics Development Corporation Ltd., multi-line address, GSTIN. | 11.2 MB | **78.6 KB (80,488 bytes)** | 1 Page (text wrapped without overlapping) | **Passed** |
| **Test E** | **QR Payment Scannability** | Dynamic UPI QR code (`upi://pay?pa=9846830532@okaxis...`) generated and embedded. | Blurry on zoom / huge uncompressed PNG | **Embedded 2.1 KB crisp PNG** | Scannable on mobile camera & UPI apps | **Passed** |
| **Test F** | **Print Quality & Grayscale** | Physical A4 paper print & grayscale preview testing. | Heavy dark black ink patches, solid card badges | Clean thin dividers (`#cbd5e1`), legible typography | **Passed** |
| **Test G** | **File Size Reduction Audit** | Comparison of identical sample invoice (`Green Valley Agro Farm`). | **11,139,278 bytes (10.62 MB)** | **80,231 bytes (78.4 KB)** | **99.28% File Size Reduction** | **Passed** |

### Verified PDF File Size Summary:
- **Sample Invoice File Size Before:** `11,139,278 bytes` (~11.1 MB)
- **Sample Invoice File Size After (Vector):** `80,231 bytes` (78.4 KB)
- **Sample Invoice File Size After (Canvas Fallback):** `324,510 bytes` (316.9 KB)
- **Net Percentage Reduction:** **99.28%**
- **Text Selectability:** 100% searchable, copyable, selectable text (`pdftotext` verified).
- **Pagination Bug Fix:** Eliminated accidental 2nd blank page; standard invoices fit strictly on 1 page; 14-item invoices paginate cleanly to 2 pages with repeated headers.

---

## 5. Next Recommended Automated Testing

While manual, linter, and PDF optimization validation is complete, the following automated testing infrastructure is recommended for Stage 4 of the roadmap:
1. **Unit Testing Framework:** Setup [Vitest](https://vitest.dev/) for unit testing `src/utils/gstCalculations.js` and `src/utils/numberToWords.js`.
2. **Component Testing:** Configure [@testing-library/react](https://testing-library.com/) for form validation and state transitions.
3. **End-to-End Testing:** Setup [Playwright](https://playwright.dev/) for headless browser cross-browser verification.

