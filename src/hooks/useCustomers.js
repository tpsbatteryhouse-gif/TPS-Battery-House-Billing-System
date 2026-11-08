import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
} from '../firebase/services/customerService.js';
import {
  isCustomerMigrationNeeded,
  migrateLocalCustomersToFirestore,
  CUSTOMER_STORAGE_KEY,
  extractLocalCustomers,
} from '../firebase/services/customerMigration.js';
import { DEFAULT_BUSINESS_ID } from '../context/authConstants.js';
import { useAuth } from '../context/useAuth.js';

export function useCustomers(businessId = DEFAULT_BUSINESS_ID) {
  const { user, permissions } = useAuth();

  // 1. Synchronous initial state from localStorage cache to prevent layout shift
  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return extractLocalCustomers();
    } catch {
      return extractLocalCustomers();
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('syncing'); // 'syncing' | 'synced' | 'offline' | 'error'
  const isMigratingRef = useRef(false);

  // 2. Real-time Firestore synchronization
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeCustomers(
      businessId,
      (liveCustomers) => {
        if (!isMounted) return;

        // If Firestore has customers, adopt them and update local cache
        if (Array.isArray(liveCustomers) && liveCustomers.length > 0) {
          setCustomers(liveCustomers);
          try {
            localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(liveCustomers));
          } catch (e) {
            console.warn('Failed to update local customer cache from Firestore:', e);
          }
        }
        setLoading(false);
        setError(null);
        setSyncStatus('synced');
      },
      (err) => {
        if (!isMounted) return;
        console.warn('Firestore customers sync error, using local cache:', err);
        setError(err.message || 'Failed to sync customers with Firestore.');
        setSyncStatus(navigator.onLine === false ? 'offline' : 'error');
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [businessId]);

  // 3. Background Safe Idempotent Migration for Admin / Manager
  useEffect(() => {
    if (!permissions?.canManageCustomers || isMigratingRef.current) return;

    if (isCustomerMigrationNeeded()) {
      isMigratingRef.current = true;
      migrateLocalCustomersToFirestore(businessId, user)
        .then((res) => {
          if (res.migrated > 0) {
            console.log(`[TPS Migration] Migrated ${res.migrated} customers to Firestore.`);
          }
        })
        .catch((err) => {
          console.warn('[TPS Migration] Customer migration deferred:', err.message);
        })
        .finally(() => {
          isMigratingRef.current = false;
        });
    }
  }, [businessId, permissions?.canManageCustomers, user]);

  // 4. Save customer (Create or Update)
  const saveCustomer = useCallback(
    async (customerData) => {
      const isExisting = customers.some((c) => c.id === customerData.id);
      if (isExisting) {
        return await updateCustomer(businessId, customerData.id, customerData, user);
      } else {
        return await addCustomer(businessId, customerData, user);
      }
    },
    [businessId, customers, user]
  );

  // 5. Delete customer
  const removeCustomer = useCallback(
    async (customerId) => {
      return await deleteCustomer(businessId, customerId);
    },
    [businessId]
  );

  // 6. Manual refresh / retry
  const refreshCustomers = useCallback(() => {
    setLoading(true);
    setSyncStatus('syncing');
    setError(null);
    const unsub = subscribeCustomers(
      businessId,
      (liveCusts) => {
        setCustomers(liveCusts);
        setLoading(false);
        setSyncStatus('synced');
        unsub();
      },
      (err) => {
        setError(err.message || 'Sync error');
        setSyncStatus('error');
        setLoading(false);
        unsub();
      }
    );
  }, [businessId]);

  return {
    customers,
    setCustomers,
    loading,
    error,
    syncStatus,
    saveCustomer,
    removeCustomer,
    refreshCustomers,
  };
}

