# Operator User Guide — TPS BATTERYS HOUSE

This guide provides operational instructions for managing multi-category sales, product catalog entries, mixed-category invoices, GST calculations, and vector PDF exports in the **TPS BATTERYS HOUSE** billing application.

---

## 1. Navigating the Application

The top navigation header provides continuous access to all system modules:

1. **Dashboard:** KPI summary metrics, Category Sales distribution bars (Batteries, Inverters, Solar, Services), and category-filtered recent invoices.
2. **Invoices:** Searchable, sortable list of all registered invoices with category tags.
3. **Tax Bill Generator:** Full dual-panel Kerala GST billing workspace with live A4 preview.
4. **Catalog:** Centralized Product Catalog for managing Battery, Inverter, Solar, and Service items.
5. **Settings (Gear Icon):** Edit business details, GSTIN, bank credentials, and UPI ID.
6. **Operator Profile (Initials Avatar):** Access operator profile and demo authentication controls.

---

## 2. Using the Product Catalog

The Product Catalog lets operators maintain a standard list of items across all four categories:

### A. Browsing & Filtering Products
1. Click the **Catalog** tab in the top header.
2. Filter items by category using the category pills:
   - **All Categories:** Shows complete inventory catalog.
   - **Battery:** Storage, automotive, tubular, and solar batteries.
   - **Inverter:** Home, hybrid, and solar inverters/UPS.
   - **Solar:** Solar panels, charge controllers, cables, and solar kits.
   - **Services:** Installation, mounting, AMC, and repair services.
3. Filter by **Brand** (e.g. *Exide, Amaron, Luminous, Microtek, Waaree, Tata*) using the brand dropdown.
4. Search items by model, brand, SKU, or rating (e.g. `150Ah`, `1100VA`, `550W`).

### B. Adding a New Product
1. Click **`+ Add New Product`**.
2. Select the product category (**Battery**, **Inverter**, **Solar**, or **Services**).
3. Fill in the relevant technical specifications:
   - **Battery:** Capacity (`Ah`), Voltage (`12V/24V`), Technology (`Tall Tubular`, `Lithium`, etc.).
   - **Inverter:** Rating (`VA`), Power (`Watts`), Waveform (`Pure Sine Wave`), Voltage.
   - **Solar:** Wattage (`Wp`), Technology (`Mono PERC`, `Bifacial`), System Capacity (`kW`).
   - **Services:** Scope of work and warranty terms (physical fields are hidden).
4. Set HSN/SAC code, GST rate (e.g. 28% for batteries, 18% for inverters/services, 12% for solar), unit of measurement, and selling price.
5. Click **`Save Product`**.

### C. Adding a Catalog Item Directly to an Active Bill
Click **`Add to Bill`** on any product card in the catalog. The item is instantly appended to the active draft invoice with its specifications, HSN, and GST rate, and you are taken to the Tax Bill Studio.

---

## 3. Creating Invoices & Setting Transaction Types

