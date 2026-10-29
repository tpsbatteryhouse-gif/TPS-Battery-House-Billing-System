# Data Model Specification — TPS BATTERYS HOUSE

This document defines the schema, data types, validation rules, and persistence keys used throughout the application.

---

## 1. Storage Keys

| Key | Format | Default Behavior if Missing |
| :--- | :--- | :--- |
| `tps_invoice_records` | JSON Array of `Invoice` objects | Initialized with `INITIAL_MOCK_INVOICES` on first run. If existing key is `[]`, it remains empty. |
| `tps_invoice_draft` | Single JSON `Invoice` object | Initialized with `getSampleInvoiceData()`. |
| `tps_business_profile` | Single JSON `BusinessProfile` object | Initialized with `DEFAULT_BUSINESS`. |

---

## 2. Entity Schemas

### A. Invoice Entity (`Invoice`)

| Field | Type | Required | Description & Validation Rules |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Yes | Unique internal identifier (e.g., `inv-1793202930-101`). |
| `invoiceNumber` | `String` | Yes | Formatted sequential number (e.g., `TPS/2026-27/008`). Auto-incremented based on maximum existing sequence. |
| `invoiceDate` | `String` (ISO Date `YYYY-MM-DD`) | Yes | Date bill was issued. Must be a valid date string. |
| `dueDate` | `String` (ISO Date `YYYY-MM-DD`) | Yes | Payment due date. Must be equal to or later than `invoiceDate`. |
| `paymentStatus` | `String` (Enum) | Yes | `'Draft'` \| `'Pending'` \| `'Paid'` \| `'Overdue'`. |
| `paymentMode` | `String` (Enum) | Yes | `'Cash'` \| `'UPI / QR Code'` \| `'Bank Transfer (NEFT/RTGS/IMPS)'` \| `'Credit / Post-dated'` \| `'Cheque'`. |
| `placeOfSupply` | `String` | No | Default: `'Kerala (32)'`. |
| `reverseCharge` | `String` | No | `'No'` (default) or `'Yes'`. |
| `customer` | `Customer` | Yes | Embedded customer record object. |
| `items` | `Array<LineItem>` | Yes | Array of purchased goods/services. Must have at least 1 item. |
| `scrapExchange` | `ScrapExchange` | No | Optional old battery trade-in details. |
| `additionalDiscount`| `Number` | No | General concession in ₹ (must be >= 0). Default: `0`. |
| `roundOffManual` | `Number` \| `null` | No | Custom rounding adjustment in ₹. If `null`, auto-rounded to nearest rupee. |
| `netPayable` | `Number` | Yes | Final payable amount in ₹ (calculated). |
| `notes` | `String` | No | Customer warranty remark or service note. |
| `createdAt` | `String` (ISO 8601) | Yes | Creation timestamp (e.g., `2026-10-29T10:00:00.000Z`). |

---

### B. Customer Record (`Customer`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `String` | Yes | Customer or company name. Cannot be blank. |
| `phone` | `String` | No | 10-digit mobile number for SMS/WhatsApp. |
| `address` | `String` | No | Street address or building name. |
| `city` | `String` | No | City or town (e.g., `'Thrithala'`). |
| `district` | `String` | No | District (e.g., `'Palakkad'`). |
| `state` | `String` | No | State (e.g., `'Kerala'`). |
| `stateCode` | `String` | Yes | GST State code (e.g., `'32'`). Default: `'32'`. |
| `pincode` | `String` | No | 6-digit postal code (e.g., `'679552'`). |
| `gstin` | `String` | No | 15-character GSTIN for B2B buyers. Leave empty for B2C consumer bills. |

---

### C. Line Item Entity (`LineItem`)

