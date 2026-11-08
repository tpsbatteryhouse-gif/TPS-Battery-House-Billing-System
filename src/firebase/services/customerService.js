/**
 * TPS Battery House — Cloud Firestore Customer Service
 *
 * Scoped collection: businesses/{businessId}/customers/{customerId}
 * Enforces strict schema compliance with firestore.rules (isValidCustomer).
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
import { generateId } from '../../utils/idGenerator.js';

const ALLOWED_CUSTOMER_KEYS = new Set([
  'id',
  'name',
  'phone',
  'address',
  'city',
  'district',
  'state',
  'stateCode',
  'pincode',
  'gstin',
  'pan',
  'shippingAddress',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
]);

/**
 * Validates and sanitizes customer payload to conform strictly to firestore.rules
 */
export function sanitizeCustomerForFirestore(rawCustomer, user = null, isUpdate = false) {
  if (!rawCustomer || typeof rawCustomer !== 'object') {
    throw new Error('Invalid customer payload: expected an object.');
  }

  const name = String(rawCustomer.name || '').trim();
  if (!name) {
    throw new Error('Customer name is required.');
  }
  if (name.length > 150) {
    throw new Error('Customer name cannot exceed 150 characters.');
  }

  // Default stateCode to Kerala '32' if missing
  const stateCode = String(rawCustomer.stateCode || '32').trim();
  if (!stateCode || stateCode.length > 10) {
    throw new Error('Customer state code must be between 1 and 10 characters.');
  }

  const sanitized = {
    name,
    stateCode,
  };

  if (rawCustomer.id) {
    sanitized.id = String(rawCustomer.id).trim();
  }

  if (rawCustomer.phone !== undefined && rawCustomer.phone !== null) {
    sanitized.phone = String(rawCustomer.phone).trim().slice(0, 25);
  }

  if (rawCustomer.address !== undefined && rawCustomer.address !== null) {
    sanitized.address = String(rawCustomer.address).trim().slice(0, 300);
  }

  if (rawCustomer.city !== undefined && rawCustomer.city !== null) {
    sanitized.city = String(rawCustomer.city).trim().slice(0, 100);
  }

  if (rawCustomer.district !== undefined && rawCustomer.district !== null) {
    sanitized.district = String(rawCustomer.district).trim().slice(0, 100);
  }

  if (rawCustomer.state !== undefined && rawCustomer.state !== null) {
    sanitized.state = String(rawCustomer.state).trim().slice(0, 100);
  }

  if (rawCustomer.pincode !== undefined && rawCustomer.pincode !== null) {
    sanitized.pincode = String(rawCustomer.pincode).trim().slice(0, 20);
  }

  if (rawCustomer.gstin !== undefined && rawCustomer.gstin !== null) {
    sanitized.gstin = String(rawCustomer.gstin).trim().toUpperCase().slice(0, 25);
  }

  // Handle PAN (or derive from GSTIN if 15-char format)
  if (rawCustomer.pan !== undefined && rawCustomer.pan !== null && String(rawCustomer.pan).trim() !== '') {
    sanitized.pan = String(rawCustomer.pan).trim().toUpperCase().slice(0, 20);
  } else if (sanitized.gstin && sanitized.gstin.length >= 12) {
    sanitized.pan = sanitized.gstin.slice(2, 12);
  }

  if (rawCustomer.shippingAddress !== undefined && rawCustomer.shippingAddress !== null) {
    sanitized.shippingAddress = String(rawCustomer.shippingAddress).trim().slice(0, 300);
  }

  // Audit metadata
  const userUid = user?.uid || (typeof user === 'string' ? user : null);

  if (isUpdate) {
    sanitized.updatedAt = new Date().toISOString();
    if (userUid) {
      sanitized.updatedBy = userUid.slice(0, 128);
    } else if (rawCustomer.updatedBy) {
      sanitized.updatedBy = String(rawCustomer.updatedBy).slice(0, 128);
    }

    // Preserve existing creation metadata
    if (rawCustomer.createdAt) {
      sanitized.createdAt = rawCustomer.createdAt;
    }
    if (rawCustomer.createdBy) {
      sanitized.createdBy = String(rawCustomer.createdBy).slice(0, 128);
    }
  } else {
    sanitized.createdAt = rawCustomer.createdAt || new Date().toISOString();
    if (userUid) {
      sanitized.createdBy = userUid.slice(0, 128);
    } else if (rawCustomer.createdBy) {
      sanitized.createdBy = String(rawCustomer.createdBy).slice(0, 128);
    }
  }

  // Final check: filter out any key not in ALLOWED_CUSTOMER_KEYS
  const cleanDoc = {};
  for (const [key, val] of Object.entries(sanitized)) {
    if (ALLOWED_CUSTOMER_KEYS.has(key) && val !== undefined) {
      cleanDoc[key] = val;
    }
  }

  return cleanDoc;
}

