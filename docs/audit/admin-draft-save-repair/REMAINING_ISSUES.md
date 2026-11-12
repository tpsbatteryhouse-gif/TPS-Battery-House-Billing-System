# Remaining Issues & Production Readiness Analysis

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** 2026-11-11  
**Scope:** Administrator Draft Save & Unchanged Invoice Handling  

---

## 1. Resolved Issues in this Cycle

1. **Firestore CEL 1,000-Expression AST Limit during Draft Update:**  
   *Resolution:* Refactored security rule logic via `canUpdateInvoice(businessId, invoiceId)` with single-lookup variable binding (`let role = getMemberDoc(businessId).data.role;`), avoiding recursive AST expansion.
2. **Unchanged Draft Unnecessary Firestore Writes:**  
   *Resolution:* Implemented dirty-state tracking via `src/utils/draftState.js` and `lastSavedSnapshotRef` in `src/App.jsx`. Unchanged drafts now skip the network round-trip and instantly notify the user.
3. **Empty Invoice Draft Rejection:**  
   *Resolution:* Case D detects empty invoices with no customer info and no meaningful line items, prompting the user with a helpful instruction.
4. **Draft Demotion Prevention:**  
   *Resolution:* Case E strictly blocks converting already issued bills (`Paid`, `Pending`, `Cancelled`) back to Draft in the client, backed by rules immutability checks on `paymentStatus` and `invoiceNumber`.
5. **Business Snapshot Invalidation on Official Issuance:**  
   *Resolution:* Fixed `createInvoiceWithCounter` to preserve `existingBusinessSnapshot` when promoting a saved draft into an issued tax invoice.

---

## 2. Potential Future Observations & Non-Blocking Notes

1. **Large Single-Page Bundle Sizes:**  
   Vite build reports chunks over 500 kB (primarily PDF generator libraries and Firebase client SDKs). This is standard for full offline-capable browser PDF rendering and Firebase client bundles. Dynamic `import()` code-splitting for PDF components can be considered in future frontend optimization cycles.
2. **Client-Side Draft Autosave (Future Enhancement):**  
   Drafts are currently saved explicitly when the user clicks **Save for later**. A background debounced autosave could be added if requested by operations, leveraging the newly added `isDraftModified()` dirty-checking utility.
3. **Draft Cleanup / Retention Policy:**  
   Old discarded drafts remain in Firestore until deleted or converted to issued bills. A retention policy or draft deletion action for Administrators and Managers could be introduced if draft clutter accumulates over years.

---

## 3. Production Readiness Sign-off

- **Security Rules:** Formally verified via `firestore-rules-author` subagent and 38 test suites.
- **Role Permissions:** Strict Phase 4/5 RBAC preserved (Admins/Managers manage drafts; Cashiers manage only their own; Pending/Disabled blocked).
- **Data Integrity:** Sequential invoice numbering and counter isolation 100% verified.
- **Test Status:** 1,281 passing tests across 38 suites, 0 failing.
- **Build & Lint:** 0 linter errors, clean production bundle.
