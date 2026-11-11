# Root Cause Analysis: Administrator Draft Save Failure & Unchanged Invoice Handling
## TPS Battery House — GST Billing & Invoice Management

### 1. Executive Summary

When an authenticated Administrator attempted to save a draft ("Save for later") on the New Bill screen, the application failed with:
`Error saving draft: Missing or insufficient permissions.`

This report documents the architectural root causes across the authentication, authorization, dirty-state tracking, and Firestore security rules layers.

---

### 2. Multi-Layer Root Cause Breakdown

#### A. Root Cause 1: Firestore Security Rules CEL AST Expression Limit (1000 Expressions)
- **Mechanism**:
  In `firestore.rules`, the `allow update` block under `match /invoices/{invoiceId}` contained nested function calls:
  `isAdmin(businessId) || isManager(businessId) || isCashier(businessId)...`
  Each function call evaluated `hasRole(businessId, role)` which recursively evaluated `isActiveMember(businessId)` -> `isMember(businessId)` -> `isAuthenticated()` and multiple `getMemberDoc()` document reads.
- **Impact**:
  During `update` operations (including updating an existing draft or calling `setDoc` with `{ merge: true }`), Common Expression Language (CEL) reached its maximum evaluation limit:
  `PERMISSION_DENIED: Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached. for 'update' @ L659`
- **Frontend Effect**:
  The Firebase Web SDK captured the gRPC status 7 `PERMISSION_DENIED` and returned `Missing or insufficient permissions.` to the application.

#### B. Root Cause 2: Absence of Draft Dirty State Tracking & Redundant Unchanged Writes
- **Mechanism**:
  The application lacked dirty-state tracking for invoice drafts. When an invoice was populated or opened from an existing draft without subsequent modifications, clicking **Save for later** unconditionally attempted a full Firestore write.
- **Impact**:
  Unchanged drafts were re-sent to Firestore, triggering the CEL expression limit on update and failing with permission errors instead of acknowledging that no changes had occurred.

#### C. Root Cause 3: Missing Invariant Guards on Previously Issued Invoices
- **Mechanism**:
  In `handleSaveDraftInEditor` ([App.jsx](file:///home/navaneeth/Documents/Amal/src/App.jsx)), the payload forcibly overwritten `paymentStatus: 'Draft'`.
- **Impact**:
  If a user or administrator opened an invoice that was already finalized (`Pending`, `Paid`, `Cancelled`), clicking "Save for later" attempted to demote the document back to `Draft`.
  This violated `firestore.rules` line 685 (`resource.data.paymentStatus != 'Draft' && request.resource.data.paymentStatus != 'Draft'`), resulting in a security rules rejection.

#### D. Root Cause 4: Lack of Pre-Validation on Empty Invoice Drafts
- **Mechanism**:
  No check existed to determine whether the invoice contained meaningful customer particulars or product line items before initiating draft persistence.
- **Impact**:
  Blank or empty draft documents could be sent to Firestore, polluting database records.

---

### 3. Resolution Summary

1. **Firestore Rules Optimization**: Centralized update authorization in `canUpdateInvoice(businessId, invoiceId)` using a single role extraction `let role = getMemberDoc(businessId).data.role;` and non-expanding ternary evaluation, reducing AST expression nodes from >1,000 to ~30.
2. **Draft Dirty State Utility** ([src/utils/draftState.js](file:///home/navaneeth/Documents/Amal/src/utils/draftState.js)): Implemented `createDraftSnapshot`, `isDraftModified`, `hasMeaningfulInvoiceData`, and `isIssuedInvoice` for strict form state tracking.
3. **Five-Case Workflow Handling** ([src/App.jsx](file:///home/navaneeth/Documents/Amal/src/App.jsx)):
   - **Case A (New with data)**: Saves fresh draft, persists to Firestore, records snapshot, shows success toast.
   - **Case B (Existing draft modified)**: Updates draft in Firestore, updates snapshot, shows success toast.
   - **Case C (Existing draft unchanged)**: Detects zero modifications, bypasses Firestore write, shows `"No changes to save. Your draft is already up to date."`
   - **Case D (Empty new invoice)**: Rejects blank drafts with helpful prompt: `"Please enter customer details or add at least one product or service before saving as draft."`
   - **Case E (Previously issued invoice)**: Strictly blocks demotion with `"Cannot save as draft: This bill has already been issued as ${paymentStatus}."`
