# TPS BATTERY HOUSE — PHASE 6B RELEASE BLOCKERS
## Production Release Gate Status & Pre-Deployment Prerequisites

**Project:** TPS BATTERY HOUSE — GST Billing Application  
**Audit Phase:** Phase 6B Firestore Security Rules & Indexes Deep Audit  
**Date:** 2026-11-08T13:56:00+05:30  
**Current Production Deployment Status:** **STRICTLY BLOCKED**  

---

## 1. Summary of Release Gate Blockers

While all local Firestore security rules and index architecture verifications have passed with **1003 / 1003 automated regression assertions**, live deployment to production remains **STRICTLY BLOCKED** until the prerequisites below are fulfilled.

```
+================================================================================================+
|                                PRODUCTION RELEASE GATE: BLOCKED                                |
|                                                                                                |
|   1. Phase 6A Production Environment Audit:           BLOCKED (Reports Missing in repo)        |
|   2. Live Production Firestore Rules Sync:            BLOCKED (Must deploy hardened rules)     |
|   3. Live Production Firestore Index Deployment:      BLOCKED (Must deploy indexes.json)       |
|   4. Production Project ID & Service Account Binding: UNVERIFIED (Needs Phase 6A resolution)   |
+================================================================================================+
```

---

## 2. Mandatory Release Blockers

### Blocker 1: Missing Phase 6A Production Environment Audit
- **Status:** **CRITICAL RELEASE BLOCKER**
- **Description:** The required Phase 6A reports (`PHASE_6A_PRODUCTION_ENVIRONMENT_AUDIT.md`, `FIREBASE_PROJECT_IDENTITY_REPORT.md`, `VERCEL_DEPLOYMENT_CONFIGURATION_REPORT.md`, `LOCAL_VS_PRODUCTION_CONFIGURATION_MATRIX.md`, `PRODUCTION_RELEASE_BLOCKERS.md`, `PHASE_6A_EVIDENCE_LOG.md`) are completely absent from `docs/audit/phase-6a/`.
- **Risk:** Without Phase 6A, there is no verified proof that the live Vercel environment points to the exact same Firebase project (`tps-battery-house`), that production environment variables are properly bound, or that live cloud configurations are secure.
- **Resolution Required:** Execute Phase 6A (Production Environment Verification) to audit production project identity and Vercel environment variables before any deployment.

---

### Blocker 2: Live Production Firestore Rules Deployment Pending
- **Status:** **DEPLOYMENT PREREQUISITE**
- **Description:** The critical security hardenings made in Phase 6B (deep recursive `businessSnapshot` immutability, `financialYear` update prevention, and `admin_guard` schema bounds) exist only in the local `firestore.rules` file.
- **Risk:** The live production Firestore instance at `https://tps-battery-house-billing-system.vercel.app/` is currently running previous rules that may still be vulnerable to terms tampering.
- **Resolution Required:** Deploy the hardened rules during Phase 6C via `firebase deploy --only firestore:rules` following authorized change management approval.

---

### Blocker 3: Live Production Firestore Index Deployment Pending
- **Status:** **PERFORMANCE / FUNCTIONAL PREREQUISITE**
- **Description:** `firestore.indexes.json` was authored and committed locally. These composite indexes (`members`, `staff_audit_logs`, `invoices`) have NOT yet been built in the live production Firestore database.
- **Risk:** In production, queries filtering by multiple equality or compound equality/sorting will fail with `FAILED_PRECONDITION: The query requires an index` if executed without these indexes.
- **Resolution Required:** Deploy the index definitions during Phase 6C via `firebase deploy --only firestore:indexes`.

---

## 3. Non-Blocking Owner Confirmation Items

The following business items are safe under current operation, but documented for store owner alignment:
1. **Manual Round-Off Cap:** The engine currently allows auto-rounding within $\pm ₹0.50$ and manual overrides up to $\pm ₹100.00$. The owner may optionally request a tighter manual limit (e.g. $\pm ₹5.00$).
2. **Zero-Rate Invoices:** Legitimate zero-rate service lines (e.g. battery health checks, complimentary water top-up) are valid; a soft visual prompt in the POS UI can be toggled if accidental zero-rate inputs occur.

---

## 4. Phase 6C Readiness Checklist

Before initiating Phase 6C:
- [ ] Complete Phase 6A audit and obtain signed `FIREBASE_PROJECT_IDENTITY_REPORT.md`.
- [ ] Confirm authorized deployment operator credentials.
- [ ] Schedule maintenance window for rules and index provisioning.
- [ ] Verify production database backup / point-in-time recovery (PITR) is enabled.

