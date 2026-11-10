# PRINT DOCUMENT ARCHITECTURE & WORKFLOW SPECIFICATION

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Subject:** End-to-End A4 GST Invoice Print Pipeline & Document Lifecycle  

---

## 1. Architectural Architecture Diagram

```mermaid
flowchart TD
    subgraph UI Entry Points
        A1["InvoiceActionBar 'Print' Button (Editor)"]
        A2["InvoicePreview 'Print Bill' Button (Preview Toolbar)"]
        A3["InvoicePreview 'Print A4 Bill' Button (Bottom Banner)"]
    end

    subgraph State & Consistency Preparation
        B["handlePrint() in App.jsx"]
        B --> C["isPrinting = true (Spinner Active)"]
        C --> D["Synchronize invoice.netPayable = totals.netPayable"]
        D --> E["verifyInvoiceFinancialConsistency Guard"]
    end

    A1 --> B
    A2 --> B
    A3 --> B

    subgraph Execution Path 1: Vector PDF Printing (Option A)
        E -- "Valid" --> F["printInvoicePdf() in pdfExport.js"]
        F --> G["generateVectorPdf() -> jsPDF Vector Doc"]
        G --> H["Compile Blob (type: application/pdf)"]
        H --> I["Create Object URL (URL.createObjectURL)"]
        I --> J["Mount Hidden Iframe (#tps-invoice-print-frame)"]
        J --> K["iframe.contentWindow.print()"]
    end

    subgraph Execution Path 2: In-Page DOM Printing (Option B Fallback)
        K -- "Blocked / Sandbox Error" --> L["Fallback to window.print()"]
        E -- "DOM Mode" --> L
        L --> M["@media print Active in index.css"]
        M --> N["html, body, #root, .min-h-screen -> #ffffff"]
        M --> O[".no-print hides Header & Editor Form"]
        M --> P[".print-only displays mounted InvoicePreview (#invoice-printable)"]
        P --> Q["Native Print Spooler Receives Pure White A4 GST Invoice"]
    end

    subgraph Completion & Teardown
        K --> R["Print Spooler Initiated"]
        Q --> R
        R --> S["isPrinting = false"]
        R --> T["Form State Preserved Untouched"]
        R --> U["Blob URL Revoked after 60s Safety Window"]
    end
```

---

## 2. Key Document Structure Components

### A. The Vector PDF Stream (`printInvoicePdf`)
- Generates 100% compliant vector PDF with embedded fonts, crisp borders, and tables.
- Size is 50 KB – 90 KB.
- Embedded Scannable UPI QR code generated with dynamic amount.
- Multi-HSN tax breakdown table formatted to statutory standard.
- Avoids rasterization artifacts.

### B. The Mounted In-DOM Print Element (`InvoicePreview`)
- Enclosed 3-column metadata grid (`Bill To`, `Shipped To`, `Invoice Metadata`).
- Table rows with line totals, rates, discounts, and HSN codes.
- Amount in words derived directly from authoritative `netPayable`.
- Boxed and prominent Bill Amount row.
- Terms and Conditions of Sale and Authorized Signatory stamp box.

### C. Resource Cleanup Policy
- Avoids premature revocation of Object URLs (`URL.revokeObjectURL(blobUrl)`) which causes blank printouts in Chromium-based browsers.
- Retains Blob URL for 60 seconds after print dialog invocation, giving the system spooler ample time to buffer the file.

