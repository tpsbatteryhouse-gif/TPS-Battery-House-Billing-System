# TPS BATTERY HOUSE — FINANCIAL TEST EVIDENCE
## Automated Test Results, Regression Verification & Mathematical Invariants

**Document Reference:** `docs/audit/dashboard-financial-reconciliation/FINANCIAL_TEST_EVIDENCE.md`  
**Test Suite:** `scratch/test_dashboard_financial_metrics.mjs`  
**Runner:** `scratch/run_all_suites.js`  
**Execution Timestamp:** 2026-11-08T16:38:56+05:30  
**Overall Regression Result:** **1094 PASSED, 0 FAILED across 26 suites**

---

## 1. Targeted Dashboard Metrics Test Suite

File: `scratch/test_dashboard_financial_metrics.mjs`  
Assertions: **69 Passed, 0 Failed**

### Test Categories Executed:
1. **Indian Financial Year Rollover & Boundaries:**
   - Verified April 1 start date rollover (`2026-04-01` -> `2026-27`).
   - Verified March 31 end date boundary (`2027-03-31` -> `2026-27`).
   - Verified mid-year assignment (`2026-11-08` -> `2026-27`).
   - Verified prior calendar year Q4 assignment (`2026-01-15` -> `2025-26`).

2. **Date Boundaries and Midnight Inclusions:**
   - Verified `00:00:00.000` to `23:59:59.999` day boundaries.
   - Verified midnight timestamp inclusion (`YYYY-MM-DD` strings correctly parsed without timezone clipping).
   - Verified relative exclusion of prior and post-period invoices.

3. **Empty Dataset Resilience:**
   - Zero invoices dataset returns `0` for all counts, billed amounts, and collection rates.
   - Zero division guarded: `invoicePaymentRate === 0` and `revenueCollectionRate === 0` without `NaN`.
   - Balanced invariant holds on empty set (`isBalanced: true`, `discrepancy: 0`).

4. **Lifecycle Segregation (Draft & Cancelled Exclusions):**
   - Verified that `Draft` (50,000) and `Cancelled` (30,000) invoices are completely excluded from `totalBilled`.
   - Verified `totalBilled` strictly equals issued total (`45,000`).
   - Verified `draftBilled` tracks draft amount (`50,000`) independently.
   - Verified rates use issued invoice denominator only (`1/3 = 33.33%`, not `1/5`).

5. **Mixed-Category Proportional Deduction Allocation:**
   - Evaluated 3-category invoice (Battery ₹10,000 + Inverter ₹20,000 + Services ₹5,000 = ₹35,000 gross).
   - Applied ₹3,500 invoice discount (Net Payable = ₹31,500).
   - Proportional allocation: Battery ₹9,000.00, Inverter ₹18,000.00, Services ₹4,500.00.
   - Exact sum verified: `9000 + 18000 + 4500 === 31500`.

6. **Residual Paise Distribution Across Fractional Fractions:**
   - Evaluated non-terminating fractional allocation (100 vs 200 gross, ₹295 net).
   - Verified allocation of `98.33` + `196.67` = `295.00` with 0 residual loss.

7. **Production Mock Dataset Reconciliation:**
   - 7 total invoices in initial dataset (6 issued, 1 draft).
   - Total Billed: **₹1,37,900.00**.
   - Collected Revenue: **₹79,500.00**.
   - Pending Amount: **₹32,000.00**.
   - Overdue Amount: **₹26,400.00**.
   - Total Outstanding: **₹58,400.00**.
   - Equation Verified: `Total Billed (137,900) === Collected (79,500) + Outstanding (58,400)`.
   - Reconciled Category Sum: **₹1,37,900.00**.
   - Discrepancy: **₹0.00**.

---

## 2. Full Continuous Regression Runner Summary

```
================================================================
TPS BATTERY HOUSE — FULL REGRESSION TEST RUNNER
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

================================================================
FINAL REGRESSION SUMMARY: 1094 PASSED, 0 FAILED ACROSS 26 SUITES
================================================================
```

---

## 3. Static Analysis & Build Verification

- **Oxlint:** `Found 0 warnings and 0 errors. Finished in 81ms on 86 files with 104 rules using 8 threads.`
- **Vite Build:** `✓ built in 1.44s`.

