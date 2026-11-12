# Draft Workflow & Transition Architecture Review

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**System Location:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-11  
**Scope:** Architecture of Draft Saving, Idempotency, and Draft-to-Issued Transitions  

---

## 1. Architectural Distinction Between Drafts and Issued Invoices

The system enforces a strict architectural boundary between saving a draft and issuing a tax invoice:

| Characteristic | Save for Later (Draft) | Save & Print Bill (Issued Tax Invoice) |
| :--- | :--- | :--- |
| **Document State** | `paymentStatus: "Draft"` | `paymentStatus: "Pending"` or `"Paid"` |
| **Invoice Identifier** | Temporary identifier (e.g., `DRAFT-849201`) | Permanent statutory number (e.g., `TPS/2026-27/009`) |
| **Counter Impact** | **None** (Exempt from counter sequence) | Monotonically increments fiscal counter (`+1`) |
| **Number Reservation** | **None** (No reservation document created) | Atomically reserves `invoice_numbers/{safeNum}` |
| **Counter Requirement**| Counter does **not** need to exist | Counter **must** exist before issuance |
| **Required Form Data** | Basic items (allows partial/staged customer data) | Full statutory validation (`validateInvoiceBeforePrint`) |
| **Post-Action Behavior**| Displays `Draft saved successfully`; form remains open | Atomically persists invoice, then opens print dialog |

---

## 2. Dedicated Draft Service (`saveInvoiceDraft`)

A dedicated service function was introduced in [`src/firebase/services/invoiceService.js`](file:///home/navaneeth/Documents/Amal/src/firebase/services/invoiceService.js):

```javascript
export async function saveInvoiceDraft(
  businessId = DEFAULT_BUSINESS_ID,
  draftData,
  user = null,
  options = {}
) {
  const firestoreDb = options?.dbInstance || db;
  const invoiceId = draftData.id || `inv_draft_${Date.now()}`;
  const invoiceDocRef = doc(firestoreDb, 'businesses', businessId, 'invoices', invoiceId);

  // Preserve existing DRAFT number, or generate a fresh DRAFT- number
  const draftNumber = (draftData.invoiceNumber && draftData.invoiceNumber.startsWith('DRAFT'))
    ? draftData.invoiceNumber
    : `DRAFT-${Date.now().toString().slice(-6)}`;

  const invoiceDate = draftData.invoiceDate || new Date().toISOString().split('T')[0];
  const fy = draftData.financialYear || getFinancialYear(invoiceDate);

  const snapshot = draftData.businessSnapshot ||
    (options?.business ? createBusinessSnapshot(options.business) : createBusinessSnapshot(DEFAULT_BUSINESS_SETTINGS));

  let isExistingDoc = false;
  let existingCreatedAt = null;
  let existingCreatedBy = null;
  try {
    const existingSnap = await getDoc(invoiceDocRef);
    if (existingSnap.exists()) {
      isExistingDoc = true;
      existingCreatedAt = existingSnap.data()?.createdAt;
      existingCreatedBy = existingSnap.data()?.createdBy;
    }
  } catch {
    isExistingDoc = false;
  }

  const customer = {
    ...(draftData.customer || {}),
    name: (draftData.customer?.name || '').trim() || 'Draft Customer',
  };

  const sanitized = sanitizeInvoiceForFirestore(
    {
      ...draftData,
      id: invoiceId,
      invoiceNumber: draftNumber,
      paymentStatus: 'Draft',
      financialYear: fy,
      customer,
      businessSnapshot: snapshot,
      createdAt: existingCreatedAt || draftData.createdAt,
      createdBy: existingCreatedBy || draftData.createdBy,
    },
    user,
    isExistingDoc
  );

  await setDoc(invoiceDocRef, sanitized, { merge: true });
  return sanitized;
}
```

---

## 3. Safe Draft-to-Issued Invoice Transition

When a user later opens a previously saved draft and clicks **Save & Issue Bill** (or **Save & Print Bill**):
1. `createInvoiceWithCounter` detects `paymentStatus != 'Draft'`.
2. It verifies the fiscal year counter exists (`counters/invoices_2026-27`).
3. An atomic transaction runs:
   - Reads the current counter sequence.
   - Allocates the next permanent invoice number (e.g. `TPS/2026-27/001`).
   - Verifies the number reservation has not been taken.
   - Reads the existing draft document `invoiceDocRef`.
   - Preserves immutable creation metadata (`id`, `createdAt`, `createdBy`).
   - Updates `invoiceNumber` to the permanent number and sets `paymentStatus: 'Pending'`.
   - Atomically updates the counter and creates the uniqueness reservation document.
4. If issuance succeeds, the browser print workflow is invoked with the permanent official invoice.

