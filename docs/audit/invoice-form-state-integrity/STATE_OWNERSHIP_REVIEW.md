# TPS BATTERY HOUSE — State Ownership & Architectural Review

## 1. Core State Ownership Principle
To prevent race conditions, stale closures, and accidental mutations across the TPS BATTERY HOUSE invoice generator, every piece of information belongs strictly to one of two categories:

1. **Authoritative Source State:** Maintained at the application root (`src/App.jsx` and `src/components/InvoiceForm.jsx`), modified exclusively through immutable user actions.
2. **Authoritative Derived State:** Purely computed by `src/utils/gstCalculations.js` (`calculateInvoiceTotals`), never cached or duplicated as competing editable state.

---

## 2. State Ownership Hierarchy Diagram

```mermaid
flowchart TD
    subgraph Root["Authoritative Root State (App.jsx / InvoiceForm.jsx)"]
        CustomerState["customer (name, phone, address, gstin, stateCode, shippingAddress)"]
        TxTypeState["transactionType (B2C / B2B)"]
        ItemsState["items[] (qty, rate, gstRate, isTaxInclusive, hsn, serialNo)"]
        DeductionsState["scrapExchange (enabled, amount, description)\nadditionalDiscount"]
        PaymentState["paymentStatus, paymentMode, notes"]
        MetaState["invoiceDate, dueDate, orderNumber, ewayBillNo, staffNotes, reverseCharge"]
    end

    subgraph Updater["Safe Immutable Dispatch (updateField / updateItem)"]
        DispatchSingle["updateField(path, value)"]
        DispatchBatch["updateField({ [path]: value, ... })"]
        DispatchItem["updateItem(index, field, value)"]
    end

    subgraph PureEngine["Statutory Financial Engine (gstCalculations.js)"]
        LineCalc["calculateLineItem(item, isInterstate)"]
        TotalsCalc["calculateInvoiceTotals(invoice, businessStateCode)"]
    end

    subgraph ConsumingViews["Consuming Views & Output Workspaces"]
        LiveSummary["InvoiceSummary.jsx (Sticky Bill Total Sidebar)"]
        LivePreview["InvoicePreview.jsx (A4 GST Tax Invoice Preview)"]
        VectorPdf["pdfExport.js (Client Vector PDF Generation & Print)"]
        FirestorePersist["invoiceService.js (Firestore Persistence)"]
    end

    CustomerState --> DispatchSingle
    CustomerState --> DispatchBatch
    DeductionsState --> DispatchSingle
    DeductionsState --> DispatchBatch
    ItemsState --> DispatchItem

    Root --> PureEngine
    PureEngine --> LiveSummary
    PureEngine --> LivePreview
    PureEngine --> VectorPdf
    PureEngine --> FirestorePersist
```

---

## 3. Enforcement Rules
1. **No Derived State Write-Back:** Totals (e.g. `totalGross`, `totalTax`, `netPayable`) are computed on-the-fly during render and must never be fed back into form inputs as editable fields.
2. **Zero-Side-Effect Calculations:** `calculateInvoiceTotals` and `calculateLineItem` are pure functions. They never mutate the `invoice` or `items` array.
3. **Atomic Multi-Field Updates:** When multiple dependent fields are changed simultaneously (e.g., GSTIN + stateCode + PAN, or scrapExchange.amount + scrapExchange.enabled), they are batched into a single immutable update.
4. **Controlled Child Views:** Child sections (`InvoiceItemsSection`, `CustomerDetailsSection`) do not maintain competing copies of form values in local `useState`. Local UI state is restricted to transient visibility toggles.

