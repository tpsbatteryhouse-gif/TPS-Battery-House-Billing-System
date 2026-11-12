# Firestore Invoice Transaction Execution Trace

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**System Location:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-10  
**Scope:** Complete Step-by-Step Transactional Flow of Invoice Creation  

---

## Complete Execution Flow for `createInvoiceWithCounter`

When a staff member (Admin, Store Manager, or Cashier) clicks **Save & Print Bill**:

```
[UI Component: InvoiceSummary.jsx]
   │
   ▼
[handleSaveAndPrint()]
   │
   ▼
[App.jsx: handleSaveInvoiceInEditor()]
   │  - Validates customer particulars (name != '')
   │  - Validates invoice line items (has at least 1 valid item, qty > 0, rate >= 0)
   │  - Normalizes line items & computes canonical netPayable
   │
   ▼
[useInvoices.js: saveInvoice(invoiceData)]
   │  - Extracts active staff member { ...user, role: member.role, permissions }
   │  - Calls createInvoiceWithCounter(businessId, invoiceData, authUser, { prefix })
   │
   ▼
[invoiceService.js: createInvoiceWithCounter()]
   │
   ├─► Pre-Flight Check (Read Only):
   │     getDoc(businesses/{bizId}/counters/invoices_{fy})
   │     • If counter does NOT exist:
   │         - If user.role == 'admin': auto-initializes counter to 0 (or seeds it)
   │         - If user.role != 'admin': throws actionable error:
   │           "Invoice counter for financial year {fy} is not initialized. Please ask a store administrator to initialize the invoice counter."
   │
   └─► Atomic Firestore Transaction:
         runTransaction(firestoreDb, async (transaction) => {
           1. transaction.get(counterRef)
              - Reads current lastSeq (e.g. 8)
              - Computes nextSeq = currentSeq + 1 (e.g. 9)
              - Formats invoiceNumber = "TPS/2026-27/009"
           
           2. transaction.get(numberReservationRef)
              - Checks businesses/{bizId}/invoice_numbers/TPS_2026-27_009
              - Ensures number has never been reserved
           
           3. transaction.get(legacyCounterRef) [Conditional]
           
           4. transaction.set(invoiceDocRef, sanitizedInvoice)
              - businesses/{bizId}/invoices/{id}
              - Contains verified amounts, statutory taxes, audit fields (createdBy, createdAt)
           
           5. transaction.set(numberReservationRef, reservationData)
              - businesses/{bizId}/invoice_numbers/TPS_2026-27_009
              - Links reservation atomically to invoiceId
           
           6. transaction.update(counterRef, {
                lastSeq: 9,
                lastInvoiceId: id,
                lastInvoiceNumber: "TPS/2026-27/009",
                updatedAt: ISO,
                updatedBy: uid
              })
         })
```

---

## Transaction Atomicity Guarantees

1. **All-or-Nothing Guarantee:**
   If any operation inside the transaction fails (e.g. invalid GST calculation, missing counter, permission rejection, or sequence collision), Firestore rolls back the entire transaction. No partial invoice, reservation, or counter update is ever persisted.

2. **Concurrency Serialization:**
   When multiple cashiers create invoices concurrently, Firestore transaction conflicts are resolved through a jittered retry loop (up to 8 attempts). Each cashier receives a strictly monotonic, unique invoice number without collisions or duplicate sequences.

3. **Printing Safety:**
   In `InvoiceSummary.jsx`, printing is triggered strictly after `onSaveInvoice()` resolves with a non-false, valid saved invoice. If invoice persistence fails for any reason, the print dialog is never opened.

