# Implementation Summary: Administrator Draft Save & Unchanged Invoice Repair

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** 2026-11-11  
**Status:** Completed & Fully Verified  

---

## 1. Architectural Overview

This implementation resolved the critical issue where Administrators attempting to save draft invoices encountered `Missing or insufficient permissions` (and previously misleading counter initialization errors). Furthermore, it introduced deterministic form dirty-state tracking to prevent unnecessary Firestore writes when saving unchanged drafts.

---

## 2. Key Components Changed

### A. Firestore Security Rules (`firestore.rules`)
- **Optimization of Complex Expression Tree:** Refactored update authorization in `/businesses/{businessId}/invoices/{invoiceId}` into helper `canUpdateInvoice(businessId, invoiceId)`.
- **Single Member Lookup:** Extracted `let role = getMemberDoc(businessId).data.role;` to evaluate staff role once via ternary conditions instead of expanding nested helper calls (`isAdmin`, `isManager`, `isCashier`).
- **Elimination of CEL 1,000-Limit Exceeded:** Reduced Common Expression Language AST depth well below the 1,000-expression ceiling, enabling clean rule evaluations for draft updates.
- **Strict Role Permissions Preserved:**
  - `admin`: Can update any draft and non-cancelled invoices.
  - `manager`: Can update any draft and pending invoices; cannot update paid or cancelled invoices.
  - `cashier`: Can update **only their own** draft invoices (`resource.data.createdBy == request.auth.uid`); cannot update issued invoices.
  - Non-staff / Pending / Disabled: Completely denied.

### B. Draft Dirty-State Utility (`src/utils/draftState.js`)
Created a dedicated module handling state comparison and snapshotting:
- `hasMeaningfulInvoiceData(invoice)`: Assesses if customer name, phone, GSTIN, notes, or line items with descriptions/amounts exist.
- `isIssuedInvoice(invoice)`: Detects if the invoice possesses an issued status (`Paid`, `Pending`, `Cancelled`) or official number (`TPS/...`).
- `createDraftSnapshot(invoice)`: Creates a normalized deep snapshot (omitting non-semantic UI keys like `_uiKey`) of the invoice for dirty tracking.
- `isDraftModified(invoice, snapshot)`: Deep-compares current invoice state against the saved snapshot to detect true user edits.

### C. Application UI State Management (`src/App.jsx`)
- **Snapshot Tracking:** Introduced `lastSavedSnapshotRef = useRef(null)`.
- **Form Lifecycle Integration:**
  - `handleOpenInvoiceInEditor`: Takes baseline snapshot for drafts; clears snapshot for issued bills.
  - `handleStartNewInvoice` / `handleResetInvoice`: Resets snapshot to `null`.
  - `handleSaveInvoiceInEditor`: Clears snapshot upon official issuance.
  - `handleSaveDraftInEditor`: Handled 5 distinct lifecycle cases:
    1. **Case A (New Draft with Data):** Saves to Firestore, records snapshot, sets active invoice ID, displays `"Draft saved successfully"`.
    2. **Case B (Existing Draft Modified):** Updates draft in Firestore, updates snapshot, displays `"Draft saved successfully"`.
    3. **Case C (Existing Draft Unchanged):** Bypasses Firestore write entirely, displays `"No changes to save. Your draft is already up to date."`.
    4. **Case D (Empty New Invoice):** Rejects save with actionable message: `"Please enter customer details or add at least one product or service before saving as draft."`.
    5. **Case E (Previously Issued Invoice):** Strictly prevents demoting issued invoices back to Draft with warning: `"Cannot save as draft: This bill has already been issued as ${paymentStatus}."`.
- **Detailed Error Logging:** Catches Firestore errors and displays clear developer diagnostics (path, UID, role, error code) while preserving user form data.

### D. Service Layer Hardening (`src/firebase/services/invoiceService.js`)
- **Preserve Immutables on Draft Update:** `saveInvoiceDraft` preserves `existingInvoiceNumber`, `existingCreatedAt`, `existingCreatedBy`, and `existingBusinessSnapshot` to satisfy Firestore security rules immutability checks.
- **Preserve Business Snapshot during Official Issuance:** `createInvoiceWithCounter` checks if the source draft already contains `businessSnapshot` and preserves it during the atomic issuance transaction.
- **Diagnostic Logging:** Logs structured failure objects (`path`, `userId`, `userRole`, `operation`, `errorCode`) on persistence exceptions.

---

## 3. Security & Immutability Verification
- **Immutable Fields:** `businessId`, `createdAt`, `createdBy`, `invoiceNumber`, and `businessSnapshot` cannot be tampered with during draft updates or issuances.
- **Cross-Business Isolation:** All queries and writes remain strictly partitioned under `/businesses/{businessId}/...`.
- **Counter Protection:** Draft operations touch neither the financial-year counters nor the `invoice_numbers` reservation registry.