/**
 * Fetch all customers from Firestore
 */
export async function getCustomers(businessId = DEFAULT_BUSINESS_ID) {
  try {
    const colRef = collection(db, 'businesses', businessId, 'customers');
    const snapshot = await getDocs(colRef);
    const customers = [];
    snapshot.forEach((docSnap) => {
      customers.push({
        ...docSnap.data(),
        id: docSnap.id,
      });
    });
    return customers;
  } catch (error) {
    console.error(`[CustomerService] Failed to get customers for ${businessId}:`, error);
    throw error;
  }
}

/**
 * Fetch a single customer by ID
 */
export async function getCustomerById(businessId = DEFAULT_BUSINESS_ID, customerId) {
  try {
    const docRef = doc(db, 'businesses', businessId, 'customers', customerId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return {
      ...snap.data(),
      id: snap.id,
    };
  } catch (error) {
    console.error(`[CustomerService] Failed to get customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Subscribe to customers collection with realtime onSnapshot
 */
export function subscribeCustomers(businessId = DEFAULT_BUSINESS_ID, onNext, onError) {
  const colRef = collection(db, 'businesses', businessId, 'customers');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const customers = [];
      snapshot.forEach((docSnap) => {
        customers.push({
          ...docSnap.data(),
          id: docSnap.id,
        });
      });
      if (typeof onNext === 'function') {
        onNext(customers);
      }
    },
    (err) => {
      console.error(`[CustomerService] Snapshot error on ${businessId}/customers:`, err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );
}

/**
 * Add a new customer to Firestore
 */
export async function addCustomer(businessId = DEFAULT_BUSINESS_ID, customerData, user = null) {
  try {
    const customerId = customerData.id || `cust_${Date.now()}_${generateId().slice(0, 6)}`;
    const sanitized = sanitizeCustomerForFirestore(
      { ...customerData, id: customerId },
      user,
      false
    );

    const docRef = doc(db, 'businesses', businessId, 'customers', customerId);
    await setDoc(docRef, sanitized);
    return sanitized;
  } catch (error) {
    console.error(`[CustomerService] Failed to add customer:`, error);
    throw error;
  }
}

/**
 * Update an existing customer in Firestore
 */
export async function updateCustomer(
  businessId = DEFAULT_BUSINESS_ID,
  customerId,
  updateData,
  user = null
) {
  try {
    if (!customerId) {
      throw new Error('customerId is required for update.');
    }

    const sanitized = sanitizeCustomerForFirestore(
      { ...updateData, id: customerId },
      user,
      true
    );

    const docRef = doc(db, 'businesses', businessId, 'customers', customerId);
    await updateDoc(docRef, sanitized);
    return sanitized;
  } catch (error) {
    console.error(`[CustomerService] Failed to update customer ${customerId}:`, error);
    throw error;
  }
}

/**
 * Delete a customer from Firestore
 */
export async function deleteCustomer(businessId = DEFAULT_BUSINESS_ID, customerId) {
  try {
    if (!customerId) {
      throw new Error('customerId is required for deletion.');
    }
    const docRef = doc(db, 'businesses', businessId, 'customers', customerId);
    await deleteDoc(docRef);
    return { success: true, id: customerId };
  } catch (error) {
    console.error(`[CustomerService] Failed to delete customer ${customerId}:`, error);
    throw error;
  }
}

