# TPS BATTERY HOUSE — Root Cause Analysis of Invoice Form State Mutations

## 1. Primary Bug: Old Battery Value Instability
### Symptom
In user testing and operational entry (e.g. creating invoice `TPS/2026-27/008` for Palakkad Auto Electricals with a ₹15,500 battery, ₹1,000 discount, and ₹1,497 old battery value), the Old Battery Value and related fields exhibited input instability, cursor jumping, decimal truncation, and desynchronization when interacting with adjacent form controls.

### Root Causes
1. **Unsynchronized Child Component State (`useState` vs Props):**
   In `InvoiceItemsSection.jsx`, visibility of the Old Battery Value input was managed via:
   ```javascript
   const [showExchange, setShowExchange] = useState(() => Boolean(invoice?.scrapExchange?.enabled || ...));
   ```
   Because `useState` initial state runs only on initial mount, subsequent external updates to `invoice` (e.g., sample invoice loading, invoice form reset, or switching customers) failed to update `showExchange`. As a result, the input remained hidden or stuck open, and clicking "Remove" or "+ Customer is giving an old battery" executed inverted operations.
2. **Consecutive Unbatched State Dispatches:**
   When editing the scrap exchange value, `handleExchangeAmountChange` dispatched two separate `onUpdateField` calls:
   ```javascript
   onUpdateField('scrapExchange.amount', num);
   if (!invoice?.scrapExchange?.enabled) onUpdateField('scrapExchange.enabled', true);
   ```
   In React, separate unbatched calls created intermediate states where `amount` was updated while `enabled` remained stale or vice-versa.
3. **Premature Keystroke Parsing & Decimal Truncation:**
   Applying `parseFloat(e.target.value)` on every keystroke immediately converted strings like `"1497."` to `1497`, stripping the decimal point and jumping cursor position. Furthermore, typing `"0"` triggered `value={scrapVal === 0 ? '' : scrapVal}`, instantly erasing the user's `0`.
4. **Unconditional Default Overwrites on Persistence:**
   `App.jsx` and `invoiceService.js` used:
   ```javascript
   description: invoice.scrapExchange?.description || 'Old 150Ah Scrap Battery Buyback'
   ```
   which silently wiped out custom descriptions or intentionally blank notes.

---

## 2. Secondary Bug: B2B / B2C Toggle Inability
### Symptom
When a customer record or text had a GSTIN, clicking the "Regular customer (B2C)" card failed to switch the UI into B2C mode. The B2B card remained highlighted, the GST number field stayed visible, and the header retained B2B designation.

### Root Cause
In `CustomerDetailsSection.jsx`:
```javascript
const isB2B = transactionType === TRANSACTION_TYPES.B2B || Boolean(gstinVal && gstinVal.length >= 10);
```
Even when the user explicitly selected `TRANSACTION_TYPES.B2C`, the presence of a 10+ character GSTIN forced `isB2B` to `true`. Furthermore:
```javascript
if (type === TRANSACTION_TYPES.B2C && !customer?.gstin) onUpdateField('customer.gstin', '');
```
prevented clearing or disassociating the GSTIN because `!customer?.gstin` was false when a GSTIN existed.

---

## 3. Secondary Bug: Delivery Address Erasure on Customer Selection
### Symptom
If a store operator entered a delivery address in "Extra details" and subsequently picked a customer from the customer directory, the typed delivery address was wiped clean.

### Root Cause
In `InvoiceForm.jsx`:
```javascript
shippingAddress: cust.shippingAddress || ''
```
If the directory customer record did not have a dedicated `shippingAddress`, it set `shippingAddress: ''`, overwriting `prev.customer.shippingAddress`.

---

## 4. Secondary Bug: Reverse Charge Checkbox False-Positive
### Symptom
The "Reverse Charge Applicable" toggle in "Extra details" appeared permanently checked by default on new bills, but printed as "No" in the PDF.

### Root Cause
In `defaults.js`, `reverseCharge` was initialized as `'No'`. In JavaScript:
```javascript
Boolean('No') === true;
```
In `InvoiceMetadataSection.jsx`:
```javascript
checked={invoice?.reverseCharge || false}
```
Because non-empty strings are truthy, the checkbox evaluated to `checked=true`.

