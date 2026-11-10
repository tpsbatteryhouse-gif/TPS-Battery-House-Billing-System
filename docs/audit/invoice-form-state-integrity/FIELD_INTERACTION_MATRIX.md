# TPS BATTERY HOUSE — Field Interaction Matrix

## 1. Overview
This matrix documents how user actions in one field affect other fields across the New Bill / New Invoice screen. The objective is to verify that unrelated fields remain completely isolated while intentional business dependencies function predictably.

---

## 2. Cross-Field Interaction Matrix

| User Trigger / Action | Affected Fields (Intended) | Unaffected Fields (Must Remain Stable) | Integrity Status |
| :--- | :--- | :--- | :--- |
| **Edit Customer Name / Phone** | `customer.name`, `customer.phone` | All items, old battery value, discounts, dates, payment settings | **Verified Stable** |
| **Select Customer from Directory** | `customer.name`, `phone`, `gstin`, `address`, `stateCode`, `pan`, `transactionType` (if GSTIN present) | `items[]`, `scrapExchange`, `additionalDiscount`, `paymentMode`, `shippingAddress` (if already typed and record has none) | **Verified Stable** |
| **Switch to B2C Card** | `transactionType = 'B2C'`, UI switches to B2C | Customer name, phone, address, items, scrapExchange, discount | **Verified Stable** |
| **Switch to B2B Card** | `transactionType = 'B2B'`, UI shows GSTIN field | Customer name, phone, address, items, scrapExchange, discount | **Verified Stable** |
| **Enter / Edit GSTIN** | `customer.gstin`, `customer.stateCode` (first 2 digits), `customer.pan` (chars 2-12) | Customer name, phone, address, all line items, scrap exchange amount, discounts | **Verified Stable** |
| **Add Line Item (Preset or Blank)** | `items.length += 1`, `totals` recomputed | `customer`, `transactionType`, `scrapExchange.amount`, `additionalDiscount`, `paymentStatus`, `invoiceDate` | **Verified Stable** |
| **Remove Line Item** | `items.length -= 1`, `totals` recomputed | `customer`, `transactionType`, `scrapExchange.amount`, `additionalDiscount`, `paymentStatus`, remaining items' values | **Verified Stable** |
| **Edit Line Item Quantity / Rate** | `items[i].qty` / `rate`, `lineTotal`, `totals` | Other line items, `scrapExchange.amount`, `additionalDiscount`, `customer` | **Verified Stable** |
| **Change Tax Mode (Incl / Excl)** | `items[i].isTaxInclusive`, `taxableValue`, `totals` | `rate`, `qty`, other items, `scrapExchange.amount`, `additionalDiscount` | **Verified Stable** |
| **Change GST Slab (0/5/12/18/28%)** | `items[i].gstRate`, `totalGstAmount`, `totals` | `rate`, `qty`, other items, `scrapExchange.amount`, `additionalDiscount` | **Verified Stable** |
| **Enter Old Battery Scrap Value** | `scrapExchange.amount`, `scrapExchange.enabled = true`, `totals.scrapDiscount`, `netPayable` | All line items, `additionalDiscount`, `customer`, `paymentMode` | **Verified Stable** |
| **Click Remove on Scrap Exchange** | `scrapExchange.enabled = false`, `scrapExchange.amount = 0`, `totals.scrapDiscount = 0` | All line items, `additionalDiscount`, `customer` | **Verified Stable** |
| **Enter Additional Discount** | `additionalDiscount`, `totals.extraDiscount`, `netPayable` | All line items, `scrapExchange.amount`, `customer` | **Verified Stable** |
| **Click Remove on Discount** | `additionalDiscount = 0`, `totals.extraDiscount = 0` | All line items, `scrapExchange.amount`, `customer` | **Verified Stable** |
| **Change Payment Status (Paid/Pending)**| `paymentStatus` | Items, deductions, totals, customer particulars | **Verified Stable** |
| **Change Payment Mode (Cash/UPI/Card)**| `paymentMode` | Items, deductions, totals, customer particulars | **Verified Stable** |
| **Toggle Reverse Charge** | `reverseCharge` | Items, deductions, totals, customer particulars | **Verified Stable** |
| **Expand / Collapse Extra Details** | UI expansion toggle only | All form values, dates, PO number, staff notes remain intact | **Verified Stable** |
| **Expand / Collapse Item Details** | Item row expansion toggle only | Item rate, qty, name, warranty, HSN remain intact | **Verified Stable** |

---

## 3. Key Isolation Rule
**Old Battery Scrap Value (`scrapExchange.amount`) is strictly isolated.**
Under no circumstance does modifying items, customer particulars, payment terms, or metadata trigger recalculation or resetting of `scrapExchange.amount`.

