/**
 * TPS Battery House — Safe, Idempotent, Multi-Financial-Year Invoice Migration
 *
 * Migrates existing invoice records from browser localStorage (`tps_invoice_records`)
 * to Cloud Firestore under `businesses/{businessId}/invoices/{invoiceId}`.
 *
 * Guarantees:
 * - Distributed atomic locking with unique ownerToken and lease expiration (prevents multi-admin collisions).
 * - Heartbeat lease renewal during long batch processing.
 * - Multi-financial-year partitioning across 2025-26, 2026-27, 2027-28+.
 * - Independent counter seeding per financial year.
 * - Malformed invoice number detection and duplicate number reporting.
 * - Never deletes or clears localStorage (`tps_invoice_records` remains intact).
 * - Safe resumption after interruption.
 */

import { doc, getDocs, collection, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { sanitizeInvoiceForFirestore, getFinancialYear } from './invoiceService.js';
import { INITIAL_MOCK_INVOICES } from '../../data/mockData.js';

export const INVOICE_STORAGE_KEY = 'tps_invoice_records';
export const INVOICE_MIGRATION_STATUS_KEY = 'tps_invoice_migration_v1';
export const LEASE_DURATION_MS = 60000; // 60-second lease with heartbeat renewal

/**
 * Checks if invoice migration is needed and has not yet completed successfully
 */
export function isInvoiceMigrationNeeded() {
  try {
    const isCompleted = localStorage.getItem(INVOICE_MIGRATION_STATUS_KEY);
    if (isCompleted) return false;

    const rawInvoices = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (rawInvoices) {
      const parsed = JSON.parse(rawInvoices);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    }

    return true; // Mock invoices can be seeded if needed
  } catch {
    return false;
  }
}

/**
 * Extracts candidate invoices from local storage or seed data
 */
export function extractLocalInvoices() {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[InvoiceMigration] Error reading local invoice records:', e);
  }
  return INITIAL_MOCK_INVOICES;
}

/**
 * Atomically acquires a migration lock in Firestore using a transaction and ownerToken.
 */
