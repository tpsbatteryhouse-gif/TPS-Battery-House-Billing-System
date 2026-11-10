# TPS BATTERY HOUSE — Invoice Form Field Inventory & State Ownership Catalog

## 1. Executive Summary
This document provides an exhaustive inventory of every user-editable field across the TPS BATTERY HOUSE New Tax Invoice generator (`src/components/InvoiceForm.jsx`), its child view components, underlying calculation engine (`src/utils/gstCalculations.js`), and persistence services (`src/firebase/services/invoiceService.js`).

Total user-editable fields audited: **26 distinct fields across 5 logical operational groups**.

---

## 2. Field Inventory & Ownership Table

| Field Path | UI Location | Data Type | Authoritative State Owner | Writers / Mutation Vectors | Source vs Derived |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `transactionType` | Customer Section | `'B2C' \| 'B2B'` | `invoice.transactionType` | Card click in `CustomerDetailsSection`, Customer directory select | **Source** |
| `customer.name` | Customer Section | `string` | `invoice.customer.name` | Text input `#f-name`, Directory picker | **Source** |
| `customer.phone` | Customer Section | `string` | `invoice.customer.phone` | Tel input `#f-phone`, Directory picker | **Source** |
| `customer.gstin` | Customer Section | `string` (15 chars) | `invoice.customer.gstin` | Text input `#f-gst`, Directory picker | **Source** |
| `customer.pan` | Customer Section | `string` (10 chars) | `invoice.customer.pan` | Derived from GSTIN or manual input | **Source** |
| `customer.address` | Customer Section | `string` | `invoice.customer.address` | Text input `#f-addr`, Directory picker | **Source** |
| `customer.city` | Extra Customer Details | `string` | `invoice.customer.city` | Text input, Directory picker | **Source** |
| `customer.district` | Extra Customer Details | `string` | `invoice.customer.district` | Text input, Directory picker | **Source** |
| `customer.pincode` | Extra Customer Details | `string` (6 digits) | `invoice.customer.pincode` | Text input, Directory picker | **Source** |
| `customer.stateCode` | Extra Customer Details | `string` (2 digits) | `invoice.customer.stateCode` | Auto from GSTIN, text input | **Source** |
| `customer.shippingAddress` | Extra Details Section | `string` | `invoice.customer.shippingAddress` | Text input `#m-ship`, Directory picker | **Source** |
| `items[].name` | Line Item Row | `string` | `invoice.items[i].name` | Text input in row or details | **Source** |
| `items[].category` | Line Item Row | `string` | `invoice.items[i].category` | Dropdown in details, Add Preset chip | **Source** |
| `items[].subcategory` | Line Item Row | `string` | `invoice.items[i].subcategory` | Auto from category or preset | **Source** |
| `items[].hsn` | Line Item Row | `string` | `invoice.items[i].hsn` | Text input in details, auto default | **Source** |
| `items[].qty` | Line Item Row | `number` (>= 1) | `invoice.items[i].qty` | Stepper `−` / `+` buttons | **Source** |
| `items[].unit` | Line Item Row | `string` | `invoice.items[i].unit` | Auto from category default | **Source** |
| `items[].rate` | Line Item Row | `number` / `string` | `invoice.items[i].rate` | Numeric input `#item-price-{i}` | **Source** |
| `items[].isTaxInclusive` | Line Item Row | `boolean` | `invoice.items[i].isTaxInclusive` | Dropdown in details (Incl/Excl) | **Source** |
| `items[].gstRate` | Line Item Row | `number` (0,5,12,18,28) | `invoice.items[i].gstRate` | Dropdown in details, auto default | **Source** |
| `items[].warranty` | Line Item Row | `string` | `invoice.items[i].warranty` | Text input in details, auto default | **Source** |
| `items[].serialNo` | Line Item Row | `string` | `invoice.items[i].serialNo` | Text input in details | **Source** |
| `additionalDiscount` | What are they buying? | `number` / `string` | `invoice.additionalDiscount` | Numeric input `#f-disc`, Remove link | **Source** |
| `scrapExchange.enabled`| What are they buying? | `boolean` | `invoice.scrapExchange.enabled` | Toggle link / button, Remove link | **Source** |
| `scrapExchange.amount` | What are they buying? | `number` / `string` | `invoice.scrapExchange.amount` | Numeric input `#f-exch`, Remove link | **Source** |
| `scrapExchange.description`| What are they buying?| `string` | `invoice.scrapExchange.description` | Defaults or user-entered scrap note | **Source** |
| `roundOffManual` | Ded. / Summary Engine | `number \| null` | `invoice.roundOffManual` | Manual input (if provided); auto otherwise | **Source** |
| `paymentStatus` | Payment Section | `string` | `invoice.paymentStatus` | "Paid now" / "Pay later" buttons | **Source** |
| `paymentMode` | Payment Section | `string` | `invoice.paymentMode` | Mode pills (Cash, UPI, Card, Bank) | **Source** |
| `notes` | Payment Section | `string` | `invoice.notes` | Textarea `#f-note` | **Source** |
| `invoiceDate` | Extra Details Section | `string` (YYYY-MM-DD) | `invoice.invoiceDate` | Date input `#m-date` | **Source** |
| `dueDate` | Extra Details Section | `string` (YYYY-MM-DD) | `invoice.dueDate` | Date input `#m-due`, quick terms | **Source** |
| `orderNumber` | Extra Details Section | `string` | `invoice.orderNumber` | Text input `#m-po` | **Source** |
| `ewayBillNo` | Extra Details Section | `string` | `invoice.ewayBillNo` | Text input `#m-eway` | **Source** |
| `staffNotes` | Extra Details Section | `string` | `invoice.staffNotes` | Text input `#m-staff` | **Source** |
| `reverseCharge` | Extra Details Section | `boolean` | `invoice.reverseCharge` | Toggle switch | **Source** |

---

## 3. Authoritative Derived Values (Pure Computations)
The following fields are strictly **derived** by `calculateInvoiceTotals(invoice, businessStateCode)` and must **never** be maintained as independent conflicting state:

1. `items[i].taxableValue`
2. `items[i].cgstAmount`, `items[i].sgstAmount`, `items[i].igstAmount`
3. `items[i].totalGstAmount`
4. `items[i].lineTotal`
5. `totals.totalGross`
6. `totals.totalTaxableValue`
7. `totals.totalCgst`, `totals.totalSgst`, `totals.totalIgst`, `totals.totalTax`
8. `totals.scrapDiscount`
9. `totals.extraDiscount`
10. `totals.subtotalAfterDeductions`
11. `totals.roundOff`
12. `totals.netPayable`
13. `totals.amountInWords`
14. `totals.hsnSummary`
15. `totals.categorySales`

