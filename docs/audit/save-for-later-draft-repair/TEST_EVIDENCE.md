# Test Evidence: Save for Later (Draft) Workflow & Security Rules
## TPS Battery House — Verification Report

**Environment**: Local Firestore Emulator daemon (`127.0.0.1:8980`)  
**Node.js**: v24.14.0  
**Java**: OpenJDK 21  
**Timestamp**: 2026-11-11  

---

### 1. Dedicated Draft Workflow Suite (`scratch/test_save_for_later_workflow.mjs`)

The test suite covers all 19 requirements specified in the prompt plus end-to-end Save & Print validation.

| Scenario | Objective / Test Case | Result | Details |
| :--- | :--- | :---: | :--- |
| **Scenario 1** | Admin saves a draft | **PASS** | Successfully persisted with `paymentStatus: 'Draft'`, `invoiceNumber: DRAFT-xxxxxx`. |
| **Scenario 2** | Manager saves a draft | **PASS** | Successfully persisted with `paymentStatus: 'Draft'`, `invoiceNumber: DRAFT-xxxxxx`. |
| **Scenario 3** | Cashier saves a draft | **PASS** | Cashier successfully staged draft invoice under their membership. |
| **Scenario 4** | Disabled staff cannot save a draft | **PASS** | Rejected with `PERMISSION_DENIED`. |
| **Scenario 5** | Removed staff cannot save a draft | **PASS** | Non-member context rejected with `PERMISSION_DENIED`. |
| **Scenario 6** | Unauthenticated user cannot save a draft | **PASS** | Rejected with `PERMISSION_DENIED`. |
| **Scenario 7** | Draft creation works when financial-year counter is missing | **PASS** | Draft created without `counters/invoices_2026-27` existing; prospective preview sequence ignored. |
| **Scenario 8** | Saving a draft does not increment the counter | **PASS** | Counter document strictly does NOT exist in Firestore. |
| **Scenario 9** | Saving a draft does not create an issued-invoice reservation | **PASS** | Collection `/invoice_numbers/` has 0 documents. |
| **Scenario 10** | Repeated clicks do not create duplicate drafts | **PASS** | 3 successive clicks on same draft update the single document; no duplicate documents created. |
| **Scenario 11** | Existing draft updates preserve its identity | **PASS** | Document ID, `invoiceNumber` (`DRAFT-xxxxxx`), and `createdAt` preserved across draft modifications. |
| **Scenario 12** | Customer details survive save and reload | **PASS** | Customer name, phone, address, district, state code, GSTIN verified verbatim. |
| **Scenario 13** | Line items survive save and reload | **PASS** | Multi-category line items (Exide Battery, Luminous Inverter) verified verbatim. |
| **Scenario 14** | Discounts and old battery values survive save and reload | **PASS** | Additional discount (₹500) and scrap exchange (₹1,500) verified verbatim. |
| **Scenario 15** | GST and financial values remain unchanged | **PASS** | Final net payable (₹56,100) matches centralized GST calculations. |
| **Scenario 16** | Draft can subsequently be issued successfully | **PASS** | Draft transitioned to `paymentStatus: 'Paid'` via atomic transaction. |
| **Scenario 17** | Issuance allocates one official invoice number and updates counter & reservation | **PASS** | Sequential number `TPS/2026-27/001` assigned; counter updated to `lastSeq: 1`; reservation created. |
| **Scenario 18** | Duplicate issuance is rejected | **PASS** | Attempting to issue the same draft twice is rejected. |
| **Scenario 19** | Cross-business draft access is rejected | **PASS** | Writes to non-authorized tenant business ID rejected with `PERMISSION_DENIED`. |
| **Scenario 20** | Save & Print permanent issuance workflow remains completely intact | **PASS** | Normal new invoice issuance allocates next sequential number (`TPS/2026-27/002`) seamlessly. |

**Result Summary**: **20 passed, 0 failed [100% PASS]**

---

### 2. Full System Regression Test Suite (`scratch/run_all_suites.js`)

All 37 test suites executed against the live Firestore Emulator daemon:

```
================================================================
FINAL REGRESSION SUMMARY: 1264 PASSED, 0 FAILED ACROSS 37 SUITES
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
```

---

### 3. Static Analysis & Build Verification

- **Oxlint**:
  ```
  Found 0 warnings and 0 errors.
  Finished in 143ms on 110 files with 104 rules using 8 threads.
  ```
- **Vite Production Build**:
  ```
  ✓ built in 1.60s (dist/ produced cleanly, 0 build errors)
  ```

