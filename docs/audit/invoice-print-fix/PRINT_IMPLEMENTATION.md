# PRINT IMPLEMENTATION AUDIT

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Subject:** Implementation of Dual-Strategy Printing & Prevention of Blank/Black Printouts  
**Files Modified:**
- `src/App.jsx`
- `src/utils/pdfExport.js`
- `src/components/InvoiceForm.jsx`
- `src/components/invoice/InvoiceActionBar.jsx`
- `src/index.css`

---

## 1. Overview of Architecture & Fixes

To permanently prevent blank or black printouts, a coordinated multi-layer printing architecture was deployed:

1. **Option A (Dedicated Vector PDF Print Engine):**
   - Implemented `printInvoicePdf(invoice, business, invoiceCopy)` in `src/utils/pdfExport.js`.
   - Validates the invoice against `verifyInvoiceFinancialConsistency`.
   - Compiles the authentic vector A4 GST Tax Invoice via jsPDF.
   - Generates an in-memory `Blob` and mounts an isolated invisible `iframe` (`#tps-invoice-print-frame`).
   - Invokes `iframe.contentWindow.print()`, sending pure vector PDF bytes to the browser print engine with zero DOM styling dependencies.
   - Gracefully falls back to DOM print if iframe printing is blocked by container/browser sandbox policies.
   - Retains the Blob URL for 60 seconds to ensure the OS print spooler finishes spooling before revoking.

2. **Option B (DOM-Level Print Readiness):**
   - In `src/App.jsx`, `<InvoicePreview>` is now **permanently mounted** inside a dedicated `.print-only` container (`hidden print:block print:w-full`) when `activeView === 'editor'`.
   - Even when the user is actively typing in `editorMode === 'edit'`, `#invoice-printable` is present in the DOM.
   - When native `window.print()` is triggered, the editor form (marked `.no-print`) is cleanly hidden, and `#invoice-printable` seamlessly displays.

3. **CSS Paged Media & Dark-Theme Invalidation:**
   - Updated `src/index.css` `@media print` rules:
     ```css
     html, body, #root, #root > div, .min-h-screen {
       background: #ffffff !important;
       background-color: #ffffff !important;
       color: #000000 !important;
       margin: 0 !important;
       padding: 0 !important;
       min-height: auto !important;
       box-shadow: none !important;
     }
     ```
   - Overrides Tailwind's `.bg-slate-950` so that dark theme background cannot leak into the printed document.

4. **Interactive UX Feedback:**
   - Added `isPrinting` state in `src/App.jsx`.
   - Added `Preparing Print...` spinner in `InvoiceActionBar.jsx`.
   - Disables button during generation to prevent double-click race conditions.