| Field | Type | Required | Description & Validation Rules |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Yes | Unique item ID (e.g., `item-101`). |
| `name` | `String` | Yes | Product name / description (cannot be empty). |
| `hsn` | `String` | Yes | Harmonized System of Nomenclature code (e.g., `8507` for batteries, `8504` for inverters). |
| `serialNo` | `String` | No | Manufacturer serial number or barcode for warranty registration. |
| `warranty` | `String` | No | Duration of warranty (e.g., `'36 Months Replacement'`). |
| `qty` | `Number` | Yes | Quantity purchased. Must be an integer >= 1. |
| `unit` | `String` | Yes | Unit of measurement (`'Nos'`, `'Set'`, `'Pcs'`). |
| `rate` | `Number` | Yes | Unit price in ₹ (must be >= 0). |
| `isTaxInclusive` | `Boolean` | Yes | If `true`, `rate` represents the gross retail price including GST. If `false`, GST is added on top. |
| `gstRate` | `Number` | Yes | Tax slab percentage (`28`, `18`, `12`, `5`, `0`). |

---

### D. Scrap Battery Exchange Entity (`ScrapExchange`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `Boolean` | Yes | Flag indicating whether old battery scrap buyback was applied. |
| `description` | `String` | No | Scrap battery model or capacity (e.g., `'Old 150Ah Scrap Battery Buyback'`). |
| `amount` | `Number` | Yes | Scrap credit deducted from invoice total in ₹ (must be >= 0). |

---

### E. Simulated Operator Profile (`MockUser`)

| Field | Type | Value / Description |
| :--- | :--- | :--- |
| `id` | `String` | `'usr-001'` |
| `name` | `String` | `'Alex Johnson'` |
| `role` | `String` | `'Administrator'` |
| `email` | `String` | `'alex@example.com'` |
| `phone` | `String` | `'+91 9846830532'` |
| `avatarInitials`| `String` | `'AJ'` |
| `storeName` | `String` | `'TPS BATTERYS HOUSE'` |
| `storeBranch` | `String` | `'Padinarangadi, Thrithala, Palakkad'` |
| `isMockUser` | `Boolean` | `true` |

---

## 3. Sanitized JSON Example

```json
{
  "id": "inv-1793202930-101",
  "invoiceNumber": "TPS/2026-27/001",
  "invoiceDate": "2026-10-28",
  "dueDate": "2026-10-28",
  "paymentMode": "Cash",
  "paymentStatus": "Paid",
  "placeOfSupply": "Kerala (32)",
  "reverseCharge": "No",
  "customer": {
    "name": "Rajesh K.",
    "phone": "9876543210",
    "address": "Near Old Bus Stand, Thrithala Road",
    "city": "Thrithala",
    "district": "Palakkad",
    "state": "Kerala",
    "stateCode": "32",
    "pincode": "679534",
    "gstin": ""
  },
  "items": [
    {
      "id": "item-101",
      "name": "Fuze 1100 Inverter + 150 Ah Tubular Battery (Combo Set)",
      "hsn": "8507",
      "serialNo": "FZ-2026-98124 / BAT-150-7762",
      "warranty": "36 Months Replacement",
      "qty": 1,
      "unit": "Set",
      "rate": 22000,
      "isTaxInclusive": true,
      "gstRate": 28
    }
  ],
  "scrapExchange": {
    "enabled": true,
    "description": "Old 150Ah Scrap Battery Buyback (Exchange Discount)",
    "amount": 2000
  },
  "additionalDiscount": 0,
  "roundOffManual": null,
  "netPayable": 20000,
  "notes": "Thank you for choosing TPS BATTERYS HOUSE.",
  "createdAt": "2026-10-28T14:30:00.000Z"
}
```

---

## 4. Invoice Number Generation Algorithm

Invoice numbers are generated dynamically using a collision-free sequential algorithm:

```javascript
const getNextInvoiceNumber = (invoices, prefix = 'TPS/2026-27/') => {
  let maxSeq = 0;
  invoices.forEach((inv) => {
    const invNum = inv.invoiceNumber || '';
    if (invNum.startsWith(prefix)) {
      const numPart = invNum.slice(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });
  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
};
```

### Advantages
- Even if earlier invoices in the list are deleted or re-ordered, the generator always calculates the next integer strictly higher than any existing record, preventing collisions.
