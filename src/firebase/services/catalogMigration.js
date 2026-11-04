/**
 * TPS Battery House — Safe, Idempotent Catalog Migration
 *
 * Migrates existing catalog products from browser localStorage (`tps_product_catalog`)
 * to Cloud Firestore under `businesses/{businessId}/products/{productId}`.
 *
 * Guarantees:
 * - Never deletes or clears localStorage automatically.
 * - Idempotent: checks Firestore existing products by ID and SKU.
 * - Uploads only genuinely missing products.
 * - Sets version marker `tps_catalog_migration_v1` ONLY after verification.
 * - Safely retryable on network failure.
 */

import { doc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { sanitizeProductForFirestore } from './productService.js';
import { generateId } from '../../utils/idGenerator.js';

export const MIGRATION_STORAGE_KEY = 'tps_product_catalog';
export const MIGRATION_STATUS_KEY = 'tps_catalog_migration_v1';

/**
 * Checks if migration is needed and has not yet completed successfully
 */
export function isMigrationNeeded() {
  try {
    const isCompleted = localStorage.getItem(MIGRATION_STATUS_KEY);
    if (isCompleted) return false;

    const raw = localStorage.getItem(MIGRATION_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/**
 * Performs idempotent catalog migration
 *
 * @param {string} businessId - Business path identifier
 * @param {object} user - Authenticated user with write permissions (admin or manager)
 * @param {object} options - Optional overrides (e.g. custom local items for testing)
 * @returns {Promise<{ migrated: number, skipped: number, total: number, status: string }>}
 */
export async function migrateLocalCatalogToFirestore(
  businessId = DEFAULT_BUSINESS_ID,
  user = null,
  options = {}
) {
  let localProducts = options.localProducts || null;

  if (!localProducts) {
    try {
      const raw = localStorage.getItem(MIGRATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localProducts = parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to parse local catalog for migration:', err);
    }
  }

  if (!localProducts || localProducts.length === 0) {
    return {
      migrated: 0,
      skipped: 0,
      total: 0,
      status: 'no_local_data',
    };
  }

  // 1. Fetch current Firestore products to inspect existing IDs and SKUs
  const colRef = collection(db, 'businesses', businessId, 'products');
  const firestoreSnapshot = await getDocs(colRef);

  const existingIds = new Set();
  const existingSkus = new Set();

  firestoreSnapshot.forEach((d) => {
    existingIds.add(d.id);
    const data = d.data();
    if (data.sku) existingSkus.add(String(data.sku).trim().toUpperCase());
  });

  // 2. Identify missing products to upload
  const toUpload = [];
  let skippedCount = 0;

  for (const item of localProducts) {
    if (!item || typeof item !== 'object') {
      skippedCount++;
      continue;
    }

    const stableId = String(item.id || '').trim() || generateId('prod');
    const sku = String(item.sku || '').trim().toUpperCase();

    // Deduplication check: If product already exists in Firestore by ID or SKU, skip
    if (existingIds.has(stableId) || (sku && existingSkus.has(sku))) {
      skippedCount++;
      continue;
    }

    try {
      const sanitized = sanitizeProductForFirestore(
        { ...item, id: stableId },
        user,
        false
      );
      toUpload.push(sanitized);
      existingIds.add(sanitized.id);
      if (sanitized.sku) existingSkus.add(sanitized.sku.toUpperCase());
    } catch (valErr) {
      console.warn(`Skipping invalid local product "${item.name || item.id}":`, valErr.message);
      skippedCount++;
    }
  }

  // 3. Batch upload missing products (Firestore batches limit to 500 ops)
  if (toUpload.length > 0) {
    const BATCH_SIZE = 400;
    for (let i = 0; i < toUpload.length; i += BATCH_SIZE) {
      const chunk = toUpload.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const prod of chunk) {
        const docRef = doc(db, 'businesses', businessId, 'products', prod.id);
        batch.set(docRef, prod);
      }

      await batch.commit();
    }
  }

  // 4. Verification step: Ensure all uploaded products exist in Firestore
  const verifySnapshot = await getDocs(colRef);
  const verifiedIds = new Set();
  verifySnapshot.forEach((d) => verifiedIds.add(d.id));

  const allVerified = toUpload.every((p) => verifiedIds.has(p.id));
  if (!allVerified) {
    throw new Error('Migration verification failed: some products were not confirmed in Firestore.');
  }

  // 5. Mark migration as completed in localStorage (without deleting the local catalog)
  try {
    localStorage.setItem(
      MIGRATION_STATUS_KEY,
      JSON.stringify({
        completedAt: new Date().toISOString(),
        migratedCount: toUpload.length,
        skippedCount,
        totalLocalCount: localProducts.length,
      })
    );
  } catch (storageErr) {
    console.warn('Could not save migration status marker:', storageErr);
  }

  return {
    migrated: toUpload.length,
    skipped: skippedCount,
    total: localProducts.length,
    status: 'success',
  };
}

