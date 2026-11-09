# TPS BATTERY HOUSE — Pre-Print & Financial Validation Audit

## 1. Scope & Objective
Establish mandatory pre-print and pre-generation validation rules so that no empty or corrupted invoice can be printed or exported as PDF, while ensuring store employees receive clear, actionable feedback on what needs to be fixed.

---

## 2. Validation Engine: `validateInvoiceBeforePrint(invoice)`
Implemented in `src/utils/gstCalculations.js`, this function validates any invoice against 7 core rules:

### Rule 1: At Least One Line Item
```javascript
if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
  errors.push('Your bill is empty. Please add a product or service before printing.');
  return {
    isValid: false,
    errors,
    errorSummary: 'Your bill is empty. Please add a product or service before printing.',
    itemErrors,
    hasEmptyItems: true,
  };
}
```

### Rule 2: Reject Blank or Placeholder Item Names
Rejects blank strings, whitespace-only names, or literal placeholders:
```javascript
const name = (item.name || '').trim();
if (!name || name.toLowerCase() === 'unnamed item' || name.toLowerCase() === 'untitled item') {
  rowErrors.push('Product name/description is required');
}
```

### Rule 3: Valid Product/Service Description
Requires a trimmed non-empty description.

### Rule 4: Valid Positive Finite Quantity
```javascript
const qty = Number(item.qty);
if (isNaN(qty) || !isFinite(qty) || qty <= 0) {
  rowErrors.push('Quantity must be greater than 0');
}
```

### Rule 5: Non-Negative Valid Price (Legitimate Zero-Value Support)
```javascript
const rate = Number(item.rate);
if (isNaN(rate) || !isFinite(rate) || rate < 0) {
  rowErrors.push('Price must be a valid non-negative number');
}
```
*Note:* Rate of `0` is explicitly supported to allow complimentary services, free labor, or zero-charge warranty replacement checkups, while negative prices or NaN are blocked.

### Rule 6: Optional Fields Stay Optional
Fields such as warranty, serial numbers, HSN/SAC, notes, terms, and customer PAN/GSTIN do not block printing if omitted for consumer bills.

### Rule 7: Supported Statutory GST Slabs
```javascript
const gstRate = Number(item.gstRate ?? 18);
if (![0, 5, 12, 18, 28].includes(gstRate)) {
  rowErrors.push(`GST rate ${gstRate}% is not a valid statutory GST slab (0%, 5%, 12%, 18%, 28%)`);
}
```

---

## 3. Pre-Print Enforcement Points
Validation is enforced at every exit point:
1. **`src/App.jsx` (`handlePrint`)**: Invokes `validateInvoiceBeforePrint(invoice)`. If invalid, displays toast alert and aborts.
2. **`src/App.jsx` (`handleDownloadPdf`)**: Validates before downloading vector PDF.
3. **`src/App.jsx` (`handleSaveInvoiceInEditor`)**: Validates before saving to ensure invalid bills cannot enter Firestore.
4. **`src/components/InvoiceForm.jsx`**: Validates before print, save, and export actions; sets validation error state and auto-scrolls to `#section-invoice-items`.
5. **`src/components/invoice/InvoiceSummary.jsx`**: "Save & Print Bill" awaits save validation before initiating print spooler.
6. **`src/utils/pdfExport.js` (`generateVectorPdf`)**: Throws explicit error blocking document creation if validation fails.
7. **`src/utils/pdfExport.js` (`printInvoicePdf`)**: Throws explicit error blocking print iframe/window invocation.

---

## 4. User Experience & Inline Feedback
When validation fails:
- **Red Alert Banner:** Displayed prominently above the items list with specific bullet points detailing each issue.
- **Card Highlight:** Affected item cards receive `border-red-500/80 ring-1 ring-red-500/40 bg-red-950/20` styling.
- **Inline Row Error:** A warning badge (`⚠️ {errors.join(' • ')}`) appears inside the item card right next to the faulty field.
- **Toast Notification:** A red toast notification notifies the user immediately without obscuring the form.

