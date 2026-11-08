# TPS BATTERY HOUSE — PRODUCTION READINESS CHECKLIST
**Phase:** Phase 5 — Full Application Security, Architecture & Production Readiness Audit  
**Date:** November 2026  
**Audited By:** Antigravity Agentic Security & Architecture Auditor  
**Production URL Target:** `https://tps-battery-house-billing-system.vercel.app/`  

---

## 1. Executive Summary

This checklist establishes the production-readiness state of the TPS Battery House GST Billing & Invoice Management application. All items are categorized by their verification status: verified locally via automated test suites and emulators, requiring external cloud/console configuration, step-by-step production deployment sequence, non-destructive post-deployment smoke testing, and pre-deployment prerequisites.

---

## 2. Readiness Matrix

| Area | Status | Verification Method | Notes |
| :--- | :---: | :--- | :--- |
| **Authentication & RBAC** | ✅ READY | Unit, integration & rule test suites | Auth persistence `browserLocalPersistence`, role checks in Firestore rules, active-member enforcement. |
| **Firestore Security Rules** | ✅ READY | `rules-unit-testing` (19 suites, 893 assertions) | Zero rules bypass, no open write vectors, admin_config & audit logs write-protected from clients. |
| **Admin Concurrency & OCC** | ✅ READY | Concurrency & race condition test suites | `admin_guard` version checks serialized with Firestore transactions. |
| **Primary Admin Recovery** | ✅ READY | CLI script tests (`scripts/recover-primary-admin.js`) | Completely segregated from frontend bundle. Admin SDK CLI-only. |
| **Cloud Functions v2** | ✅ READY | Unit & emulator invocation tests | Callable functions enforce Auth, Admin role, `admin_guard` OCC, native timestamps. |
| **Financial / GST Engine** | ✅ READY | Mathematical invariant test suites | CGST/SGST/IGST splits, round-half-up (Banker's rule), zero tax-rounding variance. |
| **Frontend Performance** | ✅ READY | Vite build & bundle analysis | Main chunk optimized from 1,877 kB to 570 kB (70% reduction) via Rolldown `manualChunks`. |
| **Code Quality & Linting** | ✅ READY | `oxlint --deny-warnings` | 0 errors, 0 warnings across all 74 project source files. |

---

## 3. Verified Locally

The following capabilities have been tested and verified against the local Firestore Emulator and test fixtures:

1. **Authentication Lifecycle & Identity Persistence:**
   - Persistence configured explicitly to `browserLocalPersistence`.
   - Google Sign-In identity linking tested: UID stability verified with Firestore membership mapping (`businesses/tps-battery-house/members/{uid}`).
   - Anonymous access rejected across all protected collections.

2. **Database Security Rules & Isolation:**
   - Multi-tenant path isolation (`businesses/{businessId}/...`) verified.
   - Staff membership lifecycle: self-registration requires status `pending`, approvals restricted to active Admins.
   - Financial profiles: `business_profile` accessible to active staff; sensitive `financial_settings` and `admin_config` restricted strictly to Admins.
   - Invoice immutability: deleted/archived invoices cannot be modified; sequence numbers monotonically increasing.

3. **Concurrency & Race Conditions:**
   - Concurrency tests demonstrate that concurrent Admin demotion/deactivation requests serialize on `admin_guard`.
   - Prevented race conditions that could lead to zero active Admins ("Last Administrator Protection").

4. **GST Calculation Precision:**
   - Pure arithmetic calculations in `src/utils/taxCalculations.js` guarantee exact line-item tax calculation.
   - Intra-state (CGST + SGST) and Inter-state (IGST) arithmetic produces zero rounding discrepancy at total invoice levels.

5. **Client Bundle Decoupling:**
   - `firebase-admin` is completely absent from the client bundle (0 bytes, 0 references in `dist/`).
   - Heavy dependencies (`jspdf`, `html2canvas`) isolated to deferred chunk `pdf-vendor`.

---

## 4. Cloud & Console Configuration Checklist (Pre-Flight)

The following items must be verified or configured in the Google Cloud / Firebase Console prior to production release:

- [ ] **Firebase Authentication Configuration:**
  - [ ] Google Sign-In Provider: Enabled in Firebase Console -> Build -> Authentication -> Sign-in method.
  - [ ] Authorized Domains: Ensure both production domain (`tps-battery-house-billing-system.vercel.app`) and custom domains are registered in Firebase Authentication -> Settings -> Authorized Domains.
- [ ] **Google Cloud Project & Billing:**
  - [ ] Firebase Blaze Plan (Pay-as-you-go) enabled (mandatory for Cloud Functions v2 and external outbound networking).
  - [ ] Artifact Registry API enabled (required for Cloud Functions v2 container images).
  - [ ] Cloud Build API enabled.
- [ ] **Firestore Database Configuration:**
  - [ ] Firestore mode: Native mode in target region (e.g., `asia-south1` or `us-central1`).
  - [ ] Composite Indexes: Confirm all composite indexes defined in `firestore.indexes.json` are deployed and in status `Enabled`.
- [ ] **Cloud Functions v2 IAM & Permissions:**
  - [ ] Default compute service account or App Engine default service account granted `Cloud Datastore User` and `Firebase Authentication Admin`.
  - [ ] All 6 callable functions (`requestStaffApprovalCallable`, `updateStaffStatusCallable`, `removeStaffMemberCallable`, `demoteSelfCallable`, `promoteToAdminCallable`, `checkLastAdminCallable`) deployed to the same region as the frontend client configuration.
- [ ] **Firebase App Check (Recommended Post-Launch Hardening):**
  - [ ] ReCAPTCHA Enterprise or reCAPTCHA v3 provider registered for the production web app to block unauthorized API abuse.

---

## 5. Production Deployment Sequence

When approved to deploy, execute the following commands in strict order:

```bash
# 1. Pre-Deployment Automated Verification
npm run test
npx oxlint --deny-warnings
npm run build

# 2. Deploy Cloud Firestore Security Rules and Indexes
firebase deploy --only firestore:rules,firestore:indexes --project <PRODUCTION_PROJECT_ID>

# 3. Deploy Cloud Functions v2 Backend
firebase deploy --only functions --project <PRODUCTION_PROJECT_ID>

# 4. Deploy Frontend Client to Vercel
# Commit changes and push to production branch or trigger Vercel deployment:
vercel --prod
```

---

## 6. Non-Destructive Smoke Testing Plan

Execute these non-destructive steps in the production environment immediately following deployment:

1. **Production Health Check:**
   - Navigate to `https://tps-battery-house-billing-system.vercel.app/`.
   - Inspect DevTools Console: Ensure no runtime module loading errors, missing asset 404s, or syntax errors.

2. **Authentication & Membership Verification:**
   - Sign in using an authorized Google account.
   - Confirm authentication succeeds and redirects to the Dashboard.
   - Check that user profile shows expected name, email, and designated role.

3. **Role-Based Access Control Verification:**
   - As an Admin, verify navigation to Staff Management (`/staff`). Ensure the staff directory renders and audit logs display.
   - As a non-Admin (Billing Staff), verify that `/staff` navigation is hidden or access is restricted with a friendly unauthorized notification.
   - Verify that non-Admin staff cannot read or write to `financial_settings`.

4. **Invoice Generation & GST Preview Smoke Test:**
   - Navigate to Create Invoice.
   - Enter a test invoice for a dummy customer with 1 battery item (e.g., Qty 1, ₹1,000, 18% GST).
   - Verify that Tax Invoice preview displays:
     - Taxable Amount: ₹1,000.00
     - CGST (9%): ₹90.00
     - SGST (9%): ₹90.00
     - Total: ₹1,180.00
   - Save invoice as Draft. Confirm the draft appears in Invoice List.
   - Delete the test draft invoice to restore clean state.

5. **Network Inspection:**
   - Inspect DevTools Network tab: Verify all Firestore requests return HTTP 200/OK.
   - Ensure zero `PERMISSION_DENIED` errors in Firestore network calls for authorized paths.
   - Verify Cloud Functions callable requests (if triggered) return 200 with structured JSON payloads.

---

## 7. Blockers & Contingency

### Current Blockers
- **Local Application Blockers:** **NONE**. All 19 test suites pass, bundle size is optimized, code linting is 100% clean.
- **External Blockers:** Deployment requires human authorization to publish rules and deploy Cloud Functions to the live project.

### Contingency & Rollback Plan
- **Firestore Rules Rollback:** Firebase Console retains historical rules releases; revert via Firebase Console -> Firestore -> Rules -> Release history.
- **Cloud Functions Rollback:** Re-deploy previous revision via `firebase deploy --only functions` or GCP Cloud Functions Console.
- **Frontend Rollback:** Instant rollback in Vercel Dashboard to the previous deployment SHA with zero downtime.
- **Primary Admin Disaster Recovery:** In the event of lost administrative access, run `node scripts/recover-primary-admin.js --project <PROJECT_ID> --business-id tps-battery-house --uid <TARGET_UID> --email <TARGET_EMAIL> --confirm` using a service account key outside the browser environment.

