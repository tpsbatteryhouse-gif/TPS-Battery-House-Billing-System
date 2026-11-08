# TPS BATTERY HOUSE — FIRESTORE INDEX AUDIT
## Phase 6B Query Performance & Index Architecture Specification

**Project:** TPS BATTERY HOUSE — GST Billing Application  
**File Created:** `/home/navaneeth/Documents/Amal/firestore.indexes.json`  
**Configuration Added:** `firebase.json` (`"indexes": "firestore.indexes.json"`)  
**Audit Date:** 2026-11-08T13:54:00+05:30  

---

## 1. Index Audit Overview & Defect Remediation

### Prior Defect State
Prior to Phase 6B, the repository:
1. Had **no `firestore.indexes.json`** file.
2. Had **no `"indexes"` entry** under `"firestore"` in `firebase.json`.
3. Relied entirely on the local Firebase Firestore Emulator (which automatically satisfies queries in-memory) and single-field automatic indexes.

In production Firestore, multi-field filters or queries with compound equality and inequality/sorting fail with:
`FAILED_PRECONDITION: The query requires an index.`

### Remediation Applied
Created `firestore.indexes.json` with the full suite of composite indexes required by application queries and linked it in `firebase.json`.

---

## 2. Query vs Index Analysis Matrix

| Service / Component | Query Pattern in Code | Scope | Required Index Type | Index Definition in `firestore.indexes.json` |
| :--- | :--- | :--- | :--- | :--- |
| `trustedStaffBackend.js` & `staffService.js` | `where('role', '==', 'admin').where('status', '==', 'active')` | Collection (`members`) | Composite (Equality + Equality) | `role: ASC`, `status: ASC` |
| `staffService.js` (`listStaffAuditLogs`) | `orderBy('timestamp', 'desc').limit(N)` | Collection (`staff_audit_logs`) | Single-Field (Automatic) | Supported natively; added compound variants |
| Staff Audit History by Target | `where('targetUid', '==', uid).orderBy('timestamp', 'desc')` | Collection (`staff_audit_logs`) | Composite (Equality + Sort) | `targetUid: ASC`, `timestamp: DESC` |
| Staff Audit History by Action | `where('action', '==', action).orderBy('timestamp', 'desc')` | Collection (`staff_audit_logs`) | Composite (Equality + Sort) | `action: ASC`, `timestamp: DESC` |
| Invoices by Fiscal Year | `where('financialYear', '==', fy).orderBy('invoiceDate', 'desc')` | Collection (`invoices`) | Composite (Equality + Sort) | `financialYear: ASC`, `invoiceDate: DESC` |
| Invoices by Payment Status | `where('paymentStatus', '==', status).orderBy('invoiceDate', 'desc')` | Collection (`invoices`) | Composite (Equality + Sort) | `paymentStatus: ASC`, `invoiceDate: DESC` |

---

## 3. Formal `firestore.indexes.json` Definition

```json
{
  "indexes": [
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "staff_audit_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "targetUid", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "staff_audit_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "action", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "financialYear", "order": "ASCENDING" },
        { "fieldPath": "invoiceDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "paymentStatus", "order": "ASCENDING" },
        { "fieldPath": "invoiceDate", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 4. Production Deployment Recommendation
- Under Phase 6B safety restrictions, `firebase deploy --only firestore:indexes` is **STRICTLY PROHIBITED**.
- The index configuration is now preserved in git and ready for the future deployment phase after Phase 6A environment verification has been signed off.

