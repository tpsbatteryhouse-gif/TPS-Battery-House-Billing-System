# Deliverable 4: Component Architecture & State Orchestration

**Phase:** Phase 2 — Complete Tax Bill Generator Replacement  
**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** November 2026  
**File:** `docs/audit/invoice-screen-replacement/COMPONENT_ARCHITECTURE.md`

---

## 1. Active Application Hierarchy

```mermaid
graph TD
    App["src/App.jsx (Global Router & State Orchestrator)"]
    App --> Header["src/components/Header.jsx\n(Navigation, Live Clock, + New Bill Button)"]
    App --> Main["main (max-w-[1700px] Container)"]

    Main --> Dashboard["Dashboard.jsx (activeView === 'dashboard')"]
    Main --> Invoices["AllInvoicesView.jsx (activeView === 'invoices')"]
    Main --> Catalog["ProductCatalogView.jsx (activeView === 'catalog')"]
    Main --> Customers["CustomerManagementView.jsx (activeView === 'customers')"]
    Main --> Staff["StaffManagementView.jsx (activeView === 'staff')"]

    Main --> EditorWorkspace["activeView === 'editor' (Single Mount, No Overlays)"]
    EditorWorkspace --> InvoiceForm["InvoiceForm.jsx (Billing Studio)"]
    
    InvoiceForm --> PageHeader["InvoicePageHeader.jsx\n(Back Button, Title, Invoice #, GSTIN, Reset, Settings)"]
    InvoiceForm --> TopGrid["grid grid-cols-1 lg:grid-cols-3 gap-6"]
    TopGrid --> CustomerSection["CustomerDetailsSection.jsx (lg:col-span-2)"]
    TopGrid --> MetadataSection["InvoiceMetadataSection.jsx (lg:col-span-1)"]
    
    InvoiceForm --> ItemsSection["InvoiceItemsSection.jsx\n(Category Add Buttons, Catalog Picker, Table & Mobile Cards)"]
    ItemsSection --> ItemRow["InvoiceItemRow.jsx (x N)"]
    
    InvoiceForm --> BottomGrid["grid grid-cols-1 lg:grid-cols-12 gap-6"]
    BottomGrid --> LeftNotes["lg:col-span-7 space-y-6"]
    LeftNotes --> Deductions["InvoiceDeductionsSection.jsx (Scrap Trade-in & Discounts)"]
    LeftNotes --> Terms["InvoiceTermsSection.jsx (Terms, Staff Notes, GST Tip)"]
    BottomGrid --> Summary["InvoiceSummary.jsx (lg:col-span-5 Highlighted Summary Card)"]
    
    InvoiceForm --> ActionBar["InvoiceActionBar.jsx (Sticky bottom-4 Dock with Verification Indicator)"]

    App --> FloatingBtn["FloatingActionButton.jsx (visible on non-editor views)"]
```

---

## 2. State Invariants & Props Contract

1. **`onNewInvoice` Contract:**
   All entry points (`Header`, `Dashboard`, `AllInvoicesView`, `FloatingActionButton`) call `handleStartNewInvoice` which guarantees:
   - Fresh invoice template initialized with transactional numbering prefix (`TPS/2026-27/00X`).
   - `activeView` transitions immediately to `'editor'`.
   - `editorMode` defaults to `'edit'`.
   - Zero modals mounted.

2. **`onReset` Contract:**
   Invoking "Reset Form" calls `handleResetInvoice`, which prompts with native confirmation alert, clearing only in-progress form inputs without modifying any saved Firestore records.

3. **Authoritative Financial State:**
   Calculated totals (`calculateInvoiceTotals(invoice, business.stateCode)`) are computed once at the `InvoiceForm` root and passed down to `InvoiceSummary` and `InvoiceActionBar`.

