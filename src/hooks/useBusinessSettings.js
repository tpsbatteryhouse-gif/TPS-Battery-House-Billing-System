/**
 * TPS Battery House — useBusinessSettings Custom Hook
 *
 * Provides real-time synchronized business profile, bank details, UPI QR config,
 * and invoice defaults from Cloud Firestore (`businesses/{businessId}/settings/business_profile`).
 *
 * Features:
 * - Instant synchronous local cache load (zero layout shift).
 * - Real-time Firestore synchronization with `onSnapshot`.
 * - Offline detection and transparent cache fallback.
 * - Concurrency-safe admin update with saving status.
 * - Idempotent background migration from legacy localStorage `tps_business_profile`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getBusinessSettings,
  subscribeToBusinessSettings,
  subscribeToFinancialDetails,
  updateBusinessSettings,
  isBusinessSettingsMigrationNeeded,
  migrateBusinessSettings,
  extractLocalBusinessProfile,
  normalizeBusinessSettings,
  BUSINESS_PROFILE_STORAGE_KEY,
  DEFAULT_BUSINESS_SETTINGS,
} from '../firebase/services/businessSettingsService.js';
import { DEFAULT_BUSINESS_ID } from '../context/authConstants.js';
import { useAuth } from '../context/useAuth.js';

export function useBusinessSettings(businessId = DEFAULT_BUSINESS_ID) {
  const { user, permissions } = useAuth();

  // 1. Synchronous initial state from localStorage cache
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return normalizeBusinessSettings(parsed);
        }
      }
      return normalizeBusinessSettings(extractLocalBusinessProfile());
    } catch {
      return normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS);
    }
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState('syncing'); // 'syncing' | 'synced' | 'offline' | 'error'
  const isMigratingRef = useRef(false);

  // 2. Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (syncStatus === 'offline') setSyncStatus('syncing');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncStatus]);

  // 3. Real-time Firestore synchronization
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToBusinessSettings(
      businessId,
      (liveSettings) => {
        if (!isMounted) return;

        if (liveSettings) {
          setSettings(liveSettings);
          try {
            localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(liveSettings));
          } catch (e) {
            console.warn('[useBusinessSettings] Failed to update local cache:', e);
          }
        }
        setLoading(false);
        setError(null);
        setSyncStatus('synced');
      },
      (err) => {
        if (!isMounted) return;
        console.warn('[useBusinessSettings] Firestore sync error, using local cache:', err);
        setError(err.message || 'Failed to sync business settings.');
        setSyncStatus(navigator.onLine === false ? 'offline' : 'error');
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [businessId]);

  // 3b. Real-time synchronization of restricted financial details (Admin only)
  // Cashiers and Managers are strictly excluded to prevent 403 permission-denied errors
  useEffect(() => {
    if (!permissions?.canManageSettings) return;

    let isMounted = true;
    const unsubscribeFin = subscribeToFinancialDetails(
      businessId,
      (liveFinancial) => {
        if (!isMounted || !liveFinancial) return;
        setSettings((prev) => ({
          ...prev,
          bank: {
            ...prev.bank,
            ...liveFinancial,
          },
          bankName: liveFinancial.bankName || prev.bankName,
          accountNo: liveFinancial.accountNumber || liveFinancial.accountNo || prev.accountNo,
          accountName: liveFinancial.accountHolder || liveFinancial.accountName || prev.accountName,
          branch: liveFinancial.branch || prev.branch,
          ifsc: liveFinancial.ifsc || prev.ifsc,
        }));
      },
      (err) => {
        console.warn('[useBusinessSettings] Restricted financial sync notice:', err.message);
      }
    );

    return () => {
      isMounted = false;
      unsubscribeFin();
    };
  }, [businessId, permissions?.canManageSettings]);

  // 4. Background Safe Idempotent Migration for Admin
  useEffect(() => {
    if (!permissions?.canManageSettings || isMigratingRef.current) return;

    if (isBusinessSettingsMigrationNeeded()) {
      isMigratingRef.current = true;
      migrateBusinessSettings(businessId, user)
        .then((res) => {
          if (res.migrated) {
            console.log('[TPS Migration] Migrated business settings to Firestore.');
          }
        })
        .catch((err) => {
          console.warn('[TPS Migration] Business settings migration deferred:', err.message);
        })
        .finally(() => {
          isMigratingRef.current = false;
        });
    }
  }, [businessId, permissions?.canManageSettings, user]);

  // 5. Update settings (Admin only)
  const updateSettings = useCallback(
    async (newSettingsData) => {
      setIsSaving(true);
      setError(null);
      try {
        const updated = await updateBusinessSettings(businessId, newSettingsData, user);
        setSettings(updated);
        try {
          localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn('[useBusinessSettings] Failed to write cache on save:', e);
        }
        setIsSaving(false);
        return updated;
      } catch (err) {
        setIsSaving(false);
        setError(err.message || 'Failed to update business settings.');
        throw err;
      }
    },
    [businessId, user]
  );

  // 6. Manual refresh
  const refreshSettings = useCallback(async () => {
    setLoading(true);
    setSyncStatus('syncing');
    setError(null);
    try {
      const fresh = await getBusinessSettings(businessId);
      if (fresh) {
        setSettings(fresh);
        try {
          localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(fresh));
        } catch (e) {
          console.warn('[useBusinessSettings] Failed to write cache on refresh:', e);
        }
      }
      setLoading(false);
      setSyncStatus('synced');
      return fresh;
    } catch (err) {
      setError(err.message || 'Failed to refresh business settings.');
      setSyncStatus('error');
      setLoading(false);
      throw err;
    }
  }, [businessId]);

  return {
    settings,
    loading,
    error,
    isOnline,
    isSaving,
    syncStatus,
    updateSettings,
    refreshSettings,
  };
}
