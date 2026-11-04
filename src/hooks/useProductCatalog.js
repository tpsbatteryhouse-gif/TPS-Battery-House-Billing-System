import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeProducts,
  addProduct,
  updateProduct,
  deleteProduct,
} from '../firebase/services/productService.js';
import {
  isMigrationNeeded,
  migrateLocalCatalogToFirestore,
  MIGRATION_STORAGE_KEY,
} from '../firebase/services/catalogMigration.js';
import { INITIAL_PRODUCT_CATALOG } from '../utils/categories.js';
import { DEFAULT_BUSINESS_ID } from '../context/authConstants.js';
import { useAuth } from '../context/useAuth.js';

export function useProductCatalog(businessId = DEFAULT_BUSINESS_ID) {
  const { user, permissions } = useAuth();

  // 1. Synchronous initial state from localStorage (or seed presets) to prevent layout shift
  const [catalog, setCatalog] = useState(() => {
    try {
      const saved = localStorage.getItem(MIGRATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_PRODUCT_CATALOG;
    } catch {
      return INITIAL_PRODUCT_CATALOG;
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('syncing'); // 'syncing' | 'synced' | 'offline' | 'error'
  const isMigratingRef = useRef(false);

  // 2. Real-time Firestore synchronization
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeProducts(
      businessId,
      (liveProducts) => {
        if (!isMounted) return;

        // If Firestore has products, adopt them and update local cache
        if (Array.isArray(liveProducts) && liveProducts.length > 0) {
          setCatalog(liveProducts);
          try {
            localStorage.setItem(MIGRATION_STORAGE_KEY, JSON.stringify(liveProducts));
          } catch (e) {
            console.warn('Failed to update local cache from Firestore:', e);
          }
        }
        setLoading(false);
        setError(null);
        setSyncStatus('synced');
      },
      (err) => {
        if (!isMounted) return;
        console.warn('Firestore products sync error, using local cache:', err);
        setError(err.message || 'Failed to sync with Firestore.');
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
    if (!permissions?.canManageCatalog || isMigratingRef.current) return;

    if (isMigrationNeeded()) {
      isMigratingRef.current = true;
      migrateLocalCatalogToFirestore(businessId, user)
        .then((res) => {
          if (res.migrated > 0) {
            console.log(`[TPS Migration] Migrated ${res.migrated} products to Firestore.`);
          }
        })
        .catch((err) => {
          console.warn('[TPS Migration] Migration attempt deferred:', err.message);
        })
        .finally(() => {
          isMigratingRef.current = false;
        });
    }
  }, [businessId, permissions?.canManageCatalog, user]);

  // 4. Save product (Create or Update)
  const saveProduct = useCallback(
    async (productData) => {
      const isExisting = catalog.some((p) => p.id === productData.id);
      if (isExisting) {
        return await updateProduct(businessId, productData.id, productData, user);
      } else {
        return await addProduct(businessId, productData, user);
      }
    },
    [businessId, catalog, user]
  );

  // 5. Delete product
  const removeProduct = useCallback(
    async (productId) => {
      return await deleteProduct(businessId, productId);
    },
    [businessId]
  );

  // 6. Manual refresh / retry
  const refreshCatalog = useCallback(() => {
    setLoading(true);
    setSyncStatus('syncing');
    setError(null);
    // Subscribing again triggers Firestore fetch
    const unsub = subscribeProducts(
      businessId,
      (prods) => {
        setCatalog(prods);
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
    catalog,
    setCatalog,
    loading,
    error,
    syncStatus,
    saveProduct,
    removeProduct,
    refreshCatalog,
  };
}
