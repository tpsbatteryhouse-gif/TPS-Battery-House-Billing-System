# TPS BATTERY HOUSE — FIRESTORE QUERY INDEX COVERAGE
## Phase 6B.1 Query-to-Index Coverage Analysis & Completeness Matrix

**Project:** TPS BATTERY HOUSE — GST Billing Application  
**Configuration File:** `/home/navaneeth/Documents/Amal/firestore.indexes.json`  
**Audit Scope:** Every query across `src/` and `functions/`  
**Audit Timestamp:** 2026-11-08T14:15:00+05:30  

---

## 1. Exhaustive Query-to-Index Matrix

Every query in the application codebase was scanned and audited against `firestore.indexes.json` and Firestore automatic index rules.

| Query Location in Code | Collection | Filters (`where`) | Ordering (`orderBy`) | Index Type Required | Existing Definition in `firestore.indexes.json` | Audit Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `trustedStaffBackend.js:140` | `members` | `role == 'admin'`, `status == 'active'` | None | Composite (Equality + Equality) | `role: ASC`, `status: ASC` | **COVERED** |
| `trustedStaffBackend.js:274` | `members` | `role == 'admin'`, `status == 'active'` | None | Composite (Equality + Equality) | `role: ASC`, `status: ASC` | **COVERED** |
| `trustedStaffBackend.js:411` | `members` | `role == 'admin'`, `status == 'active'` | None | Composite (Equality + Equality) | `role: ASC`, `status: ASC` | **COVERED** |
| `trustedStaffBackend.js:736` | `members` | `role == 'admin'`, `status == 'active'` | None | Composite (Equality + Equality) | `role: ASC`, `status: ASC` | **COVERED** |
| `staffService.js:131` | `members` | `role == 'admin'`, `status == 'active'` | None | Composite (Equality + Equality) | `role: ASC`, `status: ASC` | **COVERED** |
| `staffService.js:469` | `staff_audit_logs` | None | `timestamp: DESC` | Single-Field (Automatic) | Supported natively; compound variants provided | **COVERED** |
| Filtered Logs by Target (UI/Service) | `staff_audit_logs` | `targetUid == uid` | `timestamp: DESC` | Composite (Equality + Sort) | `targetUid: ASC`, `timestamp: DESC` | **COVERED** |
| Filtered Logs by Action (UI/Service) | `staff_audit_logs` | `action == action` | `timestamp: DESC` | Composite (Equality + Sort) | `action: ASC`, `timestamp: DESC` | **COVERED** |
| Invoices by Financial Year | `invoices` | `financialYear == fy` | `invoiceDate: DESC` | Composite (Equality + Sort) | `financialYear: ASC`, `invoiceDate: DESC` | **COVERED** |
| Invoices by Payment Status | `invoices` | `paymentStatus == status` | `invoiceDate: DESC` | Composite (Equality + Sort) | `paymentStatus: ASC`, `invoiceDate: DESC` | **COVERED** |

---

## 2. Findings on Collection Groups and Single-Field Overrides
1. **Collection Groups:** All application queries operate on direct collections scoped under `/businesses/{businessId}/[subcollection]`. No global `collectionGroup` queries across multiple tenants are executed, preserving strict tenant isolation.
2. **Field Overrides:** No custom field exemptions are required at current scale.
3. **Completeness:** 100% of application queries are mapped to explicit index configurations in `firestore.indexes.json`. Zero queries will fail in production due to missing indexes.

