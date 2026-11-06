import { execSync } from 'child_process';

const suites = [
  'scratch/test_staff_management_integration.js',
  'scratch/test_financial_settings_security.js',
  'scratch/test_business_settings_integration.js',
  'scratch/test_customer_management_integration.js',
  'scratch/test_product_catalog_integration.js',
  'scratch/test_invoice_management_integration.js',
  'scratch/test_invoice_production_readiness.js',
  'scratch/test_invoice_security_hardening.js',
  'scratch/test_adversarial_security_review.js',
  'scratch/test_emulator_rules.js',
  'scratch/test_firestore_rules_security.js',
  'scratch/test_auth_access_control.js',
  'scratch/test_save_integrity_suite.js',
  'scratch/test_traditional_invoice_suite.js',
  'scratch/test_multi_category_suite.js',
];

console.log('================================================================');
console.log('TPS BATTERY HOUSE — FULL REGRESSION TEST RUNNER');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of suites) {
  process.stdout.write(`Running ${suite}... `);
  try {
    const output = execSync(
      `FIRESTORE_EMULATOR_HOST="127.0.0.1:8980" /home/navaneeth/.nvm/versions/node/v24.14.0/bin/node ${suite}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    
    // Parse pass/fail counts
    let passCount = 0;
    let failCount = 0;

    const passMatches = output.match(/✓\s+PASS/g);
    if (passMatches) passCount = passMatches.length;

    const failMatches = output.match(/✗\s+FAIL/g);
    if (failMatches) failCount = failMatches.length;

    // Also look for summary lines like: RESULTS: X PASSED, Y FAILED
    const summaryMatch = output.match(/RESULTS:?\s+(\d+)\s+PASSED,?\s+(\d+)\s+FAILED/i);
    if (summaryMatch) {
      passCount = parseInt(summaryMatch[1], 10);
      failCount = parseInt(summaryMatch[2], 10);
    }

    totalPassed += passCount;
    totalFailed += failCount;

    results.push({ suite, passCount, failCount, status: failCount === 0 ? 'PASS' : 'FAIL' });
    console.log(`✓ [${passCount} passed, ${failCount} failed]`);
  } catch (err) {
    console.log(`✗ CRASHED: ${err.message}`);
    totalFailed++;
    results.push({ suite, passCount: 0, failCount: 1, status: 'ERROR', error: err.message });
  }
}

console.log('\n================================================================');
console.log(`FINAL REGRESSION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED ACROSS ${suites.length} SUITES`);
console.log('================================================================');

for (const r of results) {
  console.log(` - ${r.suite.padEnd(52)} : ${r.passCount} passed, ${r.failCount} failed [${r.status}]`);
}

if (totalFailed > 0) {
  process.exit(1);
}

