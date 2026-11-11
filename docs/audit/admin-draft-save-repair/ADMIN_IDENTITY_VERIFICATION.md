# Administrator Identity & Authorization Verification
## TPS Battery House — Staff Access Control Audit

### 1. Verification Scope

To resolve whether Administrator draft saving failed due to identity or credential mismatches, the runtime authorization flow was audited across:
- `src/firebase/firebase.js`
- `src/context/AuthContext.jsx`
- `src/context/useAuth.js`
- `src/firebase/services/staffService.js`
- `src/firebase/services/trustedStaffBackend.js`
- `firestore.rules`

---

### 2. Runtime Identity Attributes

| Parameter | Authoritative Configuration | Verified Runtime Value | Status |
| :--- | :--- | :--- | :---: |
| **Business Scope** | Scoped multi-tenant root | `DEFAULT_BUSINESS_ID` (`tps-battery-house`) | **MATCH** |
| **Membership Path** | `businesses/{businessId}/members/{uid}` | `businesses/tps-battery-house/members/{auth.currentUser.uid}` | **MATCH** |
| **User Identifier** | Firebase Auth UID (`auth.currentUser.uid`) | Canonical UID string (1-128 chars) | **MATCH** |
| **Role Attribute** | `data.role` in member document | String `'admin'` (lowercase canonical) | **MATCH** |
| **Status Attribute** | `data.status` in member document | String `'active'` | **MATCH** |
| **Primary Admin Guard** | `businesses/{businessId}/settings/admin_config` | Validated by OCC admin guard; cannot be deleted or demoted | **MATCH** |

---

### 3. Identity Verification Checklist

1. **Email vs UID Resolution**:
   - The application does **not** rely on email for Firestore document lookup or rule authorization.
   - All membership documents are strictly keyed by `request.auth.uid`.
   - `getMemberDoc(businessId)` retrieves `/businesses/$(businessId)/members/$(request.auth.uid)`.
2. **Obsolete Placeholder UIDs**:
   - `MOCK_USER` in `src/data/mockData.js` is used solely as a passive display fallback when AuthContext is in unauthenticated demo mode.
   - In production and authenticated emulator flows, `AuthContext` provides the live `user` and `member` instances directly from Firebase Auth and Firestore.
3. **Role Casing & Mapping**:
   - `ROLES.ADMIN` is strictly `'admin'`.
   - `ROLE_CONFIG` maps `'admin'` to user-friendly label `'Administrator'`.
   - `firestore.rules` checks `data.role == 'admin'`. No casing mismatches exist.
4. **Cached vs Real-Time Membership**:
   - `AuthContext` maintains an active `onSnapshot` listener on `/businesses/tps-battery-house/members/{uid}`.
   - Any revocation or role demotion takes effect immediately in real time.

---

### 4. Conclusion

The Administrator's identity, UID resolution, and membership status are architecturally sound. The root cause of the observed failure was not an invalid identity or incorrect role mapping, but the Firestore security rules evaluation exceeding the CEL 1000-expression limit during update operations, coupled with the lack of dirty-state tracking for unchanged drafts.
