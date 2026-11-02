# TPS BATTERYS HOUSE — Multi-Category GST Billing & Invoice Management System

[![React](https://img.shields.io/badge/React-19.3.1-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3.5-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4.19-38B2AC.svg)](https://tailwindcss.com/)
[![Oxlint](https://img.shields.io/badge/Oxlint-Clean-success.svg)](https://oxc.rs/)

A modern, responsive, standalone Multi-Category GST Tax Invoice & Billing Web Application for **TPS BATTERYS HOUSE** (Padinarangadi, Thrithala, Palakkad, Kerala). Supports all four primary business categories: **Battery**, **Inverter**, **Solar**, and **Installation Services**, featuring a comprehensive Product Catalog, mixed-category line item billing, category performance insights, live Kerala statutory GST tax invoice preview, dynamic UPI payment QR codes, and lightweight client-side A4 vector PDF export.

---

## 1. Project Overview

TPS BATTERYS HOUSE is an upgraded sales and invoice management system designed for comprehensive power and renewable energy dealerships selling batteries, home & commercial inverters, solar panels, solar PCUs/accessories, and installation services.

The application operates entirely on the client side using React 19 state and browser `localStorage`, providing instant page load times and zero network latency without requiring an external backend.

### Primary Features
- **Multi-Category Product System:** Native support for all four core business categories:
  1. **Battery:** Automotive, Inverter, Tubular, SMF, VRLA, Lithium, Solar, and Two-Wheeler storage batteries with Ah, voltage, and technology specs.
  2. **Inverter:** Home, Commercial, Solar, Hybrid, Off-Grid, and On-Grid Inverters/UPS with VA rating, power wattage, waveform, and phase specs.
  3. **Solar:** Monocrystalline, Bifacial, TopCon solar panels, Solar PCUs, MPPT controllers, cables, and complete solar systems with Wp and kW ratings.
  4. **Services:** Solar Installation, Inverter Setup, Battery Installation, Maintenance (AMC), and Repair services without forcing physical fields.
- **Mixed-Category Invoices:** Supports adding multiple items from different categories (e.g., Battery + Inverter + Solar Panel + Installation Service) on a single invoice, with independent HSN/SAC codes, individual GST rates, and dynamic specifications.
- **Product Catalog Management:** Centralized frontend catalog (`localStorage` key `tps_product_catalog`) with full CRUD operations, category filters, brand filters, live search, and 1-click "Add to Bill" integration.
- **Category Sales Performance Dashboard:** Real-time business metrics (Total Invoices, Paid, Pending, Collected Revenue) alongside a category sales breakdown (Battery Sales, Inverter Sales, Solar Sales, Service Revenue) without double-counting mixed invoices.
- **Category-Aware Filtering & Search:** Filter invoices by payment status (`Paid`, `Pending`, `Overdue`, `Draft`) and product category (`Battery`, `Inverter`, `Solar`, `Services`).
- **Old Battery Scrap Buyback (Battery Exclusive):** Preserves trade-in scrap deduction exclusive to battery transactions with eligibility indicators.
- **Statutory GST Tax Bill Studio:** Reverse tax-inclusive (MRP) and tax-exclusive calculations, multi-HSN statutory summary table, inter-state IGST and intra-state CGST/SGST support.
- **Ultra-Lightweight Vector PDF:** Client-side vector A4 PDF export using `jspdf` (~78 KB to 85 KB, 99.28% size reduction vs raster captures) with selectable text and embedded UPI QR code.
- **100% Backward Compatible:** Safe schema normalization for legacy invoices stored in `localStorage` without category metadata.

---

## 2. Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | [React 19](https://react.dev/) | React 19.3.1 with functional components & hooks |
| **Build Tool** | [Vite](https://vitejs.dev/) | Vite 8.3.5 with Hot Module Replacement (HMR) |
| **Styling** | [Tailwind CSS v3](https://tailwindcss.com/) | Tailwind CSS 3.4.19 + PostCSS + Autoprefixer |
| **Icons** | [Lucide React](https://lucide.dev/) | Consistent, accessible iconography |
| **Linter** | [Oxlint](https://oxc.rs/) | Rust-powered high-speed linter (0 warnings, 0 errors) |
| **PDF Generation** | `jspdf` & `html2canvas` | Native vector & selectable text engine (40-85 KB) with compressed fallback |
| **QR Code** | `qrcode` | Client-side Canvas/PNG QR rendering for UPI payments |
| **Persistence** | Browser `localStorage` | Synchronous client storage with fallback seed data |

---

## 3. Getting Started & Installation

### Prerequisites
- **Node.js:** v18.0.0 or higher (Tested on Node.js v24.14.0)
- **Package Manager:** `npm` v9.0.0 or higher (Tested on npm 11.9.0)

### Installation
Clone the repository and install dependencies:

```bash
cd Amal
npm install
```

### Available Scripts

| Command | Purpose | Output / Notes |
| :--- | :--- | :--- |
| `npm run dev` | Starts local development server | Runs on `http://localhost:5173/` with HMR |
| `npm run build` | Compiles production assets | Outputs optimized bundle to `dist/` |
| `npm run lint` | Runs Oxlint across all source files | Checks JSX purity, imports, and syntax (0 warnings, 0 errors) |
| `node scratch/test_multi_category_suite.js` | Runs automated multi-category test suite | Verifies 41 unit & integration test cases |

---

## 4. Project Directory Structure

```text
Amal/
├── .vscode/               # Workspace IDE settings
├── dist/                  # Production build output
├── docs/                  # Comprehensive project documentation
│   ├── ARCHITECTURE.md    # Multi-category architecture & component hierarchy
│   ├── USER_GUIDE.md      # Operator manual for catalog, multi-category billing, & PDF
│   ├── DATA_MODEL.md      # Category schemas, invoice items, and storage keys
│   ├── FINANCIAL_CALCULATIONS.md # Multi-HSN GST formulas, category sales, & rounding
│   ├── TESTING.md         # Automated and manual verification test cases
│   ├── SECURITY_AND_LIMITATIONS.md # LocalStorage limits, tax disclaimers, & privacy
│   ├── AUDIT_REPORT.md    # Code audit findings & verification logs
│   └── ROADMAP.md         # Phased plan for backend integration & database persistence
├── public/                # Static public assets and favicon
├── src/
│   ├── components/        # Reusable React components
│   │   ├── AllInvoicesView.jsx       # Category-filtered invoice list
│   │   ├── BusinessSettingsModal.jsx # Store & bank configuration modal
│   │   ├── CatalogItemPickerModal.jsx# Quick catalog search and item picker
│   │   ├── Dashboard.jsx             # Category performance KPIs & distribution
│   │   ├── FloatingActionButton.jsx  # Fixed bottom-right creation action
│   │   ├── Header.jsx                # Navigation tabs, live digital clock, & profile
│   │   ├── InvoiceForm.jsx           # Multi-category GST tax bill editor
│   │   ├── InvoiceHistoryModal.jsx   # LocalStorage history viewer
│   │   ├── InvoicePreview.jsx        # Live A4 GST invoice with category specs
│   │   ├── ProductCatalogView.jsx    # Full product catalog management view
│   │   ├── QuickCreateInvoiceModal.jsx # Fast multi-category invoice modal
│   │   ├── UpiQrCode.jsx             # Dynamic UPI payment QR generator
│   │   └── UserProfileModal.jsx      # Operator profile & simulated sign-in
│   ├── data/
│   │   └── mockData.js               # Mock user & initial invoice records
│   ├── utils/
│   │   ├── categories.js             # Centralized category config & catalog seed
│   │   ├── defaults.js               # Business metadata & multi-category presets
│   │   ├── gstCalculations.js        # Multi-HSN GST calculations & category totals
│   │   ├── idGenerator.js            # Unique IDs and timestamp helpers
│   │   ├── numberToWords.js          # Indian numbering currency words
│   │   └── pdfExport.js              # Lightweight vector PDF generator
│   ├── App.jsx            # Top-level state coordinator & view router
│   ├── index.css          # Tailwind directives, print media, & scrollbars
│   └── main.jsx           # React DOM application entry point
├── package.json           # Dependencies and build scripts
└── vite.config.js         # Vite bundler configuration
```

---

## 5. Documentation Index

Detailed engineering and operator guides are maintained in the [`docs/`](docs/) directory:

1. [**Architecture Guide**](docs/ARCHITECTURE.md) — Multi-category component architecture, data flow, and normalization.
2. [**User Guide**](docs/USER_GUIDE.md) — Operator instructions for product catalog, mixed-category bills, and PDF export.
3. [**Data Model Specification**](docs/DATA_MODEL.md) — Schemas for categories, line item specifications, and storage keys.
4. [**Financial & GST Calculations**](docs/FINANCIAL_CALCULATIONS.md) — Multi-HSN rules, category sales distribution, and trade-in deductions.
5. [**Testing & Quality Assurance**](docs/TESTING.md) — Test suites A through J with verification logs.
6. [**Security & Operational Limitations**](docs/SECURITY_AND_LIMITATIONS.md) — Storage boundary, mock authentication, and tax advisory notices.
7. [**Engineering Audit Report**](docs/AUDIT_REPORT.md) — Architectural upgrade findings, validations, and test results.
8. [**Development Roadmap**](docs/ROADMAP.md) — Phased backend integration, inventory management, and cloud sync.

---

## 6. Important Operational Notice

> [!WARNING]
> **Client-Side Storage Disclaimer:** This application stores all invoice records and product catalog entries in browser `localStorage` (`tps_invoice_records` and `tps_product_catalog`). Data is tied to the specific browser and machine. Clearing browser site data will remove local changes. Always save PDF backups.
>
> **Tax Compliance Notice:** HSN codes and GST rates provided in defaults (`8507` @ 28% for batteries, `8504` @ 18% for inverters, `8541` @ 12% for solar devices, `9954` / `9987` @ 18% for services) are configurable presets. Operators must consult their certified tax advisor to verify applicable GST rates for specific equipment and bundled supplies.

---

## 7. License & Credits

- **Business Name:** TPS BATTERYS HOUSE
- **GSTIN:** `32DIUPP1211B2ZN`
- **Location:** Building No. 16/207, 208, Padinarangadi, Koottanad Road, Thrithala, Palakkad, Kerala - 679552
- **Contact:** +91 9846830532
- **Developed for:** Commercial battery, inverter, and solar energy billing and Kerala GST compliance.
