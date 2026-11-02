# TPS BATTERYS HOUSE — GST Billing & Invoice Management Dashboard

[![React](https://img.shields.io/badge/React-19.3.1-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3.5-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4.19-38B2AC.svg)](https://tailwindcss.com/)
[![Oxlint](https://img.shields.io/badge/Oxlint-Clean-success.svg)](https://oxc.rs/)

A modern, responsive, standalone GST Tax Invoice & Billing Web Application for **TPS BATTERYS HOUSE** (Padinarangadi, Thrithala, Palakkad, Kerala). Features an interactive Home Dashboard, live Kerala statutory GST tax invoice preview, dynamic UPI payment QR codes, and client-side A4 PDF download & print capabilities.

---

## 1. Project Overview

TPS BATTERYS HOUSE is an invoice management and GST tax billing web application designed for retail and wholesale automotive, inverter, and solar battery dealerships. The application operates entirely on the client side using React 19 state and browser `localStorage`, providing instant page load times and zero network latency.

### Primary Features
- **Home Dashboard:** Real-time business metrics (Total Invoices, Paid, Pending, and Total Revenue formatted in `₹`), dynamic time-based greetings, and quick search.
- **Recent Invoices Table & Responsive Cards:** Desktop table and mobile cards with status badges (`Paid`, `Pending`, `Overdue`, `Draft`) and case-insensitive search by invoice number or client name.
- **Quick Create Invoice Modal:** Fast, validated invoice creation flow with line items, dynamic totals, and auto-incremented non-colliding invoice numbering.
- **Kerala GST Tax Bill Studio:** Full statutory GST tax invoice generator with reverse tax-inclusive calculation, HSN code categorization (`8507` for Lead-Acid Batteries @ 28%, `8504` for Inverters/UPS @ 18%), battery scrap exchange deduction, and live A4 preview.
- **Dynamic UPI QR Code:** Generates standardized NPCI/UPI payment URIs (`upi://pay?pa=...&am=...`) allowing customers to scan and pay the exact net payable amount with GPay, PhonePe, Paytm, or BHIM.
- **Client-Side Export & Printing:** Ultra-lightweight vector A4 PDF export using `jspdf` (reducing file sizes from ~11 MB down to **~78 KB**, a **99.28% reduction**) with 100% selectable text, crisp vector lines, and embedded UPI QR code, plus native `@media print` styling for laser and thermal printing.
- **Store & Operator Profiles:** Simulated administrator session (`Alex Johnson`) and customizable business settings (GSTIN, bank accounts, UPI IDs, address, and invoice prefixes).

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
| **Persistence** | Browser `localStorage` | Synchronous client storage with fallback data |

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
| `npm run lint` | Runs Oxlint across all source files | Checks JSX purity, imports, and syntax |
| `npm run preview` | Serves production build locally | Tests production bundle locally |

---

## 4. Project Directory Structure

```text
Amal/
├── .vscode/               # Workspace IDE settings (CSS unknownAtRules)
├── dist/                  # Production build output
├── docs/                  # Comprehensive project documentation
│   ├── ARCHITECTURE.md    # System structure, data flow, & component hierarchy
│   ├── USER_GUIDE.md      # Step-by-step user manual
│   ├── DATA_MODEL.md      # Invoice and customer schema specifications
│   ├── FINANCIAL_CALCULATIONS.md # GST formulas, rounding, and examples
│   ├── TESTING.md         # Manual & automated validation test cases
│   ├── SECURITY_AND_LIMITATIONS.md # Client-side limitations & security notices
│   ├── AUDIT_REPORT.md    # Comprehensive engineering audit findings & fixes
│   └── ROADMAP.md         # Staged plan for future backend integration
├── public/                # Static public assets and favicon
├── src/
│   ├── components/        # Reusable React components
│   │   ├── AllInvoicesView.jsx       # Full invoice management table/cards
│   │   ├── BusinessSettingsModal.jsx # Store & bank configuration modal
│   │   ├── Dashboard.jsx             # Home dashboard & summary metrics
│   │   ├── FloatingActionButton.jsx  # Fixed bottom-right creation action
│   │   ├── Header.jsx                # Navigation, digital clock, & profile
│   │   ├── InvoiceForm.jsx           # GST tax bill input editor
│   │   ├── InvoiceHistoryModal.jsx   # LocalStorage history viewer
│   │   ├── InvoicePreview.jsx        # Statutory Kerala GST Tax Invoice preview
│   │   ├── QuickCreateInvoiceModal.jsx # Fast invoice creation modal
│   │   ├── UpiQrCode.jsx             # Dynamic UPI payment QR generator
│   │   └── UserProfileModal.jsx      # Operator profile & demo notice
│   ├── data/
│   │   └── mockData.js               # Mock user & initial invoice records
│   ├── utils/
│   │   ├── defaults.js               # Business metadata & product presets
│   │   ├── gstCalculations.js        # Reverse tax, CGST, SGST, & totals
│   │   ├── idGenerator.js            # Unique IDs and timestamp helpers
│   │   ├── numberToWords.js          # Indian numbering currency words
│   │   └── pdfExport.js              # A4 canvas capture & PDF export
│   ├── App.jsx            # Top-level state coordinator & view router
│   ├── index.css          # Tailwind directives, print media, & scrollbars
│   └── main.jsx           # React DOM application entry point
├── index.html             # Application HTML shell with typography & meta
├── package.json           # Dependencies and build scripts
├── postcss.config.js      # PostCSS plugin configuration
├── tailwind.config.js     # Tailwind CSS theme & color configuration
└── vite.config.js         # Vite bundler configuration
```

---

## 5. Documentation Index

Detailed engineering and operator guides are maintained in the [`docs/`](file:///home/navaneeth/Documents/Amal/docs) directory:

1. [**Architecture Guide**](docs/ARCHITECTURE.md) — Component architecture, state ownership, and data lifecycle.
2. [**User Guide**](docs/USER_GUIDE.md) — Operational instructions for billing, search, filters, and PDF export.
3. [**Data Model Specification**](docs/DATA_MODEL.md) — Schemas for invoices, line items, customers, and storage keys.
4. [**Financial & GST Calculations**](docs/FINANCIAL_CALCULATIONS.md) — Reverse tax calculations, HSN mapping, and rounding rules.
5. [**Testing & Quality Assurance**](docs/TESTING.md) — Manual test suites, build audits, and responsive view verification.
6. [**Security & Operational Limitations**](docs/SECURITY_AND_LIMITATIONS.md) — Storage boundary, mock authentication, and privacy constraints.
7. [**Engineering Audit Report**](docs/AUDIT_REPORT.md) — Code audit findings, severities, and verified remediations.
8. [**Development Roadmap**](docs/ROADMAP.md) — Phased plan for backend APIs, database persistence, and cloud auth.

---

## 6. Important Operational Notice

> [!WARNING]
> **Client-Side Storage Disclaimer:** This application currently stores all invoice records in the browser's `localStorage` (`tps_invoice_records`). Data is tied to the specific browser and device. Clearing browser history, cache, or site data will permanently remove locally created invoices. Do not use as a sole accounting system of record without generating physical printouts or PDF backups.
>
> **Authentication Notice:** The operator profile (`Alex Johnson`) is a frontend simulation. No actual authentication, access control, or server validation is active.

---

## 7. License & Credits

- **Business Name:** TPS BATTERYS HOUSE
- **GSTIN:** `32DIUPP1211B2ZN`
- **Location:** Building No. 16/207, 208, Padinarangadi, Koottanad Road, Thrithala, Palakkad, Kerala - 679552
- **Contact:** +91 9846830532
- **Developed for:** Commercial battery dealership invoicing and Kerala GST compliance.
