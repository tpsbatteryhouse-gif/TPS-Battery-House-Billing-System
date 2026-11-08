# Root Cause Analysis: UI Discrepancy & Dual Rendering

**Phase:** Phase 2 — Complete Tax Bill Generator Replacement  
**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** November 2026  
**File:** `docs/audit/invoice-screen-replacement/ROOT_CAUSE_ANALYSIS.md`

---

## 1. Problem Statement

When users accessed localhost, rather than the expected full-page Tax Bill Generator workspace matching the Stitch HTML design, they observed:
1. A narrow modal popup titled `Quick Create Multi-Category Invoice`.
2. A compact modal form containing customer fields, invoice metadata, product presets, and a miniature items table.
3. Dimmed, duplicated form elements visible behind the modal backdrop.

---

## 2. Root Cause Breakdown

### Root Cause 1: State Interception in `handleStartNewInvoice`
In `src/App.jsx`, `handleStartNewInvoice` was originally authored to open a modal rather than navigating the router/view state:
```javascript
// src/App.jsx:224-282
const handleStartNewInvoice = () => {
  const nextNumber = getNextInvoiceNumber();
  const freshInvoice = { ... };
  setInvoice(freshInvoice);
  setIsQuickCreateOpen(true); // <--- Root cause: Opens modal, does not set activeView
};
```
Every entry point in the application (Dashboard hero button, Dashboard empty-state button, All Invoices header button, and Floating Action Button) called `onNewInvoice={handleStartNewInvoice}`.
Consequently, no user action routed directly to `activeView = 'editor'`.

### Root Cause 2: In-place Reset Triggering Modal from Editor
In `src/components/InvoiceForm.jsx` and `src/components/invoice/InvoicePageHeader.jsx`, the "Reset Form" button was wired to `onReset={handleStartNewInvoice}`.
When a user was already in the editor (`activeView === 'editor'`) and clicked "Reset Form", `handleStartNewInvoice` opened `QuickCreateInvoiceModal` on top of the editor.

### Root Cause 3: Dual Form Mounting (Duplicated Content)
Because `QuickCreateInvoiceModal` was rendered at the root level in `src/App.jsx:844`:
```jsx
{isQuickCreateOpen && (
  <QuickCreateInvoiceModal ... />
)}
```
When `isQuickCreateOpen` was true while `activeView === 'editor'`, React mounted both:
1. `InvoiceForm` in the background (within `main`).
2. `QuickCreateInvoiceModal` in a fixed portal overlay in the foreground.

Both components rendered:
- Customer Name, Phone, and GSTIN inputs.
- Invoice Number and Date inputs.
- Product Category selections.
- Line items.
- Financial total calculations.

This created visual confusion and duplicated form rendering.

---

## 3. Remediation Strategy

1. **Retire `QuickCreateInvoiceModal` as Primary Experience:**
   Remove `QuickCreateInvoiceModal` from the primary invoice creation flow.
2. **Direct Route Navigation:**
   Update `handleStartNewInvoice` to:
   ```javascript
   setInvoice(freshInvoice);
   setActiveView('editor');
   setEditorMode('edit');
   window.scrollTo({ top: 0, behavior: 'smooth' });
   ```
3. **In-place Reset Handler:**
   Provide a dedicated `handleResetInvoice` that resets the invoice state without toggling any modal.
4. **Header `+ New Bill` Action:**
   Add the prominent `+ New Bill` button in `src/components/Header.jsx` (both mobile and desktop) matching the Stitch reference design, which directly invokes `handleStartNewInvoice` and navigates to the editor.
5. **Clean Layout Integration:**
   Remove the redundant "Editor Sub-Header: Back to Dashboard & Bill Actions" from `src/App.jsx` so that `InvoiceForm` is the single, clean, full-width container matching the Stitch reference design.

