# Deliverable 3: Component Architecture & State Flow

**Document Version:** 1.0.0  
**Phase:** New Tax Invoice Screen — Google Stitch Design Integration  
**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** November 2026  

---

## 1. Component Hierarchy & Data Flow

```mermaid
graph TD
    App["src/App.jsx\n(Global State, Invoices, Catalog, Customers, Business Config)"]
    App --> InvoiceForm["src/components/InvoiceForm.jsx\n(Invoice Screen Orchestrator)"]

    InvoiceForm --> PageHeader["InvoicePageHeader.jsx\n(Title, Invoice #, GSTIN, Reset, Settings)"]
    InvoiceForm --> CustomerSection["CustomerDetailsSection.jsx\n(Live Search, Customer Picker, Auto-pop, B2B/B2C)"]
    InvoiceForm --> MetadataSection["InvoiceMetadataSection.jsx\n(Dates, Quick Terms, RCM, PO, E-Way Bill)"]
    InvoiceForm --> ItemsSection["InvoiceItemsSection.jsx\n(Catalog Picker, Presets, Category Add)"]
    ItemsSection --> ItemRow["InvoiceItemRow.jsx (x N)\n(Category, Specs, Tax Mode, GST, Line Total)"]
    InvoiceForm --> DeductionsSection["InvoiceDeductionsSection.jsx\n(Scrap Buyback, Special Discount, Round-off)"]
    InvoiceForm --> SummarySection["InvoiceSummary.jsx\n(Taxable, Taxes, Net Payable, In Words, Status, Mode)"]
    InvoiceForm --> TermsSection["InvoiceTermsSection.jsx\n(Customer Terms, Internal Staff Notes)"]
    InvoiceForm --> ActionBar["InvoiceActionBar.jsx\n(Sticky Bottom Dock: Summary KPIs & Actions)"]

    InvoiceForm -.-> CatalogModal["CatalogItemPickerModal.jsx"]
    InvoiceForm -.-> CustomerModal["CustomerPickerModal.jsx"]
```

---

## 2. Unidirectional State Management

- **Single Source of Truth:** `invoice` state lives in `src/App.jsx` and is passed as a prop into `InvoiceForm`.
- **Atomic Functional Updaters:** Handlers update nested properties immutably:
  ```javascript
  const updateInvoiceField = (field, value) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  };

  const updateCustomerField = (field, value) => {
    setInvoice((prev) => ({
      ...prev,
      customer: { ...(prev.customer || {}), [field]: value },
    }));
  };

  const updateLineItem = (index, updatedItem) => {
    setInvoice((prev) => {
      const nextItems = [...(prev.items || [])];
      nextItems[index] = updatedItem;
      return { ...prev, items: nextItems };
    });
  };
  ```

---

## 3. Real-time Calculation Pipeline

Calculations are driven by the authoritative Phase 5.3 mathematical engine (`src/utils/gstCalculations.js`):
1. **Line-Level Execution:** For every item in `invoice.items`, `calculateLineItem` determines base taxable value, CGST, SGST, IGST, and line total using exact `roundToTwoDecimals`.
2. **Invoice-Level Aggregation:** `calculateInvoiceTotals(invoice, business.stateCode)` aggregates line items, applies scrap buyback deductions, special discounts, and handles automatic or manual round-off.
3. **Propagated Metrics:** Calculated values (`totals`) are passed simultaneously to `InvoiceSummary` and `InvoiceActionBar` with zero state desynchronization.

