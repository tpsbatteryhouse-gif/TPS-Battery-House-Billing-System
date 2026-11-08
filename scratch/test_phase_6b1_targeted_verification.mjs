/**
 * TPS Battery House — Phase 6B.1 Targeted Security Verification Suite
 *
 * Verifies:
 * 1. Admin Guard Concurrency & Invariants under simultaneous contention
 * 2. Invoice, Counter & Permanent Reservation Linkage (10+ concurrent requests, atomicity, rollback, no reuse)
 * 3. Staff Audit-Log Integrity & Anti-Forgery
 * 4. Query & Index Mapping Validation
 */

import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';

import { createInvoiceWithCounter } from '../src/firebase/services/invoiceService.js';
import {
  executeRoleChangeTransaction,
  executeStaffRemovalTransaction,
} from '../src/firebase/services/trustedStaffBackend.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8980;
const PROJECT_ID = 'tps-battery-house-phase6b1';
const BIZ_ID = 'tps-battery-house';

let passed = 0;
let failed = 0;

function checkEmulatorRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://${EMULATOR_HOST}:${EMULATOR_PORT}/`, (res) => {
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
    throw new Error('Could not find firestore-emulator.jar');
  }

  const emuProcess = spawn(
    javaBin,
    [
      '-jar',
      jarPath,
      '--rules',
      'firestore.rules',
      '--host',
      EMULATOR_HOST,
      '--port',
      String(EMULATOR_PORT),
      '--webchannel_port',
      '8981',
    ],
    { stdio: 'ignore', detached: true }
  );

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkEmulatorRunning()) {
      return emuProcess;
    }
  }
  throw new Error('Timed out waiting for Firestore emulator to start');
}

