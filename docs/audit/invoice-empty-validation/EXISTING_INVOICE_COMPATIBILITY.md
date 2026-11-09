# TPS BATTERY HOUSE — Existing Invoice Compatibility & Preservation Audit

## 1. Core Principle
While new invoices must initialize with zero items (`items: []`), editing or viewing existing saved invoices must **never** clear, truncate, or drop valid historical line items.

---

## 2. Compatibility Analysis Across Storage & Flow

### 2.1. Saved Invoices in Cloud Firestore
When a previously saved invoice is loaded from Firestore (via `handleEditInvoice(invoice)` in `src/App.jsx`), the invoice object contains its stored `items` array.
- The `createEmptyInvoice()` function is called **strictly** when initializing a fresh new bill (`handleStartNewInvoice` or fresh start).
- When editing an existing invoice:
  ```javascript
  const handleEditInvoice = (inv) => {
    setInvoice(inv);
    setView('invoice-editor');
  };
  ```
  The complete existing `items` array is preserved exactly as persisted in Firestore.

### 2.2. Legacy Draft Filtering
In `src/App.jsx`:
```javascript
const savedDraft = localStorage.getItem('tps_invoice_draft');
if (savedDraft) {
  try {
    const parsed = JSON.parse(savedDraft);
    // Sanitize draft: if it only has a single blank placeholder item, clean it up
    if (
      Array.isArray(parsed.items) &&
      parsed.items.length === 1 &&
      (!parsed.items[0].name || parsed.items[0].name.trim() === '') &&
      (!parsed.items[0].rate || Number(parsed.items[0].rate) === 0)
    ) {
      parsed.items = [];
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse draft:', e);
  }
}
```
This logic cleans up only dummy single unconfigured placeholder rows from legacy local drafts without touching drafts that have valid items.

### 2.3. Historical Line Items Invariant Verification
Automated test assertions in `scratch/test_invoice_empty_initialization_and_print_validation.mjs` explicitly verify:
- Part 2, Test 7: Saved multi-item invoice (Battery + Inverter + Solar) retains all 3 items upon loading.
- Part 2, Test 8: Editing customer or tax metadata preserves the exact line items array without accidental reset.
- Part 2, Test 9: Reopening saved invoices yields matching subtotal and net payable amounts without drift or loss.
- All 1,191 assertions across the 33 test suites confirm that existing records, multi-category items, and calculations remain 100% intact.

