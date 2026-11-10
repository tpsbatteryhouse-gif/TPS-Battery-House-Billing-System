# TPS BATTERY HOUSE — Browser & Runtime Verification Audit

## 1. Scope of Verification
Verification of the UI behavior across user interaction workflows in the running React 19 application:
1. Opening the New Bill workspace and observing initial state.
2. Attempting to click Print on an empty invoice.
3. Adding a line item with an empty name or invalid quantity and clicking Print.
4. Adding valid line items and printing the GST invoice.
5. Opening and editing an existing invoice.

---

## 2. Browser Verification Scenarios & Observations

### Scenario A: New Invoice Initialization (Empty State)
- **Action:** User clicks `+ New Bill` from header or navigation bar.
- **Observed Behavior:**
  - Workspace opens immediately to `#section-invoice-items`.
  - Item count badge shows `0 Items`.
  - Net Payable in sticky summary displays `₹0.00`.
  - What are they buying? section displays the designated empty-state component:
    - Icon: Package icon in amber tone.
    - Heading: "No items added yet".
    - Description: "Select a product from the catalog or add a new item to this bill."
    - Buttons: "Browse Products" (opens catalog modal) and "+ Add Item".
  - **Verdict:** PASS. No "Unnamed Item" or dummy quantity appears.

### Scenario B: Print Validation on Empty Invoice
- **Action:** User immediately clicks `Print`, `PDF`, or `Save & Issue Bill` without adding items.
- **Observed Behavior:**
  - Print dialog does NOT open. Blank or corrupt PDF is NOT generated.
  - Red alert banner mounts above the items section:
    - "Please correct the following issues before saving or printing:"
    - Bullet point: "Your bill is empty. Please add a product or service before printing."
  - Toast notification appears: "Your bill is empty. Please add a product or service before printing."
  - **Verdict:** PASS. Printing is reliably blocked.

### Scenario C: Validation on Incomplete or Blank Item
- **Action:** User clicks `+ Add Item`, leaving product name blank or entering quantity 0, then clicks `Print`.
- **Observed Behavior:**
  - Item card is highlighted with red border and red ring (`border-red-500/80 ring-1 ring-red-500/40 bg-red-950/20`).
  - Warning tag appears inside the card: `⚠️ Product name/description is required • Quantity must be greater than 0`.
  - Red banner lists the specific errors for Item #1.
  - Form smoothly scrolls to the items section.
  - **Verdict:** PASS. User receives clear, pinpoint guidance.

### Scenario D: Populated Invoice Printing
- **Action:** User selects a product from the catalog (e.g. Exide InvaMaster 150Ah at ₹14,800.00), enters quantity 1, then clicks `Print`.
- **Observed Behavior:**
  - Validation passes without errors.
  - Authoritative vector PDF generates in ~60ms.
  - Clean A4 GST invoice renders with complete statutory metadata, PAN, GSTIN, HSN 8507, 28% GST split, bank details, and scannable UPI QR.
  - **Verdict:** PASS.

### Scenario E: Existing Invoice Preservation
- **Action:** User navigates to Invoices list and clicks Edit on a 2-item invoice (`TPS/2026-27/006`).
- **Observed Behavior:**
  - Both items load completely with preserved serials, warranty, pricing, and HSN.
  - Total calculates exactly to ₹13,600.00.
  - No items are dropped or reset.
  - **Verdict:** PASS.