### A. Selecting Transaction Type
The Tax Bill Generator and Quick Create Modal include a dedicated **Transaction Type Classification** selector:
- **B2B (Business to Business):**
  - Used for registered business buyers claiming Input Tax Credit (ITC).
  - Displays **Buyer Business Name** and **Buyer GSTIN** fields.
  - Automatically runs real-time 15-character statutory GSTIN format validation (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`).
  - Invoice header title renders as **TAX INVOICE (B2B)**.
- **B2C (Business to Consumer):**
  - Used for retail consumers, home solar users, and private vehicle battery buyers.
  - Displays customer name, phone number, and delivery address.
  - Hides or optionalizes the buyer GSTIN to eliminate false validation blocks.
  - Invoice header title renders as **RETAIL TAX INVOICE (B2C)**.
- **SEZ / Export / Deemed Export:**
  - Configurable transaction types with destination indicators for special economic zone supplies, physical exports, or deemed export supplies.

### B. Mixed-Category Line Items Billing
A single invoice can combine products from different categories (e.g., *Waaree 550W Solar Panel + Luminous Inverter + Exide Tubular Battery + Solar Installation Service*).

1. In the **Tax Bill Generator**, navigate to the **Line Items** tab.
2. To add a product:
   - Click **`Browse Full Catalog`** to pick from your pre-configured catalog items.
   - Click any **Quick Item Catalogue** preset chip.
   - Or click **`+ Add Battery`**, **`+ Add Inverter`**, **`+ Add Solar`**, or **`+ Add Service`** to create a blank line item.
3. For each item:
   - Fill in product name/model.
   - Enter specifications (capacity, wattage, technology, waveform).
   - Verify HSN code and applicable GST rate.
   - Enter quantity and selling rate. Both decimal quantities (e.g. `1.5 kW`, `2.5 Sets`) and fractional currency prices (e.g. `₹1,234.56`) are fully supported.
   - Toggle pricing mode: **`Incl. GST (MRP)`** or **`Excl. GST + Tax`**.
4. Each item calculates its taxable amount and applicable tax independently.

### C. Old Battery Scrap Buyback (Battery Exclusive)
1. Go to the **Scrap & Discounts** tab.
2. If the customer is replacing an old battery, toggle **`Old Battery Scrap Buyback / Exchange`**.
3. Enter the scrap description (e.g., *Old 150Ah Scrap Battery Buyback*) and scrap allowance amount (e.g., `₹2,500`).
4. The scrap amount is subtracted transparently before net payable calculation.

---

## 4. Understanding Dashboard Metrics & Category Sales

The Dashboard provides non-double-counted insights into business performance:
- **Total Invoices / Paid / Pending:** Transaction volume and payment status tracking.
- **Collected Revenue:** Total funds received exclusively from settled (`Paid`) invoices.
- **Category Sales Performance:** Displays revenue generated by category across all items:
  - **Battery Sales (₹):** Total gross billing from battery products.
  - **Inverter Sales (₹):** Total gross billing from inverters and UPS systems.
  - **Solar Sales (₹):** Total gross billing from solar panels, controllers, and equipment.
  - **Service Revenue (₹):** Total gross billing from installation and maintenance services.
- **Category Filter:** Filter the recent invoices table by category to inspect transactions for specific equipment lines.

---

## 5. Exporting & Printing Invoices

### A. True A4 Geometry & Bottom-Anchored Layout
The invoice layout strictly adheres to standard A4 portrait specifications (210 mm width × 297 mm height):
- **Single-Page Invoices:** Dynamic vertical table spacer lines extend downward to 202.5 mm, ensuring that the Subtotal, Amount in Words, Statutory GST Computation Table, boxed `Bill Amount`, Bank Details, Terms & Conditions, UPI QR, and Signature block are anchored towards the bottom margin (~284 mm) without leaving vast empty gaps in the middle of the bill.
- **Multi-Page Invoices:** When an invoice contains more than 5 or 6 items, content flows naturally across continuation pages with repeating table headers, consistent print margins, and bottom pagination (`Page 1 of 2`).

### B. Vector PDF Download
1. Click **`Download PDF`** in the Tax Bill Generator header.
2. The system generates a lightweight vector PDF (~78 KB - 96 KB) containing:
   - Business branding, GSTIN `32DIUPP1211B2ZN`, and transaction type badge.
   - Buyer details, consignee shipping address, and place of supply.
   - Itemized line items table with category specifications and warranty details.
   - Multi-HSN statutory GST tax computation summary.
   - Bank details and dynamic UPI "Scan to Pay" QR Code.
   - Authorized signatory box and terms.
3. The PDF is saved directly to your Downloads folder.

### C. Direct Printing
Click **`Print`** to launch the browser's native print preview. Dedicated `@media print` CSS ensures clean A4 margins with navigation headers automatically omitted.

---

## 6. Saving, Editing, and Data Integrity

The application enforces strict data immutability and save stability safeguards:
- **No Silent Value Modifications:** Saving a bill persists exactly what the operator entered. Rates, quantities, discounts, and tax values never change unless explicitly edited.
- **Idempotent Repeated Saves:** Opening an invoice, saving it without changes, or saving it repeatedly produces identical values without duplicating records.
- **Pricing Mode Protection:** MRP-inclusive prices never have GST deducted twice during save cycles.
- **Decimal Precision:** Unit rates and fractional quantities are preserved without integer rounding truncation.
- **Phone Preservation:** Customer mobile numbers preserve prefixes (e.g. `+91 9846830532`) without premature 10-digit truncation.
