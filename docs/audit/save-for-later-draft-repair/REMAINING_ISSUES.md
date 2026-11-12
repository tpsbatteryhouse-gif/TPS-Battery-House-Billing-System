# Remaining Issues & Residual Risk Analysis
## TPS Battery House — Save for Later (Draft) Workflow

### 1. Residual Risk Assessment

| Area | Current State | Risk Level | Mitigation & Recommendations |
| :--- | :--- | :--- | :--- |
| **Draft Sequence Gaps** | Draft invoice numbers use timestamp-based pseudo-identifiers (`DRAFT-YYYYMMDD-HHMMSS`). They do not consume official sequence counters. | **None / Negligible** | Verified: official financial sequence (`TPS/YYYY-YY/XXXX`) is only allocated upon explicit issuance (`paymentStatus: 'Pending'` or `'Paid'`). |
| **Concurrent Draft Issuance** | Multiple staff members can issue drafts simultaneously. | **Low** | Protected: `createInvoiceWithCounter` runs Firestore atomic transactions with strict precondition checks on `counters/invoices_{FY}` and uniqueness reservation documents in `/invoice_numbers/`. Any write conflict triggers automatic transaction retry. |
| **Draft Customer Schema** | Quick drafts can be saved with partial customer details (or blank customer name). | **Low** | Protected: `saveInvoiceDraft` provides resilient defaults (`customer.name = draftData.customer?.name?.trim() || 'Draft Customer'`) ensuring document passes `isValidInvoice` without breaking UI staging. Prior to printing/issuance, full customer validation is enforced by `validateInvoiceForIssuance`. |
| **Expression Evaluation Limit (CEL)** | AST expression tree limit in Firestore rules for `allow update`. | **Resolved** | Resolved: Extracted role and update evaluation to `canUpdateInvoice()` with single-lookup `let role = getMemberDoc(businessId).data.role;` and ternary branching, keeping AST complexity well under the 1000-expression limit. |
| **Orphaned Drafts** | Abandoned drafts may accumulate over months if users stage bills but never issue or delete them. | **Low** | Recommendation: In future sprints, consider adding an optional "Discard Draft" or "Archive Drafts older than 90 days" bulk cleanup utility for Store Managers. |

### 2. Operational Notes
- **Counter Invariant**: As required by Indian GST statutory compliance, draft saves do NOT increment or reserve financial year invoice numbers.
- **Role Invariant**: Cashiers are strictly restricted to saving and updating their own drafts (`createdBy == request.auth.uid`). Once an invoice is issued, cashiers cannot modify it.
- **Zero Inconsistencies**: All financial totals, discounts, taxes, and scrap deductions are preserved verbatim during draft persistence and loaded identically into the editor upon reopening.