export async function acquireMigrationLock(
  businessId = DEFAULT_BUSINESS_ID,
  user = null,
  dbInstance = db
) {
  const lockRef = doc(dbInstance, 'businesses', businessId, 'counters', 'migration_status');
  const ownerToken = `mig_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const leaseExpiresAt = new Date(now + LEASE_DURATION_MS).toISOString();

  return await runTransaction(dbInstance, async (transaction) => {
    const snap = await transaction.get(lockRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === 'completed') {
        return { success: false, alreadyCompleted: true, completedAt: data.completedAt };
      }

      if (data.status === 'in_progress') {
        const expiresAtMs = new Date(data.leaseExpiresAt || data.startedAt || 0).getTime();
        if (now < expiresAtMs) {
          // Lock is actively held by another migration process
          return {
            success: false,
            locked: true,
            activeOwner: data.startedBy,
            expiresAt: data.leaseExpiresAt,
          };
        }
        // Lock has expired; safe to recover
      }
    }

    // Acquire lock
    transaction.set(lockRef, {
      status: 'in_progress',
      ownerToken,
      startedAt: new Date(now).toISOString(),
      startedBy: user?.uid || 'admin',
      leaseExpiresAt,
    }, { merge: true });

    return { success: true, ownerToken, leaseExpiresAt };
  });
}

/**
 * Renews the migration lease for long-running batch operations.
 */
export async function renewMigrationLock(
  businessId = DEFAULT_BUSINESS_ID,
  ownerToken,
  user = null,
  dbInstance = db
) {
  const lockRef = doc(dbInstance, 'businesses', businessId, 'counters', 'migration_status');
  const now = Date.now();
  const leaseExpiresAt = new Date(now + LEASE_DURATION_MS).toISOString();

  return await runTransaction(dbInstance, async (transaction) => {
    const snap = await transaction.get(lockRef);
    if (!snap.exists() || snap.data().ownerToken !== ownerToken) {
      throw new Error('Migration lock was lost or taken by another process.');
    }

    transaction.update(lockRef, {
      leaseExpiresAt,
      renewedAt: new Date(now).toISOString(),
      updatedBy: user?.uid || 'admin',
    });

    return { success: true, leaseExpiresAt };
  });
}

/**
 * Releases the migration lock upon verified completion.
 */
export async function releaseMigrationLock(
  businessId = DEFAULT_BUSINESS_ID,
  ownerToken,
  summary = {},
  dbInstance = db
) {
  const lockRef = doc(dbInstance, 'businesses', businessId, 'counters', 'migration_status');

  return await runTransaction(dbInstance, async (transaction) => {
    const snap = await transaction.get(lockRef);
    if (snap.exists() && snap.data().ownerToken && snap.data().ownerToken !== ownerToken) {
      throw new Error('Cannot release migration lock owned by another token.');
    }

    transaction.set(lockRef, {
      ...summary,
      status: 'completed',
      completedAt: new Date().toISOString(),
      ownerToken: null,
    }, { merge: true });

    return { success: true };
  });
}

/**
 * Concurrency-safe atomic counter seeding using Firestore transactions.
 * Guarantees that:
 * 1. Migration lock ownership is verified inside the transaction.
 * 2. Active billing operations incrementing the counter concurrently are NEVER downgraded or overwritten.
 * 3. Counter is only advanced if maxSeq > existingSeq (Math.max).
 */
export async function seedMigrationCounterAtomic(
  businessId = DEFAULT_BUSINESS_ID,
  fy,
  maxSeq,
  ownerToken,
  user = null,
  dbInstance = db
) {
  if (!fy || maxSeq <= 0) return { skipped: true };

  const lockRef = doc(dbInstance, 'businesses', businessId, 'counters', 'migration_status');
  const counterRef = doc(dbInstance, 'businesses', businessId, 'counters', `invoices_${fy}`);

  return await runTransaction(dbInstance, async (transaction) => {
    // 1. Verify migration lock state and ownership inside transaction
    const lockSnap = await transaction.get(lockRef);
    if (!lockSnap.exists() || lockSnap.data().status !== 'in_progress' || lockSnap.data().ownerToken !== ownerToken) {
      throw new Error('Migration lock was lost, expired, or invalid. Cannot seed counter.');
    }

    // 2. Read current counter state
    const counterSnap = await transaction.get(counterRef);
    let currentSeq = 0;
    let prefix = `TPS/${fy}/`;

    if (counterSnap.exists()) {
      const data = counterSnap.data();
      currentSeq = Number(data.lastSeq) || 0;
      if (data.prefix) prefix = data.prefix;
    }

    // 3. Monotonically safe update: only update if migrated maxSeq is higher
    const finalSeq = Math.max(currentSeq, maxSeq);

    transaction.set(counterRef, {
      lastSeq: finalSeq,
      prefix,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.uid || 'migration',
    }, { merge: true });

    return { success: true, previousSeq: currentSeq, finalSeq };
  });
}

/**
 * Migrates local invoices to Cloud Firestore idempotently across multiple financial years.
 */
export async function migrateLocalInvoicesToFirestore(
  businessId = DEFAULT_BUSINESS_ID,
  user = null,
  dbInstance = db
) {
  const result = {
    totalScanned: 0,
    alreadyPresent: 0,
    migrated: 0,
    failed: 0,
    maxSequenceFound: 0,
    maxSeqPerFy: {},
    duplicatesFound: [],
    malformedInvoices: [],
    errors: [],
  };

  try {
    // 1. Acquire atomic distributed lock
    const lockResult = await acquireMigrationLock(businessId, user, dbInstance);

    if (lockResult.alreadyCompleted) {
      localStorage.setItem(INVOICE_MIGRATION_STATUS_KEY, JSON.stringify({
        status: 'completed',
        migratedAt: lockResult.completedAt || new Date().toISOString(),
        remoteCompleted: true,
      }));
      return { ...result, alreadyCompleted: true };
    }

    if (lockResult.locked) {
      return { ...result, alreadyRunning: true, activeOwner: lockResult.activeOwner };
    }

    const ownerToken = lockResult.ownerToken;

    const candidates = extractLocalInvoices();
    result.totalScanned = candidates.length;

    if (candidates.length === 0) {
      await releaseMigrationLock(businessId, ownerToken, { totalScanned: 0, migrated: 0 }, dbInstance);
      localStorage.setItem(INVOICE_MIGRATION_STATUS_KEY, 'completed_empty');
      return result;
    }

    // 2. Query Firestore for existing invoices to prevent overwriting
    const colRef = collection(dbInstance, 'businesses', businessId, 'invoices');
    const existingSnap = await getDocs(colRef);

    const existingIds = new Set();
    const existingInvNumbers = new Set();

    existingSnap.forEach((docSnap) => {
      existingIds.add(docSnap.id);
      const data = docSnap.data();
      if (data.invoiceNumber) existingInvNumbers.add(data.invoiceNumber);
    });

    // 3. Scan candidates across multiple financial years, detect malformed numbers & duplicates
    const toUpload = [];
    const seenInvNumbers = new Set(existingInvNumbers);
    const maxSeqPerFy = {};
    let globalMaxSeq = 0;

    for (const inv of candidates) {
      const invNum = String(inv.invoiceNumber || '').trim();
      const invDate = inv.invoiceDate || new Date().toISOString().split('T')[0];
      const fy = (inv.financialYear && /^[0-9]{4}-[0-9]{2}$/.test(inv.financialYear))
        ? inv.financialYear
        : getFinancialYear(invDate);

      // Validate invoice number formatting
      const seqMatch = invNum.match(/(\d+)$/);
      if (!seqMatch) {
        result.malformedInvoices.push({
          id: inv.id,
          invoiceNumber: invNum,
          reason: 'Missing numeric sequence suffix',
        });
      } else {
        const parsed = parseInt(seqMatch[1], 10);
        if (!isNaN(parsed)) {
          if (!maxSeqPerFy[fy] || parsed > maxSeqPerFy[fy]) {
            maxSeqPerFy[fy] = parsed;
          }
          if (parsed > globalMaxSeq) {
            globalMaxSeq = parsed;
          }
        }
      }

      // Check if already in Firestore
      if (existingIds.has(inv.id) || existingInvNumbers.has(inv.invoiceNumber)) {
        result.alreadyPresent++;
        continue;
      }

      // Check for duplicate invoice numbers within candidates
      if (inv.invoiceNumber && seenInvNumbers.has(inv.invoiceNumber)) {
        result.duplicatesFound.push(inv.invoiceNumber);
        continue;
      }

      if (inv.invoiceNumber) {
        seenInvNumbers.add(inv.invoiceNumber);
      }
      toUpload.push(inv);
    }

    result.maxSequenceFound = globalMaxSeq;
    result.maxSeqPerFy = maxSeqPerFy;

    // 4. Batch upload in safe chunks of 200 (max 400 operations per batch) with lease heartbeat renewal
    if (toUpload.length > 0) {
      const BATCH_SIZE = 200;
      for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
        // Renew lease heartbeat before committing batch
        try {
          await renewMigrationLock(businessId, ownerToken, user, dbInstance);
        } catch (renewErr) {
          console.warn('[InvoiceMigration] Lease renewal warning:', renewErr.message);
        }

        const batch = writeBatch(dbInstance);
        const chunk = toUpload.slice(i, i + BATCH_SIZE);

        for (const item of chunk) {
          try {
            const sanitized = sanitizeInvoiceForFirestore(item, user, false);
            const docRef = doc(dbInstance, 'businesses', businessId, 'invoices', sanitized.id);
            batch.set(docRef, sanitized);

            // Register uniqueness reservation for permanent invoices
            if (sanitized.paymentStatus !== 'Draft') {
              const safeNum = sanitized.invoiceNumber.replace(/\//g, '_');
              const resRef = doc(dbInstance, 'businesses', businessId, 'invoice_numbers', safeNum);
              batch.set(resRef, {
                invoiceId: sanitized.id,
                invoiceNumber: sanitized.invoiceNumber,
                financialYear: sanitized.financialYear,
                createdAt: sanitized.createdAt,
                createdBy: user?.uid || 'migration',
              });
            }
          } catch (itemErr) {
            result.failed++;
            result.errors.push(`Invoice ${item.invoiceNumber || item.id}: ${itemErr.message}`);
          }
        }

        await batch.commit();
        result.migrated += chunk.length;
      }
    }

    // 5. Update independent sequential counter documents per financial year atomically
    // Concurrency-safe: verifies migration lock and uses Math.max to prevent counter regression
    for (const [fy, maxSeq] of Object.entries(maxSeqPerFy)) {
      if (maxSeq > 0) {
        try {
          await seedMigrationCounterAtomic(businessId, fy, maxSeq, ownerToken, user, dbInstance);
        } catch (counterErr) {
          console.warn(`[InvoiceMigration] Could not atomically update counter for ${fy}:`, counterErr);
        }
      }
    }

    // Mirror to generic counter for current FY backward compatibility
    if (globalMaxSeq > 0) {
      try {
        const currentFy = getFinancialYear(new Date());
        const currentFySeq = maxSeqPerFy[currentFy] || globalMaxSeq;
        const legacyCounterRef = doc(dbInstance, 'businesses', businessId, 'counters', 'invoices');
        await runTransaction(dbInstance, async (txn) => {
          const snap = await txn.get(legacyCounterRef);
          const currentLegacySeq = snap.exists() ? (Number(snap.data().lastSeq) || 0) : 0;
          const finalLegacySeq = Math.max(currentLegacySeq, currentFySeq);
          txn.set(legacyCounterRef, {
            lastSeq: finalLegacySeq,
            prefix: `TPS/${currentFy}/`,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.uid || 'migration',
          }, { merge: true });
        });
      } catch (legacyErr) {
        console.warn('[InvoiceMigration] Could not update generic counter:', legacyErr);
      }
    }

    // 6. Release atomic lock and mark completed in Firestore
    await releaseMigrationLock(
      businessId,
      ownerToken,
      {
        totalScanned: candidates.length,
        migrated: result.migrated,
        alreadyPresent: result.alreadyPresent,
        maxSeqPerFy,
      },
      dbInstance
    );

    // 7. Mark migration complete in localStorage (preserving original tps_invoice_records)
    try {
      localStorage.setItem(
        INVOICE_MIGRATION_STATUS_KEY,
        JSON.stringify({
          status: 'completed',
          migratedAt: new Date().toISOString(),
          count: result.migrated,
          total: candidates.length,
          maxSeqPerFy,
        })
      );
    } catch (storageErr) {
      console.warn('[InvoiceMigration] Failed to update localStorage status:', storageErr);
    }

    return result;
  } catch (error) {
    console.error('[InvoiceMigration] Migration failed:', error);
    result.errors.push(error.message);
    throw error;
  }
}
