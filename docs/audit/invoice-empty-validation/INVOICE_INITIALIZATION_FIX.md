# TPS BATTERY HOUSE — Invoice Initialization Fix Audit

## 1. Scope & Objective
Eliminate phantom, blank, or placeholder line items upon creating a new invoice in the TPS Battery House GST Billing System, ensuring a pristine empty state (`items: []`) with ₹0.00 total and explicit visual prompts for user action.

---

## 2. Changes Implemented

### 2.1. Centralized Factory Function (`src/utils/defaults.js`)
We introduced `createEmptyInvoice()`:
```javascript
export function createEmptyInvoice(
  invoiceNumber = 'TPS/2026-27/---',
  date = null
) {
  const today = date || new Date().toISOString().split('T')[0];
  return {
    ...DEFAULT_INVOICE,
    id: `inv-${Date.now()}`,
    invoiceNumber,
    date: today,
    dueDate: today,
    transactionType: 'B2C',
    customer: {
      name: '',
      phone: '',
      address: '',
      shippingAddress: '',
      gstin: '',
      pan: '',
      stateCode: '32',
      stateName: 'Kerala',
    },
    items: [], // CRITICAL: Always strictly empty array on new bill
    paymentStatus: 'pending',
    paymentMode: 'cash',
    additionalDiscount: 0,
    scrapExchange: {
      enabled: false,
      amount: 0,
      description: '',
      weightKg: 0,
    },
    manualRoundOff: 0,
    reverseCharge: false,
    termsAndConditions:
      'Goods once sold will not be taken back or exchanged except as per manufacturer warranty terms.',
    notes: '',
  };
}
```

### 2.2. Application State Initialization (`src/App.jsx`)
In `src/App.jsx`:
- **Boot / Fresh Load:** When loading from `localStorage`, any legacy draft containing a single dummy item (`name === ''` and `rate === 0`) is sanitized down to `items: []`. If no draft exists, `createEmptyInvoice()` initializes state.
- **`handleStartNewInvoice()`:** When clicking `+ New Bill` or navigating to the Tax Bill Generator, `createEmptyInvoice(newInvNo, today)` is invoked, clearing any prior line items and setting item count to 0 and total payable to ₹0.00.
- **`handleResetForm()`:** Resets to `createEmptyInvoice()`, ensuring the form returns to an empty bill.

### 2.3. Empty State Presentation (`src/components/invoice/InvoiceItemsSection.jsx`)
When `items.length === 0`:
- Instead of showing an empty table or broken row, an empty state container is rendered:
  - Header: **"No items added yet"**
  - Subtitle: **"Select a product from the catalog or add a new item to this bill."**
  - Action 1: **"Browse Products"** (`amber` primary button) which opens the product catalog picker modal.
  - Action 2: **"+ Add Item"** (`border` secondary button) which adds an initial blank item ready for editing.
- Sticky subtotal and summary cards accurately compute and display ₹0.00.

### 2.4. Deletion Down to Zero (`src/components/InvoiceForm.jsx` & `InvoiceItemRow.jsx`)
Previously, deleting the sole remaining item was blocked or showed an alert.
Now:
- Users can delete the last item.
- The `isOnlyItem` disabled state was removed from `InvoiceItemRow.jsx`.
- When the last item is removed, the items list transitions seamlessly back to the clean empty state.

