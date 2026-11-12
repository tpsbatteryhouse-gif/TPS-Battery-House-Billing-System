# Test Evidence: Administrator Draft Save & Unchanged Invoice Repair

**Project:** TPS BATTERY HOUSE — GST Billing & Invoice Management System  
**Date:** 2026-11-11  
**Target:** Local Firestore Emulator & Full Regression Suite  
**Result:** 1,281 tests passed, 0 failed across 38 suites (100% pass rate)

---

## 1. Targeted Suite Execution: `scratch/test_admin_draft_save_permissions.mjs`

### Command
```bash
node scratch/test_admin_draft_save_permissions.mjs
```

### Output Transcript
```text
[Suite] Starting Firestore emulator with /tmp/jdk-21/bin/java...
[Suite] Emulator is ready.

================================================================
TPS BATTERY HOUSE — ADMIN DRAFT SAVE & UNCHANGED INVOICE SUITE
================================================================

--- PART 1: ADMINISTRATOR DRAFT CREATION, UPDATE & UNCHANGED HANDLING ---
  ✓ PASS: 1. Real authenticated Administrator creates a draft
  ✓ PASS: 2. Administrator updates an existing draft
  ✓ PASS: 3. Administrator saves an unchanged draft without unnecessary writes

--- PART 2: STAFF ROLE AUTHORIZATION MATRIX ---
  ✓ PASS: 4. Manager creates a draft
  ✓ PASS: 5. Cashier creates a draft
  ✓ PASS: 6. Pending staff are rejected
  ✓ PASS: 7. Disabled staff are rejected
  ✓ PASS: 8. Removed staff are rejected
  ✓ PASS: 9. Unauthenticated users are rejected

--- PART 3: COUNTER & NUMBER RESERVATION ISOLATION ---
  ✓ PASS: 10. Missing financial-year counter does not prevent draft creation
  ✓ PASS: 11. Draft creation does not increment the official invoice counter
  ✓ PASS: 12. Draft creation does not create an issued-invoice reservation

--- PART 4: DRAFT IDENTITY & PERSISTENCE INTEGRITY ---
  ✓ PASS: 13. Existing draft identity remains unchanged after updates
  ✓ PASS: 14. Draft data survives reload
  ✓ PASS: 15. Cross-business access is denied

--- PART 5: DRAFT DEMOTION GUARDS & OFFICIAL ISSUANCE ---
  ✓ PASS: 16. Issued invoices cannot be converted back into drafts
  ✓ PASS: 17. Draft can subsequently be issued through the correct issuance transaction

================================================================
RESULTS: 17 PASSED, 0 FAILED
================================================================
```

---

## 2. Complete Regression Suite: `scratch/run_all_suites.js`

### Command
```bash
node scratch/run_all_suites.js
```

### Result Summary
```text
================================================================
FINAL REGRESSION SUMMARY: 1281 PASSED, 0 FAILED ACROSS 38 SUITES
================================================================
 - scratch/test_final_security_hardening.js             : 39 passed, 0 failed [PASS]
 - scratch/test_staff_removal.js                        : 34 passed, 0 failed [PASS]
 - scratch/test_staff_security_hardening.js             : 40 passed, 0 failed [PASS]
 - scratch/test_google_auth_identity_lifecycle.js       : 45 passed, 0 failed [PASS]
 - scratch/test_staff_management_integration.js         : 49 passed, 0 failed [PASS]
 - scratch/test_financial_settings_security.js          : 41 passed, 0 failed [PASS]
 - scratch/test_business_settings_integration.js        : 46 passed, 0 failed [PASS]
 - scratch/test_customer_management_integration.js      : 53 passed, 0 failed [PASS]
 - scratch/test_product_catalog_integration.js          : 55 passed, 0 failed [PASS]
 - scratch/test_invoice_management_integration.js       : 39 passed, 0 failed [PASS]
 - scratch/test_invoice_production_readiness.js         : 39 passed, 0 failed [PASS]
 - scratch/test_invoice_security_hardening.js           : 37 passed, 0 failed [PASS]
 - scratch/test_adversarial_security_review.js          : 40 passed, 0 failed [PASS]
 - scratch/test_emulator_rules.js                       : 41 passed, 0 failed [PASS]
 - scratch/test_firestore_rules_security.js             : 85 passed, 0 failed [PASS]
 - scratch/test_auth_access_control.js                  : 80 passed, 0 failed [PASS]
 - scratch/test_save_integrity_suite.js                 : 64 passed, 0 failed [PASS]
 - scratch/test_traditional_invoice_suite.js            : 25 passed, 0 failed [PASS]
 - scratch/test_multi_category_suite.js                 : 41 passed, 0 failed [PASS]
 - scratch/test_financial_precision_comprehensive.mjs   : 16 passed, 0 failed [PASS]
 - scratch/test_client_authorization_matrix.mjs         : 65 passed, 0 failed [PASS]
 - scratch/test_client_invoice_concurrency.mjs          : 5 passed, 0 failed [PASS]
 - scratch/test_financial_calculation_signoff.mjs       : 11 passed, 0 failed [PASS]
 - scratch/test_phase_6b_vulnerabilities.mjs            : 13 passed, 0 failed [PASS]
 - scratch/test_phase_6b1_targeted_verification.mjs     : 22 passed, 0 failed [PASS]
 - scratch/test_dashboard_financial_metrics.mjs         : 69 passed, 0 failed [PASS]
 - scratch/test_invoice_screen_integration.mjs          : 19 passed, 0 failed [PASS]
 - scratch/test_navigation_wiring.mjs                   : 8 passed, 0 failed [PASS]
 - scratch/test_financial_total_zero_repair.mjs         : 16 passed, 0 failed [PASS]
 - scratch/test_invoice_print_workflow.mjs              : 11 passed, 0 failed [PASS]
 - scratch/test_invoice_layout_responsive.mjs           : 8 passed, 0 failed [PASS]
 - scratch/test_invoice_redesign.mjs                    : 13 passed, 0 failed [PASS]
 - scratch/test_invoice_empty_initialization_and_print_validation.mjs : 22 passed, 0 failed [PASS]
 - scratch/test_firestore_invoice_save_permission.mjs   : 19 passed, 0 failed [PASS]
 - scratch/test_invoice_form_state_integrity.mjs        : 20 passed, 0 failed [PASS]
 - scratch/test_invoice_line_item_display.mjs           : 14 passed, 0 failed [PASS]
 - scratch/test_save_for_later_workflow.mjs             : 20 passed, 0 failed [PASS]
 - scratch/test_admin_draft_save_permissions.mjs        : 17 passed, 0 failed [PASS]
```

---

## 3. Linter & Build Verification

### Linter (`oxlint`)
```bash
./node_modules/.bin/oxlint
Found 0 warnings and 0 errors.
Finished in 124ms on 112 files with 104 rules using 8 threads.
```

### Production Build (`npm run build`)
```bash
npm run build
vite v8.3.5 building client environment for production...
✓ 2257 modules transformed.
✓ built in 1.81s
```
All assets compiled cleanly with zero build errors.
