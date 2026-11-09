# TPS BATTERY HOUSE — INVOICE SCREEN REDESIGN
## 1. DESIGN IMPLEMENTATION SPECIFICATION

**Project:** TPS Battery House — GST Billing & Invoice Management  
**Scope:** New Tax Invoice Screen (`activeView === 'editor'`) Redesign  
**Reference Document:** `Simple New Bill – New Bill.html`  
**Date:** November 9, 2026  
**Status:** COMPLETED & VERIFIED

---

### 1. Architectural Vision & Design Transformation

The primary objective of this phase was to replace the dense, high-friction, spreadsheet-table invoice creation interface with a modern, clean, user-friendly billing experience matching the reference document (`Simple New Bill – New Bill.html`). 

Store employees and cashiers require rapid, error-free operation where:
1. Form sections are logically sequential (numbered circle steps 1, 2, 3).
2. Customer type and payment status use large, touch-friendly choice cards.
3. Invoice line items are presented as spacious cards with stepper controls (`−` / `+`), inline prices, and automatic line totals.
4. Total calculations, statutory GST breakdowns, and primary actions are pinned in a sticky desktop sidebar (`aside aria-label="Bill total"`).
5. Secondary details (purchase orders, transport references, private internal notes, and technical tax settings) are cleanly grouped in a collapsible drawer ("Extra details (not needed for most bills)").

---

### 2. Design Tokens & Visual Hierarchy

The application's global stylesheet (`src/index.css`) was augmented with precision design tokens and utility classes extracted directly from the reference HTML:

| Token / Class | Hex / Dimensions | Visual Role |
| :--- | :--- | :--- |
| **Canvas Background** | `#0F1216` | Main full-page matte dark canvas |
| **Card Container** | `#181C22` | Form section backgrounds with 20px rounded corners |
| **Item Card** | `#12161B` | Individual product card container |
| **Structural Border** | `#2A3039` | 1px clean card and divider boundaries |
| **Field Border** | `#7A7568` | 1.5px high-contrast field borders |
| **Primary Typography** | `#F2EFE9` | Warm off-white legible text |
| **Muted Typography** | `#A8A294` | Secondary text, hints, and unit labels |
| **Accent Amber** | `#F2A516` | Circle steps, focus borders, primary CTA background |
| **Hero Net Amount** | `#FFC857` | 42px bold monetary payable figure |
| **Highlight Container**| `#2A2210` / `#5C4513` | Amber-tinted hero summary box |
| **Active Choice/Pill** | `#3A2D0C` / `3px #F2A516` | Selected state for buttons and choice cards |

#### Extracted Utility Classes
- `.inv-fld`: 52px height, 16px/18px font, `#0F1216` background, 1.5px `#7A7568` border, rounded-xl.
- `.inv-pill`: 52px min-height, 22px padding, `#20262E` background, rounded-xl; `.on` variant adds 3px amber border and `#3A2D0C` fill.
- `.inv-choice`: Flex container with large titles and subtitles; selected card receives 3px amber border.
- `.inv-chip`: 44px touch target, rounded-full pill for quick catalog additions.
- `.inv-step`: 40px circle with `#F2A516` amber background, bold number in `#1F1A14`.
- `.inv-link`: Underlined text button with 3px underline offset.

---

### 3. Screen Structure & Layout

The redesigned invoice screen implements a two-column layout (`max-w-[1240px] mx-auto px-4 sm:px-6 py-6 pb-24`):

1. **Header Area (`InvoicePageHeader.jsx`)**:
   - `← Back` link navigating to dashboard.
   - Page title `New Bill` with dynamic subtitle: `Bill number TPS/2026-27/--- · [Date] · Regular customer (B2C)`.
   - Header action toolbar: `Load Sample`, `Settings`, and `Clear everything` (`onReset`).

2. **Left Panel (`lg:col-span-7 xl:col-span-8 space-y-6`)**:
   - **Step 1: Who is buying? (`CustomerDetailsSection.jsx`)**:
     - B2C vs B2B choice cards.
     - Inline search autocomplete with directory lookup and "Browse Directory" modal trigger.
     - Customer name, phone number, address, and conditional B2B GSTIN input.
   - **Step 2: What are they buying? (`InvoiceItemsSection.jsx` & `InvoiceItemRow.jsx`)**:
     - Card-based line item list with stepper buttons, price each, line total, and remove link.
     - Collapsible advanced GST/item specs for technical editing.
     - Quick-add chip row (`+ Exide...`, `+ Amaron...`, `+ Battery`, `+ Inverter`, `+ Solar`, `+ Service`).
     - "See all items" modal trigger.
     - "+ Give a discount" and "+ Customer is giving an old battery" deduction toggles.
   - **Step 3: How is the customer paying? (`InvoicePaymentSection.jsx`)**:
     - "Paid now" vs "Pay later" choice cards.
     - Payment mode pills (`Cash`, `UPI`, `Card`, `Bank transfer`).
     - Dynamic UPI QR notification note.
     - Customer message textarea for invoice footer.
   - **Collapsible Section: Extra details (`InvoiceMetadataSection.jsx`)**:
     - Accordion drawer with purchase order number, delivery/shipping address, e-way bill number, staff private notes, invoice date, due date, and reverse charge.

3. **Right Panel (`lg:col-span-5 xl:col-span-4 sticky top-6`)**:
   - **Bill Total Sidebar (`InvoiceSummary.jsx`)**:
     - Header overview: Customer type, customer name, item count, and payment state.
     - Financial breakdown: Gross subtotal, discounts, old battery credit, price before GST, statutory GST breakdown, and round-off adjustment.
     - Hero highlight box: "Customer pays" with prominent `₹XX,XXX.00` figure.
     - Amount in words.
     - Action buttons: "Save & Print Bill" (primary CTA), "Send on WhatsApp", "Preview", "PDF", and "Save for later".

