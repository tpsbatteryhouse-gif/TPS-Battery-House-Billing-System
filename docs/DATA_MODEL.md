# Data Model Specification — TPS BATTERYS HOUSE

This document defines the schema, data types, validation rules, category metadata, and persistence keys used throughout the multi-category application.

---

## 1. Storage Keys

| Key | Format | Default Behavior if Missing |
| :--- | :--- | :--- |
| `tps_invoice_records` | JSON Array of `Invoice` objects | Initialized with `INITIAL_MOCK_INVOICES`. Existing legacy records lacking `category` are safely normalized upon reading. |
| `tps_product_catalog` | JSON Array of `ProductCatalogItem` objects | Initialized with `INITIAL_PRODUCT_CATALOG` (14 pre-seeded TPS products). |
| `tps_invoice_draft` | Single JSON `Invoice` object | Initialized with `getSampleInvoiceData()` (multi-category sample). |
| `tps_business_profile` | Single JSON `BusinessProfile` object | Initialized with `DEFAULT_BUSINESS`. |

---

## 2. Entity Schemas

### A. Invoice Entity (`Invoice`)

| Field | Type | Required | Description & Validation Rules |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Yes | Unique internal identifier (e.g., `inv-1793202930-101`). |
| `invoiceNumber` | `String` | Yes | Formatted sequential number (e.g., `TPS/2026-27/008`). Auto-incremented based on maximum existing sequence. |
| `transactionType` | `String` (Enum) | Yes | `'B2B'` \| `'B2C'` \| `'SEZ'` \| `'EXPORT'` \| `'DEEMED_EXPORT'`. Inferred via `inferTransactionType` for legacy records. |
| `invoiceDate` | `String` (ISO Date `YYYY-MM-DD`) | Yes | Date bill was issued. Must be a valid date string. |
| `dueDate` | `String` (ISO Date `YYYY-MM-DD`) | Yes | Payment due date. Must be equal to or later than `invoiceDate`. |
| `paymentStatus` | `String` (Enum) | Yes | `'Draft'` \| `'Pending'` \| `'Paid'` \| `'Overdue'`. |
| `paymentMode` | `String` (Enum) | Yes | `'Cash'` \| `'UPI / QR Code'` \| `'Bank Transfer'` \| `'Credit'`. |
| `placeOfSupply` | `String` | No | Default: `'Kerala (32)'`. |
| `reverseCharge` | `String` | No | `'No'` (default) or `'Yes'`. |
| `customer` | `Customer` | Yes | Embedded customer record object. |
| `items` | `Array<LineItem>` | Yes | Array of purchased multi-category goods/services (minimum 1). |
| `scrapExchange` | `ScrapExchange` | No | Battery-exclusive trade-in allowance details. |
| `additionalDiscount`| `Number` | No | Special discount concession in ₹ (must be >= 0). Default: `0`. |
| `roundOffManual` | `Number` \| `null` | No | Custom rounding adjustment in ₹. If `null`, auto-rounded to nearest rupee. |
| `netPayable` | `Number` | Yes | Final payable amount in ₹ (calculated). |
| `notes` | `String` | No | Customer warranty remark or service note. |
| `createdAt` | `String` (ISO 8601) | Yes | Creation timestamp. |

---

### B. Transaction Type Configuration (`TRANSACTION_TYPE_CONFIG`)

Defined in [`src/utils/categories.js`](../src/utils/categories.js):

| Key | Label | Requires GSTIN | Default Title | Description |
| :--- | :--- | :--- | :--- | :--- |
| `B2B` | Business to Business | Yes (Recommended) | `TAX INVOICE (B2B)` | Regular GST registered entity claiming Input Tax Credit. |
| `B2C` | Business to Consumer | No (Hidden/Optional) | `TAX INVOICE (B2C)` | Unregistered end-user consumer sales. |
| `SEZ` | Special Economic Zone | Optional | `TAX INVOICE (SEZ)` | Supply to SEZ developer or unit under bond/LUT. |
| `EXPORT` | Export | Optional | `TAX INVOICE (EXPORT)` | Physical cross-border international supplies. |
| `DEEMED_EXPORT`| Deemed Export | Optional | `TAX INVOICE (DEEMED EXPORT)`| Domestic supplies treated as exports under GST act. |

---

### C. Multi-Category Line Item Entity (`LineItem`)

