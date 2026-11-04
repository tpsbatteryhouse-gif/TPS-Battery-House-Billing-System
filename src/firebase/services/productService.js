/**
 * TPS Battery House — Cloud Firestore Product Service
 *
 * Scoped collection: businesses/{businessId}/products/{productId}
 * Enforces schema compliance with firestore.rules (isValidProduct).
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_BUSINESS_ID } from '../../context/authConstants.js';
import { PRODUCT_CATEGORIES } from '../../utils/categories.js';

const VALID_CATEGORIES = Object.values(PRODUCT_CATEGORIES);

/**
 * Validates and sanitizes product payload to conform strictly to firestore.rules
 */
export function sanitizeProductForFirestore(rawProduct, user = null, isUpdate = false) {
  if (!rawProduct || typeof rawProduct !== 'object') {
    throw new Error('Invalid product payload: expected an object.');
  }

  const id = String(rawProduct.id || '').trim();
  if (!id || id.length > 64) {
    throw new Error('Product ID is required and must be 1-64 characters.');
  }

  const sku = String(rawProduct.sku || '').trim();
  if (!sku || sku.length > 64) {
    throw new Error('Product SKU is required and must be 1-64 characters.');
  }

  const name = String(rawProduct.name || '').trim();
  if (!name || name.length > 150) {
    throw new Error('Product name is required and must be 1-150 characters.');
  }

  const category = String(rawProduct.category || '').trim().toLowerCase();
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  const unit = String(rawProduct.unit || 'Nos').trim();
  if (!unit || unit.length > 30) {
    throw new Error('Unit is required and must be 1-30 characters.');
  }

  const hsn = String(rawProduct.hsn || '').trim();
  if (!hsn || hsn.length > 20) {
    throw new Error('HSN code is required and must be 1-20 characters.');
  }

  const sellingPrice = Math.max(0, Number(rawProduct.sellingPrice || rawProduct.price) || 0);
  const gstRate = Math.min(100, Math.max(0, Number(rawProduct.gstRate) || 0));
  const isTaxInclusive = rawProduct.isTaxInclusive !== undefined ? Boolean(rawProduct.isTaxInclusive) : true;
  const costPrice = rawProduct.costPrice !== undefined ? Math.max(0, Number(rawProduct.costPrice) || 0) : 0;

  // Status & Active fields
  const status = rawProduct.status === 'inactive' ? 'inactive' : 'active';
  const active = rawProduct.active !== undefined ? Boolean(rawProduct.active) : status === 'active';

  // Specs map
  const specs = (rawProduct.specs && typeof rawProduct.specs === 'object' && !Array.isArray(rawProduct.specs))
    ? { ...rawProduct.specs }
    : {};

  const sanitized = {
    id,
    sku,
    name,
    category,
    unit,
    hsn,
    sellingPrice,
    costPrice,
    gstRate,
    isTaxInclusive,
    status,
    active,
    specs,
  };

  // Optional string fields with length constraints
  if (rawProduct.subcategory !== undefined && rawProduct.subcategory !== null) {
    sanitized.subcategory = String(rawProduct.subcategory).slice(0, 100);
  }
  if (rawProduct.brand !== undefined && rawProduct.brand !== null) {
    sanitized.brand = String(rawProduct.brand).slice(0, 100);
  }
  if (rawProduct.model !== undefined && rawProduct.model !== null) {
    sanitized.model = String(rawProduct.model).slice(0, 100);
  }
  if (rawProduct.description !== undefined && rawProduct.description !== null) {
    sanitized.description = String(rawProduct.description).slice(0, 1000);
  }
  if (rawProduct.warranty !== undefined && rawProduct.warranty !== null) {
    sanitized.warranty = String(rawProduct.warranty).slice(0, 100);
  }

  // Metadata timestamps and attribution
  const now = new Date().toISOString();
  if (isUpdate) {
    sanitized.updatedAt = now;
    if (user?.uid) {
      sanitized.updatedBy = String(user.uid).slice(0, 128);
    }
  } else {
    sanitized.createdAt = rawProduct.createdAt || now;
    if (user?.uid) {
      sanitized.createdBy = String(user.uid).slice(0, 128);
    }
  }

  return sanitized;
}

/**
 * Fetch all products from Firestore once
 */
export async function getProducts(businessId = DEFAULT_BUSINESS_ID) {
  const colRef = collection(db, 'businesses', businessId, 'products');
  const snapshot = await getDocs(colRef);
  const products = [];
  snapshot.forEach((d) => {
    products.push(d.data());
  });
  return products;
}

/**
 * Subscribe to live product updates in Firestore
 */
export function subscribeProducts(businessId = DEFAULT_BUSINESS_ID, onNext, onError) {
  const colRef = collection(db, 'businesses', businessId, 'products');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const products = [];
      snapshot.forEach((d) => {
        products.push(d.data());
      });
      // Sort products deterministically by name
      products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      onNext(products);
    },
    (err) => {
      console.error('Firestore products subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Get single product by ID
 */
export async function getProductById(businessId = DEFAULT_BUSINESS_ID, productId) {
  if (!productId) return null;
  const docRef = doc(db, 'businesses', businessId, 'products', productId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

/**
 * Add a new product to Firestore
 */
export async function addProduct(businessId = DEFAULT_BUSINESS_ID, productData, user = null) {
  const sanitized = sanitizeProductForFirestore(productData, user, false);
  const docRef = doc(db, 'businesses', businessId, 'products', sanitized.id);
  await setDoc(docRef, sanitized);
  return sanitized;
}

/**
 * Update an existing product in Firestore
 * Enforces immutability of id, sku, createdAt, createdBy.
 */
export async function updateProduct(businessId = DEFAULT_BUSINESS_ID, productId, updates, user = null) {
  if (!productId) throw new Error('Product ID is required for update.');
  const existing = await getProductById(businessId, productId);
  if (!existing) {
    throw new Error(`Product "${productId}" not found.`);
  }

  // Merge updates while strictly preserving immutable fields
  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    sku: existing.sku,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
  };

  const sanitized = sanitizeProductForFirestore(merged, user, true);
  const docRef = doc(db, 'businesses', businessId, 'products', productId);
  await updateDoc(docRef, sanitized);
  return sanitized;
}

/**
 * Delete a product from Firestore
 */
export async function deleteProduct(businessId = DEFAULT_BUSINESS_ID, productId) {
  if (!productId) throw new Error('Product ID is required for deletion.');
  const docRef = doc(db, 'businesses', businessId, 'products', productId);
  await deleteDoc(docRef);
  return { success: true, id: productId };
}

