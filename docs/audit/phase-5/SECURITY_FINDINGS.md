# TPS Battery House — Phase 5 Security Findings & Remediation Log

## Overview
This document tracks all identified security and architectural findings evaluated during Phase 5, along with their reproduction methods, severity classifications, remediation evidence, and verification statuses.

---

### Finding SEC-01: Admin SDK Recovery Module Located Within Client Source Tree (RESOLVED)
- **Severity:** P1 (High)
- **Affected File:** `src/firebase/services/adminConfigRecovery.js` (previously) -> [`scripts/recover-primary-admin.js`](file:///home/navaneeth/Documents/Amal/scripts/recover-primary-admin.js)
- **Description:** `adminConfigRecovery.js` was positioned inside the frontend `src/` directory and re-exported through `src/firebase/services/trustedStaffBackend.js`. Although it used dynamic imports with `@vite-ignore`, maintaining Admin SDK expectations within a client bundle dependency graph posed a significant supply-chain and architectural risk.
- **Impact:** Potential leakage of administrative code into client bundles or build failures across different bundler versions.
- **Remediation:**
  1. Completely deleted `src/firebase/services/adminConfigRecovery.js`.
  2. Removed `recoverPrimaryAdminConfig` export from `src/firebase/services/trustedStaffBackend.js`.
  3. Created an isolated, standalone CLI utility in [`scripts/recover-primary-admin.js`](file:///home/navaneeth/Documents/Amal/scripts/recover-primary-admin.js) that runs strictly outside `src/` via Node.js.
  4. Added `--dry-run`, `--project`, `--business-id`, and `--confirm` flags to prevent accidental execution.
- **Verification:** Vite build succeeds without Rolldown import warnings; `grep -rn "firebase-admin" dist/` returns 0 occurrences; recovery test suite in `scratch/test_final_security_hardening.js` passes 12/12 assertions.
- **Status:** **RESOLVED**

---

### Finding SEC-02: Cloud Functions Test Bootstrap Helpers Unguarded in Production (RESOLVED)
- **Severity:** P2 (Medium)
- **Affected File:** [`functions/index.js`](file:///home/navaneeth/Documents/Amal/functions/index.js) (`configureAdminForProject` and `setAdminInstancesForTesting`)
- **Description:** The test helpers `configureAdminForProject` and `setAdminInstancesForTesting` were exported from `functions/index.js` without runtime environment verification. Although not registered as `onCall` or `onRequest` endpoints, defense-in-depth requires ensuring they cannot be called if imported in production.
- **Impact:** Accidental or malicious invocation in non-emulator environments could theoretically reconfigure Admin SDK database targets.
- **Remediation:** Added strict runtime environment assertion:
  ```javascript
  const isEmulatorOrTest =
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FUNCTIONS_EMULATOR) ||
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.FIREBASE_EMULATOR_HUB);

  if (!isEmulatorOrTest) {
    throw new Error('This function is strictly restricted to local test and emulator environments.');
  }
  ```
- **Verification:** Unit and integration test suites pass; production builds and syntax checks confirm clean behavior.
- **Status:** **RESOLVED**

---

### Finding SEC-03: Monolithic Client Bundle Exceeding Size Guidelines (RESOLVED)
- **Severity:** P2 (Medium / Performance & DoS Protection)
- **Affected File:** [`vite.config.js`](file:///home/navaneeth/Documents/Amal/vite.config.js)
- **Description:** The production build produced a single monolithic JavaScript bundle (`index-*.js`) of approximately 1,877 kB (523 kB gzip). Heavy libraries (`jspdf`, `html2canvas`, and Firebase subpackages) were loaded synchronously on the initial page load, impacting Time to Interactive (TTI) and First Contentful Paint (FCP) on slow mobile connections.
- **Remediation:**
  Configured manual chunking in `vite.config.js` using Rolldown-compatible function syntax:
  - `pdf-vendor`: isolates `jspdf` and `html2canvas` (598 kB).
  - `firebase-vendor`: isolates core Firebase SDKs (685 kB).
  - `icons-vendor`: isolates `lucide-react` (30 kB).
  - Main app bundle (`index-*.js`) reduced to **570 kB (135 kB gzip)**.
- **Verification:** `npm run build` succeeds in 1.61s; main chunk size reduced by 70%.
- **Status:** **RESOLVED**

---

### Finding SEC-04: Active Administrator Concurrency Race Window (RESOLVED in Phase 4.2 / 4.2.1)
- **Severity:** P1 (High)
- **Affected Files:** [`src/firebase/services/trustedStaffBackend.js`](file:///home/navaneeth/Documents/Amal/src/firebase/services/trustedStaffBackend.js), [`functions/index.js`](file:///home/navaneeth/Documents/Amal/functions/index.js)
- **Description:** Concurrent modifications across different active administrators (e.g. concurrent removals, removal vs deactivation, removal vs demotion, approval vs removal) could lead to phantom reads in Firestore transactions.
- **Remediation:** Implemented optimistic concurrency control serialization on `businesses/{businessId}/settings/admin_guard`. Every transaction altering active-admin availability reads and updates `admin_guard`.
- **Verification:** Verified by 5 dedicated concurrency tests in `scratch/test_final_security_hardening.js` (Tests 1.1 through 1.5).
- **Status:** **RESOLVED**

---

### Finding SEC-05: Staff Audit Log Timestamp Inconsistency (RESOLVED in Phase 4.2.1)
- **Severity:** P2 (Medium)
- **Affected Files:** [`functions/index.js`](file:///home/navaneeth/Documents/Amal/functions/index.js), [`src/firebase/services/staffService.js`](file:///home/navaneeth/Documents/Amal/src/firebase/services/staffService.js)
- **Description:** Audit logs generated by Cloud Functions previously used client/handler ISO strings instead of server timestamps.
- **Remediation:** Changed all 6 callable audit writers in `functions/index.js` to `FieldValue.serverTimestamp()`. Updated `listStaffAuditLogs` to normalize Firestore `Timestamp` objects into ISO strings for UI compatibility.
- **Verification:** Test 6.3 in `scratch/test_final_security_hardening.js` verified native Firestore timestamp persistence and normalization.
- **Status:** **RESOLVED**

