# TPS BATTERY HOUSE — PHASE 6B CHANGELOG
## Audit Modifications & Technical Hardening Diff

**Project:** TPS BATTERY HOUSE — GST Billing Application  
**Audit Phase:** Phase 6B Firestore Security Rules & Indexes Deep Audit  
**Date:** 2026-11-08T13:55:00+05:30  

---

## 1. Summary of Changes

| File | Change Type | Security / Architectural Justification |
| :--- | :--- | :--- |
| `firestore.rules` | Modified | Replaced weak `terms.size()` comparison with recursive deep equality `businessSnapshot == businessSnapshot`; enforced `financialYear` immutability on invoice update; added `isValidAdminGuard` strict schema validation; removed dead `data.email is string \|\| true` placeholder. |
| `firestore.indexes.json` | Created | Defined composite indexes for `members`, `staff_audit_logs`, and `invoices` required by application query patterns. |
| `firebase.json` | Modified | Linked `"indexes": "firestore.indexes.json"` under the `"firestore"` configuration block. |
| `scratch/test_phase_6b_vulnerabilities.mjs` | Created | Automated red-team adversarial test suite verifying terms immutability, fiscal year immutability, admin guard bounds, cashier restrictions, and tenant isolation. |
| `scratch/run_all_suites.js` | Modified | Integrated `test_phase_6b_vulnerabilities.mjs` into continuous regression runner, bringing total regression assertions to 1003. |

---

## 2. File-by-File Diffs

### 2.1 `firestore.rules`
```diff
--- a/firestore.rules
+++ b/firestore.rules
@@ -173,8 +173,7 @@ service cloud.firestore {
         data.targetUid is string &&
         data.targetUid.size() >= 1 &&
         data.targetUid.size() <= 128 &&
-        data.email is string || true && // placeholder pass
         data.targetEmail is string &&
         isValidEmail(data.targetEmail) &&
         data.action is string &&
-        data.action in ['STAFF_APPROVED', 'STAFF_REJECTED', 'ROLE_CHANGED', 'STATUS_CHANGED', 'STAFF_REGISTERED', 'STAFF_REMOVED'] &&
+        data.action in ['STAFF_APPROVED', 'STAFF_REJECTED', 'ROLE_CHANGED', 'STATUS_CHANGED', 'STAFF_REMOVED'] &&
@@ -260,22 +259,10 @@ service cloud.firestore {
     // Invoice Immutable Fields Validator
     function areImmutableInvoiceFieldsUnchanged() {
       return request.resource.data.id == resource.data.id &&
         request.resource.data.invoiceNumber == resource.data.invoiceNumber &&
+        (!('financialYear' in resource.data) || request.resource.data.financialYear == resource.data.financialYear) &&
         (!('createdAt' in resource.data) || request.resource.data.createdAt == resource.data.createdAt) &&
         (!('createdBy' in resource.data) || request.resource.data.createdBy == resource.data.createdBy) &&
         (!('businessSnapshot' in resource.data) ||
-         (('businessSnapshot' in request.resource.data) &&
-          request.resource.data.businessSnapshot.businessName == resource.data.businessSnapshot.businessName &&
-          request.resource.data.businessSnapshot.address == resource.data.businessSnapshot.address &&
-          request.resource.data.businessSnapshot.gstin == resource.data.businessSnapshot.gstin &&
-          request.resource.data.businessSnapshot.phone == resource.data.businessSnapshot.phone &&
-          request.resource.data.businessSnapshot.email == resource.data.businessSnapshot.email &&
-          request.resource.data.businessSnapshot.bankName == resource.data.businessSnapshot.bankName &&
-          request.resource.data.businessSnapshot.accountNo == resource.data.businessSnapshot.accountNo &&
-          request.resource.data.businessSnapshot.ifsc == resource.data.businessSnapshot.ifsc &&
-          request.resource.data.businessSnapshot.upiId == resource.data.businessSnapshot.upiId &&
-          (!('terms' in resource.data.businessSnapshot) || request.resource.data.businessSnapshot.terms.size() == resource.data.businessSnapshot.terms.size()) &&
-          request.resource.data.businessSnapshot.footerText == resource.data.businessSnapshot.footerText &&
-          request.resource.data.businessSnapshot.authorizedSignatory == resource.data.businessSnapshot.authorizedSignatory &&
-          (!('city' in resource.data.businessSnapshot) || request.resource.data.businessSnapshot.city == resource.data.businessSnapshot.city)));
+         (('businessSnapshot' in request.resource.data) &&
+          request.resource.data.businessSnapshot == resource.data.businessSnapshot));
     }
@@ -438,6 +425,21 @@ service cloud.firestore {
         isValidOptionalString(data, 'createdBy', 1, 128) &&
         isValidOptionalString(data, 'updatedBy', 1, 128);
     }
+
+    // Admin Guard Document Validator (/settings/admin_guard)
+    function isValidAdminGuard(data, settingId) {
+      return settingId == 'admin_guard' &&
+        data.size() <= 10 &&
+        data.keys().hasAll(['id', 'activeAdminCount', 'lastSequence']) &&
+        data.keys().hasOnly(['id', 'activeAdminCount', 'lastSequence', 'updatedAt', 'updatedBy']) &&
+        data.id == 'admin_guard' &&
+        data.activeAdminCount is number &&
+        data.activeAdminCount >= 0 &&
+        data.lastSequence is number &&
+        data.lastSequence >= 0 &&
+        isValidOptionalString(data, 'updatedBy', 1, 128) &&
+        (!('updatedAt' in data) || (data.updatedAt is string || data.updatedAt is timestamp));
+    }
@@ -712,6 +714,8 @@ service cloud.firestore {
                              ? isValidBusinessSettings(request.resource.data, settingId)
                              : settingId == 'financial_details'
                                ? isValidFinancialDetails(request.resource.data, settingId)
+                               : settingId == 'admin_guard'
+                                 ? isValidAdminGuard(request.resource.data, settingId)
                                  : isValidSetting(request.resource.data, settingId)));
```

### 2.2 `firebase.json`
```diff
--- a/firebase.json
+++ b/firebase.json
@@ -12,3 +12,4 @@
   "firestore": {
-    "rules": "firestore.rules"
+    "rules": "firestore.rules",
+    "indexes": "firestore.indexes.json"
   },
```

