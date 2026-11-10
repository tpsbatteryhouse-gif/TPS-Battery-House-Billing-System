# Staff Membership & Role Authorization Review

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**System Location:** `/home/navaneeth/Documents/Amal`  
**Date:** 2026-11-10  
**Scope:** Verification of Staff Membership Resolution, Role Propagation, and Security Rule Alignment  

---

## 1. Authentication & Membership Resolution Flow

### Membership Schema (`businesses/{bizId}/members/{uid}`)
Each staff member in TPS BATTERY HOUSE has a dedicated record in Firestore:
```json
{
  "uid": "manager_uid",
  "email": "manager@tpsbatteryhouse.com",
  "displayName": "Navaneeth P.P",
  "role": "manager",
  "status": "active",
  "createdAt": "2026-11-09T10:00:00.000Z",
  "createdBy": "admin_uid"
}
```

### Role Hierarchy & Permissions Matrix
The system enforces strict 3-tier Role-Based Access Control (RBAC):

| Capability / Action | Admin | Store Manager (`manager`) | Cashier (`cashier`) | Pending / Disabled Staff |
| :--- | :---: | :---: | :---: | :---: |
| **Create Invoices** | Yes | Yes | Yes | **NO (Denied)** |
| **Read Invoices** | Yes | Yes | Yes | **NO (Denied)** |
| **Increment Counter during Invoice Create** | Yes | Yes (Monotonic +1) | Yes (Monotonic +1) | **NO (Denied)** |
| **Initialize / Create New Counters** | Yes | **NO (Denied)** | **NO (Denied)** | **NO (Denied)** |
| **Arbitrary Counter Maintenance / Rollback** | Guarded (>= current) | **NO (Denied)** | **NO (Denied)** | **NO (Denied)** |
| **Delete Invoices** | Yes | **NO (Denied)** | **NO (Denied)** | **NO (Denied)** |
| **Manage Staff Memberships** | Yes | **NO (Denied)** | **NO (Denied)** | **NO (Denied)** |

---

## 2. Identified Gap in Context Propagation

Prior to this repair, `src/hooks/useInvoices.js` only destructured `user` from `useAuth()`:
```javascript
// BEFORE:
export function useInvoices(businessId = DEFAULT_BUSINESS_ID, businessConfig = {}) {
  const { user, permissions } = useAuth();
  // ...
  const saveInvoice = useCallback(
    async (invoiceData) => {
      // user here was auth.currentUser, which has no .role property!
      return await createInvoiceWithCounter(businessId, invoiceData, user, { prefix });
    },
    [businessId, invoices, user, businessConfig.invoicePrefix]
  );
```

### The Resolution
In `src/hooks/useInvoices.js`, `member` is now destructured from `useAuth()`, and an enriched `authUser` is constructed:
```javascript
// AFTER:
export function useInvoices(businessId = DEFAULT_BUSINESS_ID, businessConfig = {}) {
  const { user, member, permissions } = useAuth();
  // ...
  const saveInvoice = useCallback(
    async (invoiceData) => {
      const authUser = user
        ? {
            ...user,
            role: member?.role,
            status: member?.status,
            permissions,
          }
        : null;

      if (isExisting) {
        return await updateInvoice(businessId, invoiceData.id, invoiceData, authUser);
      } else {
        const prefix = businessConfig.invoicePrefix || 'TPS/2026-27/';
        return await createInvoiceWithCounter(businessId, invoiceData, authUser, { prefix });
      }
    },
    [businessId, invoices, user, member, permissions, businessConfig.invoicePrefix]
  );
```
This guarantees that whenever client-side code inspects user privileges (e.g. `user?.role === 'admin'`), the verified staff membership is accurately reflected without altering or bypassing server-side security rules.

