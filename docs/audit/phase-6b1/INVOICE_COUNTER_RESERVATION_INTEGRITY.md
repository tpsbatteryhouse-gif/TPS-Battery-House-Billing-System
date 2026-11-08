# TPS BATTERY HOUSE — INVOICE, COUNTER & RESERVATION INTEGRITY
## Phase 6B.1 Multi-Document Transactional Integrity & Linkage Report

**Project:** TPS BATTERY HOUSE — GST Billing Application  
**Audit Target:** Invoices (`/invoices`), Sequential Counters (`/counters`), Uniqueness Reservations (`/invoice_numbers`)  
**Service Implementation:** `src/firebase/services/invoiceService.js`  
**Rules Implementation:** `firestore.rules` (Sections 2, 6, 7)  
**Audit Timestamp:** 2026-11-08T14:13:00+05:30  

---

## 1. Multi-Document Transactional Triad

Every non-draft invoice issued in TPS Battery House atomically links three documents within a single Firestore transaction:

```
                    ┌────────────────────────────────────────────────────────┐
                    │               createInvoiceWithCounter                 │
                    │               (Firestore runTransaction)               │
                    └────────────────────────────────────────────────────────┘
                               /                 |                 \
                              /                  |                  \
                             v                   v                   v
              ┌─────────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
              │      invoices       │  │     counters     │  │   invoice_numbers   │
              │  /invoices/{invId}  │  │ /counters/{fyId} │  │ /invoice_numbers/   │
              │                     │  │                  │  │     {safeNum}       │
              │ id: invId           │  │ lastSeq: N+1     │  │ invoiceId: invId    │
              │ invoiceNumber: NUM  │  │ prefix: TPS/FY/  │  │ invoiceNumber: NUM  │
              │ financialYear: FY   │  │ lastInvId: invId │  │ financialYear: FY   │
              │ netPayable: ...     │  │ lastInvNum: NUM  │  │ createdBy: uid      │
              └─────────────────────┘  └──────────────────┘  └─────────────────────┘
```

---

## 2. Verification Results across 12 Security Dimensions

### 2.1 10 Simultaneous Concurrent Requests (High Contention)
- **Test:** Dispatched 10 simultaneous asynchronous `createInvoiceWithCounter` operations contending on the same sequence counter (`invoices_2024-25`).
- **Allocated Invoice Numbers:**
  `TPS/2024-25/001`, `TPS/2024-25/002`, `TPS/2024-25/003`, `TPS/2024-25/004`, `TPS/2024-25/005`, `TPS/2024-25/006`, `TPS/2024-25/007`, `TPS/2024-25/008`, `TPS/2024-25/009`, `TPS/2024-25/010`.
- **Result:**
  - Exactly 10 unique sequential numbers generated.
  - Zero numbering collisions (`Set.size === 10`).
  - Zero sequence gaps: Counter ended on exactly sequence `10`.

### 2.2 Atomic Transaction Rollback on Failure
- **Test:** Injected a failure midway through the transaction after counter increment staging.
- **Result:**
  - Transaction aborted and threw error.
  - Counter sequence in Firestore remained exactly `10` (no partial write, no sequence leakage).

### 2.3 Permanent Reservation Immutability & Deletion Non-Reusability
- **Test:**
  1. An invoice `TPS/2024-25/008` was deleted by Admin.
  2. The invoice record was deleted from `/invoices/`.
  3. The reservation in `/invoice_numbers/TPS_2024-25_008` remained completely intact.
  4. Attempting to update the reservation: Denied (`PERMISSION_DENIED`).
  5. Attempting to delete the reservation: Denied (`PERMISSION_DENIED`).
  6. Attempting to issue a new invoice reusing `TPS/2024-25/008`: Denied with error:
     `Invoice number "TPS/2024-25/008" is already in use and cannot be duplicated.`

### 2.4 Bi-Directional Linkage Rules
- In `firestore.rules`, an invoice cannot be created unless:
  - `counter.lastInvoiceId == invoiceId`
  - `counter.lastInvoiceNumber == invoiceNumber`
  - `reservation.invoiceNumber == invoiceNumber`
  - `reservation.invoiceId == invoiceId`
- Counter increments without an accompanying invoice creation are rejected.

