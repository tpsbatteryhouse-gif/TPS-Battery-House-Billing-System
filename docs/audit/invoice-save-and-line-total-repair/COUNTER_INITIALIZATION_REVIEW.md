# Counter Initialization & Preview Synchronization Review

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**System Location:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-10  
**Scope:** Counter Architecture, Sequence Progression, and Preview Number Integrity  

---

## 1. Counter Document Schema & Path

In Firestore, sequential counter documents are partitioned per financial year:
- **Path:** `/businesses/{businessId}/counters/invoices_{fy}`
- **Document ID:** `invoices_2026-27` (for Indian FY Apr 1, 2026 to Mar 31, 2027)
- **Document Payload:**
  ```json
  {
    "lastSeq": 8,
    "prefix": "TPS/2026-27/",
    "lastInvoiceId": "inv-1731254400000",
    "lastInvoiceNumber": "TPS/2026-27/008",
    "updatedAt": "2026-11-10T10:00:00.000Z",
    "updatedBy": "admin_uid"
  }
  ```

---

## 2. Why the Preview Showed `TPS/2026-27/009` while Save Failed

### The Preview Logic (`peekNextInvoiceNumber` in `src/hooks/useInvoices.js`)
The invoice generator displays the prospective next invoice number at the top of the screen.
`peekNextInvoiceNumber` scans the currently loaded invoices in memory:
1. Looks for all invoices matching prefix `TPS/2026-27/`.
2. Extracts numeric suffixes: `001, 002, 003, ..., 008`.
3. Finds `maxSeq = 8`.
4. Adds 1: `nextSeq = 9`.
5. Displays `TPS/2026-27/009`.

### The Persistence Gap
While the client had 8 invoices in local/cached memory, the Firestore database had not yet had its counter document `/businesses/tps-battery-house/counters/invoices_2026-27` initialized by an administrator.

When the Store Manager clicked **Save & Print Bill**:
1. `createInvoiceWithCounter` checked if `counters/invoices_2026-27` existed in Firestore.
2. It did not exist.
3. Because the user had role `manager` (not `admin`), `createInvoiceWithCounter` did not auto-initialize it.
4. Under Firestore security rules (`firestore.rules` L750), a non-admin attempting to create a counter triggers `permission-denied`.
5. Under Firestore rule L613, an invoice cannot be created if its financial year counter does not exist.
6. The save failed with:
   `Error saving invoice: Permission denied: Please ensure you are an active staff member and that the financial year counter has been initialized by an administrator.`

---

## 3. Administrative Initialization Utility (`scripts/initialize-invoice-counter.js`)

To bridge this operational gap without weakening security rules, an administrative tool was created at `scripts/initialize-invoice-counter.js`.

### Capabilities:
- **Dry-run Inspection (`--dry-run`):**
  Scans existing Firestore invoices and displays proposed counter alignment without performing writes:
  ```bash
  node scripts/initialize-invoice-counter.js --project tps-battery-house --fy 2026-27 --dry-run
  ```
- **Monotonic Progression Guard:**
  Prevents any operator from setting `lastSeq` below existing invoices in Firestore, preventing sequence collisions or overwriting historical bills.
- **Audited Live Write (`--confirm`):**
  ```bash
  node scripts/initialize-invoice-counter.js --project tps-battery-house --fy 2026-27 --seq 8 --confirm
  ```
  Writes `{ lastSeq: 8, prefix: "TPS/2026-27/", updatedAt: ISO, updatedBy: "cli_admin" }`.

Once initialized with `lastSeq: 8`, the Store Manager creating the next bill seamlessly receives `TPS/2026-27/009`.

