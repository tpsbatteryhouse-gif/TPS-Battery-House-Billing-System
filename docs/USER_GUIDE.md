# Operator User Guide — TPS BATTERYS HOUSE

This guide provides step-by-step instructions for operating the **TPS BATTERYS HOUSE** Invoice Management Application.

---

## 1. Navigating the Application

The header bar at the top of the screen provides continuous access to all core sections:

1. **Dashboard:** Displays business summary cards, current local time, and recent invoices.
2. **Invoices:** Opens the full searchable invoice table with sorting options.
3. **Tax Bill Generator:** Opens the dual-panel Kerala GST billing workspace with live A4 preview.
4. **Settings (Gear Icon):** Allows editing store name, GSTIN, bank details, and UPI ID.
5. **Operator Profile (Initials Avatar):** Accesses simulated operator profile and sign-out controls.

---

## 2. Using the Home Dashboard

### A. Understanding Summary Cards
The four summary cards at the top of the dashboard reflect the current state of all recorded invoices:
- **Total Invoices:** Total number of registered invoices (including drafts).
- **Paid:** Count of settled invoices with the percentage collection rate.
- **Pending:** Number of invoices awaiting customer payment with total uncollected balance.
- **Total Revenue:** Sum of all collected funds from paid invoices formatted in Indian Rupees (`₹`).

### B. Searching for an Invoice
1. Locate the search bar in the **Recent Invoices** section (placeholder: *"Search by invoice number or client name..."*).
2. Type an invoice number (e.g., `TPS/2026-27/001`) or a customer name (e.g., `Rajesh`).
3. Results filter in real time as you type (case-insensitive).
4. Click the **`X`** button inside the search field to clear your query.

### C. Filtering by Payment Status
Click any of the status filter tabs above the invoice list:
- **All:** Displays all invoices regardless of status.
- **Paid:** Invoices with confirmed settlement.
- **Pending:** Unpaid invoices within payment terms.
- **Overdue:** Invoices where the due date has elapsed without payment.
- **Draft:** Work-in-progress quotations or unsaved orders.

---

## 3. Creating a New Invoice

You can create an invoice using either the **Quick Create Modal** or the **Full GST Studio**.

### Method 1: Quick Create Modal (Recommended for fast counter sales)
1. Click the **`+ New Invoice`** button in the welcome section or click the gold **Floating Action Button (FAB)** in the bottom-right corner.
2. Review the auto-generated **Invoice Number** (e.g., `TPS/2026-27/008`).
3. Enter the **Client Name** (required).
4. Enter the **Contact Phone** (optional 10-digit mobile number).
5. Verify the **Invoice Date** (defaults to today) and **Due Date** (defaults to 7 days ahead).
6. Select the **Payment Status** (`Draft`, `Pending`, `Paid`, or `Overdue`).
7. In the **Line Items** section:
   - Enter item description (e.g., `Fuze 1100 Inverter + 150 Ah Tubular Battery`).
   - Enter **Quantity** (must be 1 or greater).
   - Enter **Unit Price** in ₹ (must be 0 or greater).
   - Click **`+ Add Item`** to add additional products.
8. Review the **Calculated Total Payable**.
9. Click **`Save Invoice`**. The invoice is immediately saved, and dashboard cards update in real time.

### Method 2: Full GST Billing Studio (For tax invoices, HSN codes, and scrap exchange)
1. Click **Tax Bill Generator** in the top navigation bar (or click *"Open in Full GST Tax Bill Studio"* from the modal).
2. Fill out customer details, including optional B2B Customer GSTIN.
3. Select from **Quick Item Catalogue** buttons (e.g., *Fuze 1100 Combo*, *Amaron 150Ah*, *Exide InvaMaster*) to populate items in one click.
4. Toggle pricing mode: **`Incl. GST (MRP)`** or **`Excl. GST + Tax`**.
5. Enable **Old Battery Scrap Buyback** if customer exchanges an old battery, and enter scrap allowance (e.g., `₹2,000`).
6. Click **`Save Bill`** to store the invoice into the system.

---

## 4. Printing & Downloading Invoices

### Downloading a PDF
1. Open the invoice in the **Tax Bill Generator**.
2. Click the gold **`Download PDF`** button in the action bar.
3. The application generates a high-resolution, vector-crisp A4 PDF named:
   ```text
   TPS_[InvoiceNumber]_[CustomerName].pdf
   ```
4. The file saves directly to your device's default download folder.

### Printing via Printer
1. Click the **`Print Bill`** button.
2. The browser's native print preview dialog opens.
3. The layout automatically uses dedicated `@media print` rules:
   - Margins are preset to standard A4 (portrait).
   - Headers, navigation bars, and action buttons are automatically hidden.
   - Borders and table lines remain crisp without text clipping.

### WhatsApp Sharing
1. Click the green **`WhatsApp`** button.
2. A pre-formatted summary text with invoice number, client name, item list, total net amount, and store phone number opens directly in WhatsApp Web or mobile app.

---

## 5. Managing Records & Store Settings

### Viewing All Invoices
1. Click **Invoices** in the top navigation bar or click **View All Invoices** from the dashboard.
2. Use the sort dropdown to order invoices by **Newest First**, **Oldest First**, **Amount: High to Low**, or **Amount: Low to High**.
3. Click the **Trash** icon next to any invoice to permanently delete it (confirmation prompt required).

### Customizing Store Profile & Bank Details
1. Click the **Settings (Gear Icon)** in the top header.
2. Update the store name, contact phone numbers, or road address.
3. Update the **Bank Name**, **Account Number**, **IFSC Code**, and **Branch**.
4. Enter your shop's **UPI ID** (e.g., `9846830532@okaxis`). The dynamic QR code printed on invoices automatically updates to route payments to this ID.
5. Click **`Save Changes`**.

---

## 6. Simulated Operator Profile & Sign-Out

1. Click the **AJ** operator badge in the top right.
2. Select **My Profile** to view operator credentials (`Alex Johnson`, `Administrator`) and the assigned branch.
3. Select **Sign Out (Reset Demo)** to simulate ending the operator session.
4. A dedicated demo lock screen appears. Click **Sign In as Alex Johnson (Demo)** to resume dashboard operations.