| Field | Type | Required | Description & Validation Rules |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Yes | Unique item ID (e.g., `item-101`). |
| `name` | `String` | Yes | Product name / service description. |
| `category` | `String` (Enum) | Yes | `'battery'` \| `'inverter'` \| `'solar'` \| `'services'`. If absent in legacy data, safely inferred via `normalizeInvoiceItem`. |
| `subcategory` | `String` | No | Detailed subcategory (e.g., `'Tubular Battery'`, `'Solar Installation'`). |
| `brand` | `String` | No | Brand name (e.g., `'Exide'`, `'Luminous'`, `'Waaree'`, `'Tata'`). |
| `model` | `String` | No | Model designation (e.g., `'IT500'`, `'EcoVolt 1050'`, `'WXS-550'`). |
| `specs` | `Object` | Yes | Key-value technical specifications (e.g., `{ capacity: '150Ah', voltage: '12V' }`). |
| `hsn` | `String` | Yes | HSN/SAC code (e.g., `8507`, `8504`, `8541`, `9954`). |
| `serialNo` | `String` | No | Serial number(s) or job reference (not forced on services). |
| `warranty` | `String` | No | Warranty duration (e.g., `'36 Months'`, `'25 Years Performance'`). |
| `qty` | `Number` | Yes | Quantity purchased. Supports positive decimals (e.g. `1.5 kW`, `2.5`). |
| `unit` | `String` | Yes | Unit of measurement (`'Nos'`, `'Set'`, `'Piece'`, `'Watt'`, `'kW'`, `'Meter'`, `'Job'`, `'Service'`). |
| `rate` | `Number` | Yes | Unit selling price in ₹ (must be >= 0, preserves exact decimal cents). |
| `discount` | `Number` | No | Item-level discount concession in ₹ (must be >= 0). Default: `0`. |
| `isTaxInclusive` | `Boolean` | Yes | If `true`, rate includes GST (MRP). If `false`, GST is added on top. |
| `gstRate` | `Number` | Yes | Tax slab percentage (`28`, `18`, `12`, `5`, `0`). |

---

### C. Product Catalog Item Entity (`ProductCatalogItem`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | Yes | Unique product identifier (e.g., `prod-001`). |
| `sku` | `String` | Yes | Product SKU (e.g., `TPS-BAT-150-IT500`). |
| `name` | `String` | Yes | Full product or service title. |
| `category` | `String` (Enum) | Yes | `'battery'` \| `'inverter'` \| `'solar'` \| `'services'`. |
| `subcategory` | `String` | Yes | Subcategory string from `CATEGORY_CONFIG`. |
| `brand` | `String` | No | Manufacturer brand name. |
| `model` | `String` | No | Model number or series. |
| `description`| `String` | No | Marketing description or details. |
| `specs` | `Object` | Yes | Category technical specifications. |
| `unit` | `String` | Yes | Default unit of measurement. |
| `hsn` | `String` | Yes | Statutory HSN/SAC code. |
| `sellingPrice`| `Number`| Yes | Default retail selling price in ₹. |
| `costPrice` | `Number` | No | Internal purchase cost (never shown on customer invoices). |
| `gstRate` | `Number` | Yes | Configurable GST rate percentage. |
| `isTaxInclusive`| `Boolean`| Yes | Whether selling price includes GST. |
| `warranty` | `String` | No | Standard warranty duration. |
| `status` | `String` | Yes | `'active'` \| `'inactive'`. |
| `createdAt` | `String` | Yes | ISO creation timestamp. |
| `updatedAt` | `String` | No | ISO last updated timestamp. |

---

### D. Customer Record (`Customer`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `String` | Yes | Customer or company name. Cannot be blank. |
| `phone` | `String` | No | 10-digit mobile number for contact & WhatsApp. |
| `address` | `String` | No | Street address or building name. |
| `city` | `String` | No | City or town (e.g., `'Thrithala'`). |
| `district` | `String` | No | District (e.g., `'Palakkad'`). |
| `state` | `String` | No | State (e.g., `'Kerala'`). |
| `stateCode` | `String` | Yes | GST State code (e.g., `'32'`). Default: `'32'`. |
| `pincode` | `String` | No | 6-digit postal code (e.g., `'679552'`). |
| `gstin` | `String` | No | 15-character GSTIN for B2B buyers. Leave empty for B2C consumer bills. |

---

### E. Scrap Battery Exchange Entity (`ScrapExchange`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `Boolean` | Yes | Flag indicating whether old battery scrap buyback was applied. |
| `description` | `String` | No | Scrap battery model or capacity (e.g., `'Old 150Ah Scrap Battery Buyback'`). |
| `amount` | `Number` | Yes | Scrap trade-in allowance deducted from invoice total in ₹ (must be >= 0). |
