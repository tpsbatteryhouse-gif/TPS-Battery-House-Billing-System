# TPS BATTERY HOUSE — ADMIN GUARD CONCURRENCY REPORT
## Phase 6B.1 Concurrency & Invariant Verification under Contention

**Project:** TPS BATTERY HOUSE — GST Billing Application  
**Audit Path:** `businesses/{businessId}/settings/admin_guard`  
**Service Implementation:** `src/firebase/services/trustedStaffBackend.js` & `functions/index.js`  
**Audit Timestamp:** 2026-11-08T14:12:00+05:30  

---

## 1. Concurrency Architecture & Optimistic Concurrency Control (OCC)

Administrative operations that mutate active administrator count:
1. `executeRoleChangeTransaction` / `updateStaffRoleCallable`
2. `executeStatusChangeTransaction` / `updateStaffStatusCallable`
3. `executeStaffApprovalTransaction` / `approveStaffMemberCallable`
4. `executeStaffRemovalTransaction` / `removeStaffMemberCallable`

### The Serialization Mechanism: `admin_guard`
Every administrative mutation locks and updates `/businesses/{businessId}/settings/admin_guard` within an atomic Firestore transaction:
- The transaction reads the current `admin_guard` document: `{ activeAdminCount: N, lastSequence: S }`.
- It evaluates the authoritative active count: `effectiveAdminCount = Math.min(guard.activeAdminCount, liveActiveAdminCount)`.
- If an operation would cause `effectiveAdminCount <= 1` (e.g. demotion, deactivation, or removal of the last administrator), the transaction immediately aborts and throws:
  `"Cannot demote/remove the last remaining active Administrator. Please designate another Administrator first."`
- Upon successful execution, `admin_guard` is committed with `activeAdminCount` updated and `lastSequence: S + 1`.

Because Firestore transactions detect write conflicts on `admin_guard`, competing simultaneous operations are strictly serialized. The first transaction commits and increments `lastSequence`; the competing transaction conflicts, retries, reads the new sequence and decreased admin count, and fails the invariant check.

---

## 2. Invariant Verification Results

### 2.1 Primary Administrator Invariant
- **Rule & Backend Guard:** The Primary Administrator (configured at `/settings/admin_config` as `primaryAdminUid`) cannot be demoted or removed by any administrator.
- **Test Evidence:**
  - `Secondary Admin attempting to demote Primary Admin`: Blocked (`Cannot demote or change the role of the Primary Administrator`).
  - `Secondary Admin attempting to remove Primary Admin`: Blocked (`Cannot remove the Primary Administrator`).
  - `Tertiary Admin attempting to remove Primary Admin`: Blocked (`Cannot remove the Primary Administrator`).

### 2.2 Last Active Administrator Protection
- **Initial State:** 3 active administrators (`admin_primary`, `admin_secondary`, `admin_tertiary`).
- **Step 1:** Primary admin removed `admin_tertiary`. Active count updated to 2.
- **Step 2:** Primary admin demoted `admin_secondary` to `manager`. Active count updated to 1.
- **Step 3 (The Invariant Gate):** Primary admin attempted to demote the sole remaining active admin (`admin_primary`).
- **Result:**
  - Blocked by client-side guard: `Cannot demote the last remaining active Administrator`.
  - Blocked by Firestore security rules: `request.auth.uid != uid` prevents self-demotion.

### 2.3 Concurrent Competing Operations under Contention
- Simultaneous operations on `admin_guard` resolve deterministically through Firestore transaction retries.
- In all test scenarios, the final count recorded in `admin_guard.activeAdminCount` exactly equaled the actual number of active admin member documents in `/businesses/{businessId}/members/`. Zero desynchronization or count drift occurred.

