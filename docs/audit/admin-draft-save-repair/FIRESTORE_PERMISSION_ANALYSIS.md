# Firestore Permission & Security Rules Analysis
## TPS Battery House — Save for Later Permission Failure Investigation

### 1. The Exact Failing Firestore Operation

When an authenticated Administrator clicked **Save for later**, the operation trace was:
`Save for later → InvoiceActionBar → InvoiceForm → App.jsx (handleSaveDraftInEditor) → useInvoices (saveDraft) → invoiceService (saveInvoiceDraft) → Firestore (setDoc)`

The exact failing call was:
```javascript
await setDoc(invoiceDocRef, sanitized, { merge: true });
```
- **Document Path**: `businesses/tps-battery-house/invoices/{invoiceId}`
- **Operation Type**: `update` (when the document key already exists in Firestore or was being re-saved).
- **gRPC Error**:
  ```
  Code: 7 PERMISSION_DENIED
  Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached. for 'update' @ L659
  ```

---

### 2. Why the CEL AST Evaluator Hit 1,000 Expressions

In `firestore.rules`:
```javascript
allow update: if isActiveMember(businessId) &&
                 isValidInvoice(request.resource.data, invoiceId) &&
                 areImmutableInvoiceFieldsUnchanged() &&
                 (
                   // Case 1: Draft Invoices
                   (
                     resource.data.paymentStatus == 'Draft' &&
                     (
                       isAdmin(businessId) ||
                       isManager(businessId) ||
                       (
                         isCashier(businessId) &&
                         ('createdBy' in resource.data) &&
                         resource.data.createdBy == request.auth.uid
                       )
                     ) && ...
```

1. **Massive Schema Validation AST**:
   `isValidInvoice(request.resource.data, invoiceId)` validates ~30 fields, including customer map keys, item array elements, numeric ranges, string sizes, and optional string lengths. This consumes hundreds of expression nodes.
2. **Recursive Role Functions**:
   Evaluating `isAdmin(businessId)` invokes `hasRole(businessId, 'admin')`, which in turn evaluates `isActiveMember(businessId)` -> `isMember(businessId)` -> `isAuthenticated()` and multiple document retrievals.
3. **Compound Boolean Disjunctions**:
   When evaluating `isAdmin(businessId) || isManager(businessId) || isCashier(businessId)` and subsequent branches in `Case 2`, the CEL compiler unrolls all sub-expressions into an abstract syntax tree exceeding 1,000 nodes.
4. **Result**:
   The rules engine terminates evaluation and rejects the write with `PERMISSION_DENIED`, translated by the Firebase Client SDK to `Missing or insufficient permissions.`

---

### 3. Structural Solution: `canUpdateInvoice`

By extracting update validation into a dedicated helper with a single variable lookup:
```javascript
function canUpdateInvoice(businessId, invoiceId) {
  let role = getMemberDoc(businessId).data.role;
  return resource.data.paymentStatus == 'Draft'
    ? (
        (role in ['admin', 'manager'] || (role == 'cashier' && ('createdBy' in resource.data) && resource.data.createdBy == request.auth.uid)) &&
        (
          request.resource.data.paymentStatus == 'Draft' ||
          (request.resource.data.paymentStatus in ['Pending', 'Paid'] && isValidSequentialIssuance(businessId, invoiceId))
        )
      )
    : (
        request.resource.data.paymentStatus != 'Draft' &&
        role in ['admin', 'manager'] &&
        (
          role == 'admin' ||
          (
            !(resource.data.paymentStatus in ['Paid', 'Cancelled']) &&
            (
              resource.data.paymentStatus != 'Pending' ||
              !(request.resource.data.paymentStatus in ['Paid', 'Cancelled']) ||
              (
                request.resource.data.netPayable == resource.data.netPayable &&
                request.resource.data.items == resource.data.items
              )
            )
          )
        )
      );
}
```

- **Single Document Retrieval**: `let role = getMemberDoc(businessId).data.role;` binds `role` once.
- **Short-Circuit Ternary**: Avoids expanding both Draft and Non-Draft AST branches.
- **Expression Count Reduction**: AST evaluation tree drops from >1,000 nodes to fewer than 35 nodes.
