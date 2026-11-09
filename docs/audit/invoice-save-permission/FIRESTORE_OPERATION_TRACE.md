# TPS BATTERY HOUSE — Firestore Operation Trace
## Complete Transaction & Document Lifecycle Trace

**Event Trigger:** User clicks **Save & Print Bill** on the New Tax Invoice Screen.  
**Active Actor:** Navaneeth P.P (Role: `manager`, Status: `active`, UID: `manager_uid`).  
**Context Business ID:** `tps-battery-house`  
**Financial Year:** `2026-27`

---

## 1. Execution Call Stack

```
[UI] InvoiceSummary.jsx -> handleSaveAndPrint()
  └─> [Form] InvoiceForm.jsx -> handleSaveInvoice()
        └─> [Validation] runValidation() -> customer name & validateInvoiceBeforePrint()
        └─> [App] App.jsx -> handleSaveInvoiceInEditor()
              └─> [Hook] useInvoices.js -> saveInvoice(invoiceToSave)
                    └─> [Service] invoiceService.js -> createInvoiceWithCounter()
```

---

## 2. Granular Firestore Operations Sequence

The invoice creation workflow executes in two distinct phases:

### Phase A: Pre-Flight Counter Existence Verification (Non-Transactional)
Before entering the Firestore transaction, the client verifies counter existence:

1. **Operation:** `getDoc(counterRef)`
   - **Path:** `/businesses/tps-battery-house/counters/invoices_2026-27`
   - **Rule Evaluated:**
     ```javascript
     match /counters/{counterId} {
       allow read: if isActiveMember(businessId);
     }
     ```
   - **Result:** Allowed for active Staff (`admin`, `manager`, `cashier`).
   - **Conditional Branching:**
     - **If exists:** Proceed to Phase B.
     - **If missing & Actor is Admin:** Admin triggers `initializeInvoiceCounter()` creating the counter document via `setDoc`.
     - **If missing & Actor is Manager/Cashier:** Abort with informative user error:
       `"Invoice counter for financial year 2026-27 is not initialized. Please ask a store administrator to initialize the invoice counter."`
       *(Prevents unauthorized transaction attempt and stops cryptic `PERMISSION_DENIED`).*

---

### Phase B: Atomic Billing Transaction (`runTransaction`)
All subsequent operations execute inside a single atomic Firestore transaction:

2. **Operation:** `transaction.get(counterRef)`
   - **Path:** `/businesses/tps-battery-house/counters/invoices_2026-27`
   - **Reads:** `lastSeq`, `prefix`, `lastInvoiceNumber`, `lastInvoiceId`.
   - **Derivation:** `nextSeq = currentSeq + 1` (e.g. `6 + 1 = 7`), `finalInvNumber = "TPS/2026-27/007"`.

3. **Operation:** `transaction.get(legacyCounterRef)`
   - **Path:** `/businesses/tps-battery-house/counters/invoices`
   - **Reads:** Reads fallback legacy counter.

4. **Operation:** `transaction.get(reservationRef)`
   - **Path:** `/businesses/tps-battery-house/invoice_numbers/TPS_2026-27_007`
   - **Check:** Asserts `!reservationSnap.exists()` to guarantee no duplicate invoice numbers.

5. **Operation:** `transaction.set(counterRef, counterData, { merge: true })`
   - **Path:** `/businesses/tps-battery-house/counters/invoices_2026-27`
   - **Rule Evaluated (`firestore.rules` L762-L796):**
     - Checks monotonic increment: `lastSeq == resource.data.lastSeq + 1` (7 == 6 + 1 ✓)
     - Checks prefix unchanged: `prefix == resource.data.prefix` (`TPS/2026-27/` ✓)
     - Checks regex match: `lastInvoiceNumber.matches('^' + prefix + '0*' + lastSeq + '$')` (`TPS/2026-27/007` ✓)
     - Checks bidirectional link: `existsAfter(invoiceDocRef)` and `getAfter(invoiceDocRef).data.invoiceNumber == lastInvoiceNumber` ✓
   - **Result:** PERMITTED for Manager.

6. **Operation:** `transaction.set(reservationRef, reservationData)`
   - **Path:** `/businesses/tps-battery-house/invoice_numbers/TPS_2026-27_007`
   - **Rule Evaluated (`firestore.rules` L814-L822):**
     - Checks `!exists(reservationRef)` ✓
     - Checks `isValidInvoiceReservation(reservationData)` ✓
     - Checks linked invoice exists in same transaction: `existsAfter(invoiceDocRef)` ✓
   - **Result:** PERMITTED.

7. **Operation:** `transaction.set(invoiceDocRef, sanitized)`
   - **Path:** `/businesses/tps-battery-house/invoices/inv_1741..._007`
   - **Rule Evaluated (`firestore.rules` L580-L627):**
     - Checks `isActiveMember(businessId)` ✓
     - Checks `request.resource.data.keys().hasOnly([...])` ✓
     - Checks `isValidInvoice(request.resource.data, invoiceId)` ✓
     - Checks pre-existing counter exists: `exists(counters/invoices_2026-27)` ✓
     - Checks uniqueness reservation exists after: `existsAfter(reservationRef)` ✓
     - Checks counter increment matches after: `getAfter(counterRef).data.lastInvoiceId == invoiceId` ✓
   - **Result:** PERMITTED.

---

## 3. Post-Save Contract & Print Handoff
1. The transaction commits atomically.
2. `createInvoiceWithCounter` returns the persisted invoice object with permanent number `TPS/2026-27/007`.
3. `App.jsx` syncs state and returns `saved`.
4. `InvoiceSummary.jsx` verifies `saved.invoiceNumber` is permanent and valid.
5. `onPrint()` is triggered: vector PDF compiles and the browser print dialog opens with the authoritative invoice.