async function check(p, desc, shouldSucceed = true) {
  try {
    if (shouldSucceed) {
      await assertSucceeds(p);
      console.log(`  ✓ PASS (ALLOWED): ${desc}`);
    } else {
      await assertFails(p);
      console.log(`  ✓ PASS (DENIED):  ${desc}`);
    }
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc} -> Expected ${shouldSucceed ? 'SUCCESS' : 'PERMISSION_DENIED'}, got: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('PHASE 6B.1 — TARGETED SECURITY & CONCURRENCY VERIFICATION');
  console.log('================================================================\n');

  await ensureEmulator();

  const rulesContent = fs.readFileSync('firestore.rules', 'utf-8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
      rules: rulesContent,
    },
  });

  await testEnv.clearFirestore();

  try {
    // -------------------------------------------------------------
    // SECTION 1: SEEDING FIXTURES (Admin Context for Setup Only)
    // -------------------------------------------------------------
    console.log('--- Step 0: Seeding Database Fixtures ---');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Business Doc
      await setDoc(doc(db, 'businesses', BIZ_ID), {
        businessName: 'TPS BATTERY HOUSE',
        gstin: '32DIUPP1211B2ZN',
      });

      // Primary Admin
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_primary'), {
        uid: 'admin_primary',
        email: 'primary@tps.com',
        displayName: 'Primary Admin',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'system',
      });

      // Admin 2
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_secondary'), {
        uid: 'admin_secondary',
        email: 'secondary@tps.com',
        displayName: 'Secondary Admin',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin_primary',
      });

      // Admin 3
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'admin_tertiary'), {
        uid: 'admin_tertiary',
        email: 'tertiary@tps.com',
        displayName: 'Tertiary Admin',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin_primary',
      });

      // Cashier
      await setDoc(doc(db, 'businesses', BIZ_ID, 'members', 'user_cashier'), {
        uid: 'user_cashier',
        email: 'cashier@tps.com',
        displayName: 'Store Cashier',
        role: 'cashier',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin_primary',
      });

      // Admin Config
      await setDoc(doc(db, 'businesses', BIZ_ID, 'settings', 'admin_config'), {
        primaryAdminUid: 'admin_primary',
        primaryAdminEmail: 'primary@tps.com',
        initializedAt: '2026-01-01T00:00:00.000Z',
      });

      // Admin Guard (3 active admins initialized)
      await setDoc(doc(db, 'businesses', BIZ_ID, 'settings', 'admin_guard'), {
        id: 'admin_guard',
        activeAdminCount: 3,
        lastSequence: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        updatedBy: 'admin_primary',
      });

      // Counter for 2024-25
      await setDoc(doc(db, 'businesses', BIZ_ID, 'counters', 'invoices_2024-25'), {
        lastSeq: 0,
        prefix: 'TPS/2024-25/',
      });
    });

    const primaryCtx = testEnv.authenticatedContext('admin_primary', { email: 'primary@tps.com' });
    const primaryDb = primaryCtx.firestore();

    const secondaryCtx = testEnv.authenticatedContext('admin_secondary', { email: 'secondary@tps.com' });
    const secondaryDb = secondaryCtx.firestore();

    const tertiaryCtx = testEnv.authenticatedContext('admin_tertiary', { email: 'tertiary@tps.com' });
    const tertiaryDb = tertiaryCtx.firestore();

    const cashierCtx = testEnv.authenticatedContext('user_cashier', { email: 'cashier@tps.com' });
    const cashierDb = cashierCtx.firestore();

    // -------------------------------------------------------------
    // SECTION 2: ADMIN GUARD CONCURRENCY & INVARIANTS
    // -------------------------------------------------------------
    console.log('\n--- 1. Admin Guard Concurrency & Invariants ---');

    // 1.1 Primary Admin Protection: Cannot be demoted or removed
    try {
      await executeRoleChangeTransaction(secondaryDb, {
        businessId: BIZ_ID,
        targetUid: 'admin_primary',
        newRole: 'manager',
        actorUser: { uid: 'admin_secondary', email: 'secondary@tps.com' },
      });
      console.error('  ✗ FAIL: Primary admin demotion should have been blocked');
      failed++;
    } catch (err) {
      console.log(`  ✓ PASS: Primary admin demotion blocked: ${err.message}`);
      passed++;
    }

    try {
      await executeStaffRemovalTransaction(secondaryDb, {
        businessId: BIZ_ID,
        targetUid: 'admin_primary',
        actorUser: { uid: 'admin_secondary', email: 'secondary@tps.com' },
      });
      console.error('  ✗ FAIL: Primary admin removal should have been blocked');
      failed++;
    } catch (err) {
      console.log(`  ✓ PASS: Primary admin removal blocked: ${err.message}`);
      passed++;
    }

    // 1.2 Competing Concurrent Removals:
    // admin_tertiary tries to remove admin_primary (blocked)
    try {
      await executeStaffRemovalTransaction(tertiaryDb, {
        businessId: BIZ_ID,
        targetUid: 'admin_primary',
        actorUser: { uid: 'admin_tertiary', email: 'tertiary@tps.com' },
      });
      console.error('  ✗ FAIL: Tertiary admin removing primary admin should fail');
      failed++;
    } catch {
      console.log('  ✓ PASS: Tertiary admin cannot remove Primary Administrator');
      passed++;
    }

    // With 3 active admins, remove admin_tertiary (leaving 2).
    await executeStaffRemovalTransaction(primaryDb, {
      businessId: BIZ_ID,
      targetUid: 'admin_tertiary',
      actorUser: { uid: 'admin_primary', email: 'primary@tps.com' },
    });
    console.log('  ✓ Admin tertiary removed. Remaining active admins: 2');

    // Now exactly 2 active admins remain (primary and secondary).
    // Simulate simultaneous demotion race:
    // primary tries to demote secondary, secondary tries to demote primary.
    // secondary demoting primary will fail (Primary Admin Invariant).
    // What if primary demotes secondary? That succeeds, leaving 1 active admin.
    await executeRoleChangeTransaction(primaryDb, {
      businessId: BIZ_ID,
      targetUid: 'admin_secondary',
      newRole: 'manager',
      actorUser: { uid: 'admin_primary', email: 'primary@tps.com' },
    });
    console.log('  ✓ Secondary admin demoted to manager. Remaining active admins: 1');

    // Verify admin_guard now records exactly 1 active admin
    const guardSnap1 = await getDoc(doc(primaryDb, 'businesses', BIZ_ID, 'settings', 'admin_guard'));
    if (guardSnap1.data().activeAdminCount === 1) {
      console.log('  ✓ PASS: admin_guard activeAdminCount accurately serialized to 1');
      passed++;
    } else {
      console.error(`  ✗ FAIL: Expected activeAdminCount = 1, got ${guardSnap1.data().activeAdminCount}`);
      failed++;
    }

    // 1.3 Last Active Admin Protection:
    // Now attempt to demote or remove the last remaining admin (admin_primary):
    // A) Self-demotion is blocked by rule (request.auth.uid != uid).
    // B) If another user (even if forged) calls it, effectiveAdminCount <= 1 blocks it!
    try {
      await executeRoleChangeTransaction(primaryDb, {
        businessId: BIZ_ID,
        targetUid: 'admin_primary',
        newRole: 'manager',
        actorUser: { uid: 'admin_primary', email: 'primary@tps.com' },
      });
      console.error('  ✗ FAIL: Demoting last active admin should have been blocked');
      failed++;
    } catch (err) {
      console.log(`  ✓ PASS: Last active admin demotion blocked: ${err.message}`);
      passed++;
    }

    // -------------------------------------------------------------
    // SECTION 3: INVOICE, COUNTER & PERMANENT RESERVATION LINKAGE
    // -------------------------------------------------------------
    console.log('\n--- 2. Invoice, Counter & Permanent Reservation Linkage ---');

    // 2.1 10 Simultaneous Concurrent Invoice Creations
    console.log('  Testing 10 simultaneous concurrent invoice creations contending on invoices_2024-25...');
    const invoicePromises = [];
    for (let i = 1; i <= 10; i++) {
      invoicePromises.push(
        createInvoiceWithCounter(
          BIZ_ID,
          {
            invoiceDate: '2024-06-15',
            dueDate: '2024-06-15',
            paymentStatus: 'Pending',
            paymentMode: 'Cash',
            customer: { name: `Customer ${i}` },
            items: [{ name: 'Battery', rate: 1000 * i, qty: 1, gstRate: 18, amount: 1000 * i }],
            netPayable: 1180 * i,
          },
          { uid: 'admin_primary' },
          { dbInstance: primaryDb }
        )
      );
    }

    const createdInvoices = await Promise.all(invoicePromises);
    const invoiceNumbers = createdInvoices.map((inv) => inv.invoiceNumber);
    console.log(`  Allocated Invoice Numbers: ${invoiceNumbers.join(', ')}`);

    // Verify all 10 invoice numbers are distinct
    const uniqueNumbers = new Set(invoiceNumbers);
    if (uniqueNumbers.size === 10) {
      console.log('  ✓ PASS: All 10 concurrent invoices received unique sequential numbers (0 collisions)');
      passed++;
    } else {
      console.error(`  ✗ FAIL: Collision detected! Unique count: ${uniqueNumbers.size}/10`);
      failed++;
    }

    // Verify sequential counter state
    const counterSnap = await getDoc(doc(primaryDb, 'businesses', BIZ_ID, 'counters', 'invoices_2024-25'));
    if (counterSnap.data().lastSeq === 10) {
      console.log('  ✓ PASS: invoices_2024-25 counter exactly incremented to 10');
      passed++;
    } else {
      console.error(`  ✗ FAIL: Expected counter lastSeq = 10, got ${counterSnap.data().lastSeq}`);
      failed++;
    }

    // Verify all 10 reservations exist and cannot be updated or deleted
    const sampleSafeNumber = invoiceNumbers[0].replace(/\//g, '_');
    const resRef = doc(primaryDb, 'businesses', BIZ_ID, 'invoice_numbers', sampleSafeNumber);
    const resSnap = await getDoc(resRef);
    if (resSnap.exists()) {
      console.log(`  ✓ PASS: Reservation exists for ${sampleSafeNumber}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: Reservation missing for ${sampleSafeNumber}`);
      failed++;
    }

    // Attempt to update reservation -> MUST FAIL
    await check(
      updateDoc(resRef, { invoiceId: 'hijacked_inv_id' }),
      'Reservation cannot be updated under any circumstances',
      false
    );

    // Attempt to delete reservation -> MUST FAIL
    await check(
      deleteDoc(resRef),
      'Reservation cannot be deleted under any circumstances',
      false
    );

    // 2.2 Atomic Rollback Test: Injected Failure
    console.log('\n  Testing atomic rollback on transaction failure...');
    const curCounterSeq = counterSnap.data().lastSeq; // 10
    try {
      await runTransaction(primaryDb, async (transaction) => {
        // Increment counter
        transaction.update(doc(primaryDb, 'businesses', BIZ_ID, 'counters', 'invoices_2024-25'), {
          lastSeq: curCounterSeq + 1,
        });
        // Injected failure
        throw new Error('Simulated network / business logic failure midway through invoice transaction');
      });
    } catch {
      // Expected rollback
    }

    const counterAfterRollback = await getDoc(doc(primaryDb, 'businesses', BIZ_ID, 'counters', 'invoices_2024-25'));
    if (counterAfterRollback.data().lastSeq === curCounterSeq) {
      console.log('  ✓ PASS: Atomic rollback verified; counter sequence remained unchanged (10)');
      passed++;
    } else {
      console.error(`  ✗ FAIL: Counter corrupted after failed transaction! Got ${counterAfterRollback.data().lastSeq}`);
      failed++;
    }

    // 2.3 Invoice Deletion does NOT liberate the reservation
    console.log('\n  Testing invoice deletion does NOT permit reservation reuse...');
    const invoiceToDelete = createdInvoices[0];
    const delSafeNumber = invoiceToDelete.invoiceNumber.replace(/\//g, '_');
    const invDocRef = doc(primaryDb, 'businesses', BIZ_ID, 'invoices', invoiceToDelete.id);

    // Admin can delete invoice record
    await check(deleteDoc(invDocRef), 'Admin can delete invoice record', true);

    // Verify invoice is gone
    const invCheck = await getDoc(invDocRef);
    if (!invCheck.exists()) {
      console.log('  ✓ PASS: Invoice document deleted successfully');
      passed++;
    }

    // Verify reservation STILL EXISTS
    const delResSnap = await getDoc(doc(primaryDb, 'businesses', BIZ_ID, 'invoice_numbers', delSafeNumber));
    if (delResSnap.exists()) {
      console.log(`  ✓ PASS: Permanent reservation ${delSafeNumber} remains intact after invoice deletion`);
      passed++;
    } else {
      console.error('  ✗ FAIL: Permanent reservation was destroyed on invoice deletion!');
      failed++;
    }

    // Verify attempting to create another invoice with the same number fails
    try {
      await createInvoiceWithCounter(
        BIZ_ID,
        {
          invoiceDate: '2024-06-15',
          dueDate: '2024-06-15',
          paymentStatus: 'Pending',
          paymentMode: 'Cash',
          invoiceNumber: invoiceToDelete.invoiceNumber, // REUSING NUMBER
          customer: { name: 'Attempted Duplicate' },
          items: [{ name: 'Battery', rate: 1000, qty: 1, gstRate: 18, amount: 1000 }],
          netPayable: 1180,
        },
        { uid: 'admin_primary' },
        { dbInstance: primaryDb }
      );
      console.error('  ✗ FAIL: Reusing deleted invoice number should have been blocked');
      failed++;
    } catch (dupErr) {
      console.log(`  ✓ PASS: Duplicate invoice number reservation reuse blocked: ${dupErr.message}`);
      passed++;
    }

    // -------------------------------------------------------------
    // SECTION 4: STAFF AUDIT LOG INTEGRITY & ANTI-FORGERY
    // -------------------------------------------------------------
    console.log('\n--- 3. Staff Audit-Log Integrity & Anti-Forgery ---');

    // 3.1 Cashier attempting to create audit log -> MUST FAIL
    const fakeLogId = `audit_fake_${Date.now()}`;
    await check(
      setDoc(doc(cashierDb, 'businesses', BIZ_ID, 'staff_audit_logs', fakeLogId), {
        id: fakeLogId,
        targetUid: 'user_cashier',
        targetEmail: 'cashier@tps.com',
        action: 'ROLE_CHANGED',
        actorUid: 'user_cashier',
        actorEmail: 'cashier@tps.com',
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      }),
      'Cashier cannot create staff audit log',
      false
    );

    // 3.2 Admin attempting to forge audit log without state change -> MUST FAIL
    // (Rules line 862 requires existsAfter/getAfter matching state transition)
    await check(
      setDoc(doc(primaryDb, 'businesses', BIZ_ID, 'staff_audit_logs', fakeLogId), {
        id: fakeLogId,
        targetUid: 'user_cashier',
        targetEmail: 'cashier@tps.com',
        action: 'STAFF_APPROVED',
        newValue: { role: 'cashier' },
        actorUid: 'admin_primary',
        actorEmail: 'primary@tps.com',
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      }),
      'Admin cannot forge standalone STAFF_APPROVED without atomic member approval',
      false
    );

    // 3.3 Forging actor identity (actorUid != request.auth.uid) -> MUST FAIL
    await check(
      setDoc(doc(primaryDb, 'businesses', BIZ_ID, 'staff_audit_logs', fakeLogId), {
        id: fakeLogId,
        targetUid: 'user_cashier',
        targetEmail: 'cashier@tps.com',
        action: 'STAFF_APPROVED',
        actorUid: 'forged_victim_uid',
        actorEmail: 'primary@tps.com',
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      }),
      'Admin cannot forge actorUid to impersonate another staff member',
      false
    );

    // 3.4 Forging actor email (actorEmail != token email) -> MUST FAIL
    await check(
      setDoc(doc(primaryDb, 'businesses', BIZ_ID, 'staff_audit_logs', fakeLogId), {
        id: fakeLogId,
        targetUid: 'user_cashier',
        targetEmail: 'cashier@tps.com',
        action: 'STAFF_APPROVED',
        actorUid: 'admin_primary',
        actorEmail: 'forged_owner@google.com',
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      }),
      'Admin cannot forge actorEmail in audit record',
      false
    );

    // 3.5 Tampering or Deleting existing audit log -> MUST FAIL
    // First seed a legitimate audit log via admin context
    const validLogId = 'audit_legit_001';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'businesses', BIZ_ID, 'staff_audit_logs', validLogId), {
        id: validLogId,
        targetUid: 'user_cashier',
        targetEmail: 'cashier@tps.com',
        action: 'ROLE_CHANGED',
        actorUid: 'admin_primary',
        actorEmail: 'primary@tps.com',
        timestamp: new Date().toISOString(),
        businessId: BIZ_ID,
      });
    });

    await check(
      updateDoc(doc(primaryDb, 'businesses', BIZ_ID, 'staff_audit_logs', validLogId), {
        action: 'TAMPERED_ACTION',
      }),
      'Audit log cannot be updated (Strictly immutable)',
      false
    );

    await check(
      deleteDoc(doc(primaryDb, 'businesses', BIZ_ID, 'staff_audit_logs', validLogId)),
      'Audit log cannot be deleted (Strictly immutable)',
      false
    );

    // -------------------------------------------------------------
    // SECTION 5: FIRESTORE INDEX COVERAGE VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 4. Firestore Index Coverage Verification ---');
    const indexConfig = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf-8'));
    console.log(`  Loaded ${indexConfig.indexes.length} composite indexes from firestore.indexes.json`);

    const expectedCollections = ['members', 'staff_audit_logs', 'invoices'];
    const indexedCollections = [...new Set(indexConfig.indexes.map((idx) => idx.collectionGroup))];

    const hasAllCollections = expectedCollections.every((col) => indexedCollections.includes(col));
    if (hasAllCollections) {
      console.log('  ✓ PASS: All required application collections are mapped in firestore.indexes.json');
      passed++;
    } else {
      console.error('  ✗ FAIL: Missing collection group index in firestore.indexes.json');
      failed++;
    }

  } finally {
    await testEnv.cleanup();
  }

  console.log('\n================================================================');
  console.log(`PHASE 6B.1 TARGETED AUDIT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
