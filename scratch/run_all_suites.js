import { execSync, spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const suites = [
  'scratch/test_final_security_hardening.js',
  'scratch/test_staff_removal.js',
  'scratch/test_staff_security_hardening.js',
  'scratch/test_google_auth_identity_lifecycle.js',
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
  'scratch/test_financial_precision_comprehensive.mjs',
  'scratch/test_client_authorization_matrix.mjs',
  'scratch/test_client_invoice_concurrency.mjs',
  'scratch/test_financial_calculation_signoff.mjs',
  'scratch/test_phase_6b_vulnerabilities.mjs',
  'scratch/test_phase_6b1_targeted_verification.mjs',
  'scratch/test_dashboard_financial_metrics.mjs',
  'scratch/test_invoice_screen_integration.mjs',
  'scratch/test_navigation_wiring.mjs',
  'scratch/test_financial_total_zero_repair.mjs',
  'scratch/test_invoice_print_workflow.mjs',
  'scratch/test_invoice_layout_responsive.mjs',
];

function checkEmulatorRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8980/', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureEmulator() {
  const running = await checkEmulatorRunning();
  if (running) return null;

  const javaBin = [
    '/tmp/jdk-21/bin/java',
    '/usr/bin/java',
    'java',
  ].find((p) => p === 'java' || fs.existsSync(p)) || 'java';

  const jarPath = [
    '/tmp/firestore-emulator.jar',
    '/home/navaneeth/.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar',
  ].find((p) => fs.existsSync(p));

  if (!jarPath) {
    throw new Error('Could not find firestore-emulator.jar in /tmp or ~/.cache/firebase/emulators');
  }

  console.log(`[Runner] Starting Firestore emulator with ${javaBin} on 127.0.0.1:8980...`);
  const emuProcess = spawn(
    javaBin,
    [
      '-jar',
      jarPath,
      '--rules',
      'firestore.rules',
      '--host',
      '127.0.0.1',
      '--port',
      '8980',
      '--webchannel_port',
      '8981',
    ],
    { stdio: 'ignore', detached: true }
  );

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkEmulatorRunning()) {
      console.log('[Runner] Emulator is ready.');
      return emuProcess;
    }
  }
  throw new Error('Timed out waiting for Firestore emulator to start');
}

async function main() {
  let emuProc = null;
  try {
    emuProc = await ensureEmulator();
  } catch (err) {
    console.error('[Runner] Emulator startup error:', err);
    process.exit(1);
  }

  console.log('================================================================');
  console.log('TPS BATTERY HOUSE — FULL REGRESSION TEST RUNNER');
  console.log('================================================================\n');

  let totalPassed = 0;
  let totalFailed = 0;
  const results = [];

  try {
    for (const suite of suites) {
      process.stdout.write(`Running ${suite}... `);
      try {
        const output = execSync(
          `FIRESTORE_EMULATOR_HOST="127.0.0.1:8980" /home/navaneeth/.nvm/versions/node/v24.14.0/bin/node ${suite}`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        let passCount = 0;
        let failCount = 0;

        const passMatches = output.match(/✓\s+PASS/g);
        if (passMatches) passCount = passMatches.length;

        const failMatches = output.match(/✗\s+FAIL/g);
        if (failMatches) failCount = failMatches.length;

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
        if (err.stderr) console.log(`STDERR:\n${err.stderr}`);
        if (err.stdout) console.log(`STDOUT:\n${err.stdout}`);
        totalFailed++;
        results.push({ suite, passCount: 0, failCount: 1, status: 'ERROR', error: err.message });
      }
    }
  } finally {
    if (emuProc) {
      try {
        process.kill(-emuProc.pid, 'SIGKILL');
      } catch {
        try {
          emuProc.kill('SIGKILL');
        } catch {}
      }
    }
  }

  console.log('\n================================================================');
  console.log(
    `FINAL REGRESSION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED ACROSS ${suites.length} SUITES`
  );
  console.log('================================================================');

  for (const r of results) {
    console.log(` - ${r.suite.padEnd(52)} : ${r.passCount} passed, ${r.failCount} failed [${r.status}]`);
  }

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main();

