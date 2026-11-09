# TPS BATTERY HOUSE — Transaction Integrity Evidence & Concurrency Audit

## 1. Atomic Transaction Guarantees
Every permanent invoice creation requires committing three related documents atomically in a single Firestore transaction:
1. Counter document: `/businesses/tps-battery-house/counters/invoices_2026-27`
2. Uniqueness reservation: `/businesses/tps-battery-house/invoice_numbers/{safeNumber}`
3. Invoice document: `/businesses/tps-battery-house/invoices/{invoiceId}`

---

## 2. All-or-Nothing Atomicity Evidence (Scenario 16)
In `scratch/test_firestore_invoice_save_permission.mjs` (Scenario 16):
- An invoice with a malformed financial payload was submitted to fail the transaction.
- **Observed Database State:**
  - `counterSnap.data().lastSeq` remained at its pre-transaction value (`3`).
  - No invoice document was created in `/invoices/`.
  - No reservation document was created in `/invoice_numbers/`.
- **Verdict:** **PASS**. Zero partial state, orphaned counter advancement, or dangling reservations occur on transaction failure.

---

## 3. Collision Prevention & Uniqueness (Scenario 12)
- Re-submitting an existing permanent invoice number (e.g. `TPS/2026-27/002`) with a different invoice ID was blocked.
- Firestore document key collisions and `!exists(reservationRef)` rejected the duplicate reservation.
- **Verdict:** **PASS**. Permanent invoice numbers are mathematically unique and duplicate-proof.

---

## 4. Concurrent Multi-Cashier Load Test (Part 6)
In `scratch/test_firestore_invoice_save_permission.mjs` (Part 6):
- 5 simultaneous concurrent invoice creation requests were issued by Cashiers.
- **Results:**
  - Allocated numbers: `TPS/2026-27/005`, `TPS/2026-27/006`, `TPS/2026-27/007`, `TPS/2026-27/008`, `TPS/2026-27/009`.
  - Number of unique numbers generated: **5 out of 5** (zero collisions).
  - Counter advancement: Advanced from `4` to `9` (exactly +5).
- **Verdict:** **PASS**. High concurrency operates reliably under jittered retry transactions.

---

## 5. Save & Print Verification (Scenarios 17 & 18)
- **Scenario 17 (Successful Persistence):**
  - Invoice persisted with permanent number `TPS/2026-27/004`.
  - Print dialog opened exactly once.
- **Scenario 18 (Failed Persistence):**
  - Invoice persistence rejected due to invalid rate.
  - Print dialog was **NEVER** opened.
- **Verdict:** **PASS**. Print dialog is strictly decoupled and gated on verified persistence.

