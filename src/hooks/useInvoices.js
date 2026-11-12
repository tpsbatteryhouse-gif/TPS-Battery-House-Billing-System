import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeInvoices,
  createInvoiceWithCounter,
  saveInvoiceDraft,
  updateInvoice,
  updateInvoicePaymentStatus,
  deleteInvoice,
  getInvoicePrefix,
} from '../firebase/services/invoiceService.js';
import {
  isInvoiceMigrationNeeded,
  migrateLocalInvoicesToFirestore,
  INVOICE_STORAGE_KEY,
  extractLocalInvoices,
} from '../firebase/services/invoiceMigration.js';
import { DEFAULT_BUSINESS_ID } from '../context/authConstants.js';
import { useAuth } from '../context/useAuth.js';

export function useInvoices(businessId = DEFAULT_BUSINESS_ID, businessConfig = {}) {
  const { user, member, permissions } = useAuth();

  // 1. Synchronous initial state from localStorage cache to prevent layout shift
  const [invoices, setInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem(INVOICE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return extractLocalInvoices();
    } catch {
      return extractLocalInvoices();
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('syncing'); // 'syncing' | 'synced' | 'offline' | 'error'
  const isMigratingRef = useRef(false);

  // 2. Real-time Firestore synchronization
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeInvoices(
      businessId,
      (liveInvoices) => {
        if (!isMounted) return;

        if (Array.isArray(liveInvoices) && liveInvoices.length > 0) {
          // Sort invoices newest first
          const sorted = [...liveInvoices].sort((a, b) => {
            const dateA = a.invoiceDate || a.createdAt || '';
            const dateB = b.invoiceDate || b.createdAt || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
          });

          setInvoices(sorted);
          try {
            localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(sorted));
          } catch (e) {
            console.warn('[useInvoices] Failed to update local invoice cache:', e);
          }
        }
        setLoading(false);
        setError(null);
        setSyncStatus('synced');
      },
      (err) => {
        if (!isMounted) return;
        console.warn('[useInvoices] Firestore sync error, using local cache:', err);
        setError(err.message || 'Failed to sync invoices with Firestore.');
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
    if (!permissions?.canCreateInvoice || isMigratingRef.current) return;

    if (isInvoiceMigrationNeeded()) {
      isMigratingRef.current = true;
      const authUser = user
        ? {
            ...user,
            role: member?.role,
            status: member?.status,
            permissions,
          }
        : null;
      migrateLocalInvoicesToFirestore(businessId, authUser)
        .then((res) => {
          if (res.migrated > 0) {
            console.log(`[TPS Migration] Migrated ${res.migrated} invoices to Firestore.`);
          }
        })
        .catch((err) => {
          console.warn('[TPS Migration] Invoice migration deferred:', err.message);
        })
        .finally(() => {
          isMigratingRef.current = false;
        });
    }
  }, [businessId, permissions?.canCreateInvoice, user, member, permissions]);

  // 4. Save Invoice (Atomic Create or Role-checked Update)
  const saveInvoice = useCallback(
    async (invoiceData) => {
      const authUser = user
        ? {
            ...user,
            role: member?.role,
            status: member?.status,
            permissions,
          }
        : null;

      // If saving as Draft, route to dedicated draft persistence service
      if (invoiceData.paymentStatus === 'Draft') {
        return await saveInvoiceDraft(businessId, invoiceData, authUser);
      }

      // Check if this invoice is an existing ALREADY-ISSUED invoice in dataset
      const existingInv = invoices.find(
        (i) => (i.id && i.id === invoiceData.id) || (i.invoiceNumber && i.invoiceNumber === invoiceData.invoiceNumber)
      );

      const isExistingIssued =
        (existingInv && existingInv.paymentStatus !== 'Draft' && !existingInv.invoiceNumber?.startsWith('DRAFT')) ||
        (Boolean(invoiceData.invoiceNumber) && !invoiceData.invoiceNumber.startsWith('DRAFT') && !invoiceData.invoiceNumber.includes('---'));

      if (isExistingIssued) {
        return await updateInvoice(businessId, invoiceData.id, invoiceData, authUser);
      } else {
        const prefix = businessConfig.invoicePrefix || 'TPS/2026-27/';
        return await createInvoiceWithCounter(businessId, invoiceData, authUser, { prefix });
      }
    },
    [businessId, invoices, user, member, permissions, businessConfig.invoicePrefix]
  );

  // 4b. Dedicated Save Draft Action
  const saveDraft = useCallback(
    async (draftData) => {
      const authUser = user
        ? {
            ...user,
            role: member?.role,
            status: member?.status,
            permissions,
          }
        : null;
      return await saveInvoiceDraft(businessId, draftData, authUser);
    },
    [businessId, user, member, permissions]
  );

  // 5. Update Payment Status
  const changeInvoiceStatus = useCallback(
    async (invoiceId, newStatus) => {
      const authUser = user
        ? {
            ...user,
            role: member?.role,
            status: member?.status,
            permissions,
          }
        : null;
      return await updateInvoicePaymentStatus(businessId, invoiceId, newStatus, authUser);
    },
    [businessId, user, member, permissions]
  );

  // 6. Delete Invoice (Admin only)
  const removeInvoice = useCallback(
    async (invoiceId) => {
      return await deleteInvoice(businessId, invoiceId);
    },
    [businessId]
  );

  // 7. Manual refresh / retry
  const refreshInvoices = useCallback(() => {
    setLoading(true);
    setSyncStatus('syncing');
    setError(null);
    const unsub = subscribeInvoices(
      businessId,
      (liveInvs) => {
        setInvoices(liveInvs);
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

  // 8. Compute Next Sequential Invoice Number for prospective UI display
  const peekNextInvoiceNumber = useCallback(
    (prefixOverride, invoiceDate = new Date()) => {
      const prefix = getInvoicePrefix(prefixOverride || businessConfig.invoicePrefix || 'TPS', invoiceDate);
      let maxSeq = 0;

      invoices.forEach((inv) => {
        const invNum = inv.invoiceNumber || '';
        if (invNum.startsWith(prefix)) {
          const numPart = invNum.slice(prefix.length);
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed) && parsed > maxSeq) {
            maxSeq = parsed;
          }
        }
      });

      const nextSeq = maxSeq + 1;
      return `${prefix}${String(nextSeq).padStart(3, '0')}`;
    },
    [invoices, businessConfig.invoicePrefix]
  );

  return {
    invoices,
    setInvoices,
    loading,
    error,
    syncStatus,
    saveInvoice,
    saveDraft,
    changeInvoiceStatus,
    removeInvoice,
    refreshInvoices,
    peekNextInvoiceNumber,
  };
}

