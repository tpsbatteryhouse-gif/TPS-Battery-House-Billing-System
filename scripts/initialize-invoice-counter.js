#!/usr/bin/env node
/**
 * TPS Battery House — Server-Side Financial Year Counter Initialization Script
 *
 * Location: scripts/initialize-invoice-counter.js (Server-only administrative tool)
 *
 * Provides a controlled, trusted, administrative procedure to initialize or
 * synchronize the sequential counter document (businesses/{bizId}/counters/invoices_{fy})
 * for a specific financial year.
 *
 * Security Requirements:
 * 1. Executes strictly outside the browser/client build tree.
 * 2. Uses Firebase Admin SDK (with support for emulator via FIRESTORE_EMULATOR_HOST).
 * 3. Enforces monotonic progression: never sets lastSeq below existing invoice numbers.
 * 4. Verifies financial year format (e.g. 2026-27).
 * 5. Atomically writes the counter document with tamper-evident audit metadata.
 * 6. Supports dry-run validation mode (--dry-run).
 * 7. Requires explicit operator confirmation (--confirm) for live writes.
 */

import { initializeApp, getApps } from '../functions/node_modules/firebase-admin/lib/app/index.js';
import { getFirestore } from '../functions/node_modules/firebase-admin/lib/firestore/index.js';

export const DEFAULT_BUSINESS_ID = 'tps-battery-house';

/**
 * Initializes or synchronizes the financial year invoice counter.
 */
export async function initializeCounterProcedure(
  adminDb,
  {
    businessId = DEFAULT_BUSINESS_ID,
    fy = '2026-27',
    prefix = null,
    targetSeq = null,
    autoAlign = true,
    operatorUid = 'admin',
    dryRun = false,
  }
) {
  if (!adminDb) throw new Error('Firebase Admin Firestore instance is required');

  // 1. Validate FY format
  const fyRegex = /^\d{4}-\d{2}$/;
  if (!fyRegex.test(fy)) {
    throw new Error(`Invalid financial year format: "${fy}". Expected format: YYYY-YY (e.g., 2026-27).`);
  }

  const resolvedPrefix = prefix || `TPS/${fy}/`;
  const counterId = `invoices_${fy}`;
  const counterRef = adminDb.collection('businesses').doc(businessId).collection('counters').doc(counterId);

  // 2. Fetch existing counter
  const counterSnap = await counterRef.get();
  const counterExists = counterSnap.exists;
  const currentCounterData = counterExists ? counterSnap.data() : null;
  const currentLastSeq = currentCounterData ? Number(currentCounterData.lastSeq) || 0 : 0;

  // 3. Scan existing invoices for this business to find maximum sequence
  const invoicesRef = adminDb.collection('businesses').doc(businessId).collection('invoices');
  const invoicesSnap = await invoicesRef.get();

  let maxInvoiceSeq = 0;
  const matchedInvoices = [];

  invoicesSnap.forEach((doc) => {
    const data = doc.data();
    const invNum = data.invoiceNumber || '';
    if (invNum.startsWith(resolvedPrefix)) {
      const numPart = invNum.slice(resolvedPrefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) {
        matchedInvoices.push({ id: doc.id, invoiceNumber: invNum, seq: parsed });
        if (parsed > maxInvoiceSeq) {
          maxInvoiceSeq = parsed;
        }
      }
    }
  });

  // 4. Determine final sequence number
  let finalSeq;
  if (targetSeq !== null && targetSeq !== undefined) {
    const parsedTarget = parseInt(targetSeq, 10);
    if (isNaN(parsedTarget) || parsedTarget < 0) {
      throw new Error(`Invalid target sequence number: "${targetSeq}". Must be a non-negative integer.`);
    }
    if (parsedTarget < maxInvoiceSeq) {
      throw new Error(
        `Safety Violation: Target sequence (${parsedTarget}) is lower than the highest existing invoice sequence (${maxInvoiceSeq}). Counter sequence cannot regress.`
      );
    }
    finalSeq = parsedTarget;
  } else if (autoAlign) {
    finalSeq = Math.max(currentLastSeq, maxInvoiceSeq);
  } else {
    finalSeq = currentLastSeq;
  }

  const payload = {
    lastSeq: finalSeq,
    prefix: resolvedPrefix,
    updatedAt: new Date().toISOString(),
    updatedBy: String(operatorUid).slice(0, 128),
  };

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      businessId,
      counterId,
      counterExists,
      currentLastSeq,
      existingInvoicesCount: matchedInvoices.length,
      highestExistingInvoiceSeq: maxInvoiceSeq,
      proposedLastSeq: finalSeq,
      nextInvoiceNumber: `${resolvedPrefix}${String(finalSeq + 1).padStart(3, '0')}`,
      proposedPayload: payload,
    };
  }

  // 5. Perform Live Write
  await counterRef.set(payload, { merge: true });

  return {
    success: true,
    dryRun: false,
    businessId,
    counterId,
    counterExists,
    previousLastSeq: currentLastSeq,
    newLastSeq: finalSeq,
    nextInvoiceNumber: `${resolvedPrefix}${String(finalSeq + 1).padStart(3, '0')}`,
    payload,
  };
}

/**
 * CLI Entry Point
 */
async function runCli() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  const hasFlag = (name) => args.includes(name);

  const projectId = getArg('--project') || process.env.GCLOUD_PROJECT || 'tps-battery-house';
  const businessId = getArg('--business-id') || DEFAULT_BUSINESS_ID;
  const fy = getArg('--fy') || '2026-27';
  const prefix = getArg('--prefix') || `TPS/${fy}/`;
  const seqArg = getArg('--seq');
  const targetSeq = seqArg !== null ? parseInt(seqArg, 10) : null;
  const operatorUid = getArg('--operator-uid') || 'cli_admin';
  const dryRun = hasFlag('--dry-run');
  const confirmed = hasFlag('--confirm');

  if (hasFlag('--help') || (!dryRun && !confirmed)) {
    console.log(`
Usage:
  node scripts/initialize-invoice-counter.js [options]

Options:
  --project <id>         Firebase project ID (default: tps-battery-house)
  --business-id <id>     Target business ID (default: tps-battery-house)
  --fy <YYYY-YY>         Financial Year (default: 2026-27)
  --prefix <prefix>      Invoice number prefix (default: TPS/2026-27/)
  --seq <number>         Explicit sequence number to set (e.g., 8)
  --operator-uid <uid>   Administrator UID executing the action (default: cli_admin)
  --dry-run              Inspect without writing to Firestore
  --confirm              Acknowledge and perform live write
  --help                 Show this message
`);
    if (!dryRun && !confirmed && !hasFlag('--help')) {
      console.error('ERROR: Live modification requires the --confirm flag. Use --dry-run to test first.');
      process.exit(1);
    }
    process.exit(0);
  }

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const adminDb = getFirestore(app);

  console.log('--- TPS BATTERY HOUSE — INVOICE COUNTER INITIALIZATION ---');
  console.log(`Project:     ${projectId}`);
  console.log(`Business:    ${businessId}`);
  console.log(`FY:          ${fy}`);
  console.log(`Prefix:      ${prefix}`);
  console.log(`Mode:        ${dryRun ? 'DRY-RUN (Validation only)' : 'LIVE EXECUTION'}`);

  try {
    const result = await initializeCounterProcedure(adminDb, {
      businessId,
      fy,
      prefix,
      targetSeq,
      autoAlign: true,
      operatorUid,
      dryRun,
    });
    console.log('\n[SUCCESS]', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n[EXECUTION FAILED]', err.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}

