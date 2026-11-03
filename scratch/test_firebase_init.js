import { createServer } from 'vite';
import { execSync } from 'child_process';
import fs from 'fs';

async function runFirebaseVerification() {
  console.log('======================================================');
  console.log('TPS BATTERYS HOUSE — FIREBASE INITIALIZATION TEST');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Verify .gitignore protects .env
  console.log('--- TEST 1: Gitignore & Secret Protection ---');
  try {
    const gitIgnoreOutput = execSync('git check-ignore .env', { encoding: 'utf-8' }).trim();
    assert(gitIgnoreOutput === '.env', '.env is properly ignored by Git');
  } catch {
    assert(false, '.env should be ignored by Git');
  }

  const envExampleExists = fs.existsSync('.env.example');
  assert(envExampleExists, '.env.example template file exists');

  if (envExampleExists) {
    const exampleContent = fs.readFileSync('.env.example', 'utf-8');
    const hasValues = exampleContent.split('\n').some((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return false;
      const parts = trimmed.split('=');
      return parts.length > 1 && parts[1].trim().length > 0;
    });
    assert(!hasValues, '.env.example contains sanitized variable keys with no exposed secrets');
  }

  // 2. Verify Firebase SDK initialization via Vite Module Loader
  console.log('\n--- TEST 2: Firebase SDK Modular Initialization ---');
  const server = await createServer({
    server: { middlewareMode: true },
    logLevel: 'error',
  });

  try {
    const firebaseModule = await server.ssrLoadModule('/src/firebase/firebase.js');
    const { default: app, auth, db, storage } = firebaseModule;

    assert(Boolean(app), 'Firebase app instance initialized');
    assert(app.name === '[DEFAULT]', 'Firebase app registered with [DEFAULT] name');
    assert(Boolean(auth), 'Firebase Auth instance initialized and exported');
    assert(Boolean(db), 'Cloud Firestore instance initialized and exported');
    assert(Boolean(storage), 'Firebase Storage instance initialized and exported');

    // 3. Verify testConnection utility
    console.log('\n--- TEST 3: Verification Utility (testConnection.js) ---');
    const testMod = await server.ssrLoadModule('/src/firebase/testConnection.js');
    const status = testMod.verifyFirebaseInitialization();

    assert(status.success === true, 'verifyFirebaseInitialization() reports success: true');
    assert(status.app === '[DEFAULT]', 'App name returned correctly in sanitized report');
    assert(status.services.auth === true, 'Auth service status reported as true');
    assert(status.services.firestore === true, 'Firestore service status reported as true');
    assert(status.services.storage === true, 'Storage service status reported as true');
  } finally {
    await server.close();
  }

  console.log('\n======================================================');
  console.log(`TOTAL PASS: ${passed}`);
  console.log(`TOTAL FAIL: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFirebaseVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

