import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import {
  getPermissionsForRole,
  ROLES,
  ACCOUNT_STATUS,
} from '../utils/permissions';
import { DEFAULT_BUSINESS_ID, AUTH_STATUS } from './authConstants';

export { DEFAULT_BUSINESS_ID, AUTH_STATUS };

const AuthContext = createContext(null);

export function AuthProvider({ children, businessId = DEFAULT_BUSINESS_ID }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [authStatus, setAuthStatus] = useState(AUTH_STATUS.LOADING);
  const [authError, setAuthError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  /**
   * Fetches and validates staff member record from Firestore
   */
  const fetchMembership = useCallback(
    async (firebaseUser) => {
      if (!firebaseUser) {
        setMember(null);
        setAuthStatus(AUTH_STATUS.UNAUTHENTICATED);
        return null;
      }

      setAuthStatus(AUTH_STATUS.CHECKING_AUTHORIZATION);
      setAuthError(null);

      try {
        const memberRef = doc(db, 'businesses', businessId, 'members', firebaseUser.uid);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
          // No membership document exists in Firestore
          setMember(null);
          setAuthStatus(AUTH_STATUS.UNAUTHORIZED);
          return null;
        }

        const data = memberSnap.data();

        // Check active status
        if (data.status !== ACCOUNT_STATUS.ACTIVE) {
          setMember({ ...data, uid: firebaseUser.uid });
          setAuthStatus(AUTH_STATUS.DISABLED);
          return null;
        }

        // Validate supported role
        const validRoles = Object.values(ROLES);
        const role = validRoles.includes(data.role) ? data.role : ROLES.CASHIER;

        const approvedMember = {
          uid: firebaseUser.uid,
          email: data.email || firebaseUser.email,
          displayName: data.displayName || firebaseUser.displayName || 'Staff Member',
          role,
          status: ACCOUNT_STATUS.ACTIVE,
          createdAt: data.createdAt || null,
          createdBy: data.createdBy || null,
        };

        setMember(approvedMember);
        setAuthStatus(AUTH_STATUS.AUTHORIZED);
        return approvedMember;
      } catch (err) {
        console.error('Error verifying staff authorization in Firestore:', err);
        setAuthError(
          'Unable to verify staff authorization records. Please check your network connection.'
        );
        setAuthStatus(AUTH_STATUS.UNAUTHORIZED);
        return null;
      }
    },
    [businessId]
  );

  /**
   * Listen to Firebase Auth state changes and real-time staff membership updates
   */
  useEffect(() => {
    let memberUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (memberUnsubscribe) {
        memberUnsubscribe();
        memberUnsubscribe = null;
      }

      if (currentUser) {
        await fetchMembership(currentUser);

        // Real-time listener on member document for immediate revocation or role updates
        try {
          const memberRef = doc(db, 'businesses', businessId, 'members', currentUser.uid);
          memberUnsubscribe = onSnapshot(
            memberRef,
            (snapshot) => {
              if (!snapshot.exists()) {
                setMember(null);
                setAuthStatus(AUTH_STATUS.UNAUTHORIZED);
                return;
              }

              const data = snapshot.data();
              if (data.status !== ACCOUNT_STATUS.ACTIVE) {
                setMember({ ...data, uid: currentUser.uid });
                setAuthStatus(AUTH_STATUS.DISABLED);
                return;
              }

              const validRoles = Object.values(ROLES);
              const role = validRoles.includes(data.role) ? data.role : ROLES.CASHIER;

              setMember({
                uid: currentUser.uid,
                email: data.email || currentUser.email,
                displayName: data.displayName || currentUser.displayName || 'Staff Member',
                role,
                status: ACCOUNT_STATUS.ACTIVE,
                createdAt: data.createdAt || null,
                createdBy: data.createdBy || null,
                updatedAt: data.updatedAt || null,
                updatedBy: data.updatedBy || null,
              });
              setAuthStatus(AUTH_STATUS.AUTHORIZED);
            },
            (error) => {
              // Gracefully handle permission changes on account deactivation
              console.warn('[AuthContext] Member snapshot update:', error?.message);
            }
          );
        } catch (listenerErr) {
          console.error('[AuthContext] Failed to attach member listener:', listenerErr);
        }
      } else {
        setMember(null);
        setAuthStatus(AUTH_STATUS.UNAUTHENTICATED);
      }
    });

    return () => {
      if (memberUnsubscribe) {
        memberUnsubscribe();
      }
      authUnsubscribe();
    };
  }, [fetchMembership, businessId]);

  /**
   * Initiate Google Sign-In with popup
   */
  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(null);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    try {
      const result = await signInWithPopup(auth, provider);
      await fetchMembership(result.user);
      return result.user;
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing. Please try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignored duplicate popup request
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('Popup blocked by browser. Please allow popups for this site.');
      } else if (err.code === 'auth/network-request-failed') {
        setAuthError('Network error during authentication. Please check your connection.');
      } else {
        setAuthError(err.message || 'Failed to sign in with Google.');
      }
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, [fetchMembership]);

  /**
   * Sign out current user
   */
  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      setMember(null);
      setAuthStatus(AUTH_STATUS.UNAUTHENTICATED);
      setAuthError(null);
    } catch (err) {
      console.error('Sign-out error:', err);
      setAuthError('Failed to sign out. Please try again.');
    }
  }, []);

  /**
   * Manually re-check membership (e.g. after administrator grants access)
   */
  const refreshMembership = useCallback(async () => {
    if (user) {
      return await fetchMembership(user);
    }
    return null;
  }, [user, fetchMembership]);

  const permissions = useMemo(() => {
    return getPermissionsForRole(member?.role);
  }, [member?.role]);

  const contextValue = useMemo(
    () => ({
      user,
      member,
      businessId,
      authStatus,
      authError,
      isSigningIn,
      permissions,
      signInWithGoogle,
      signOutUser,
      refreshMembership,
      setAuthError,
      isAuthenticated: authStatus === AUTH_STATUS.AUTHORIZED,
    }),
    [
      user,
      member,
      businessId,
      authStatus,
      authError,
      isSigningIn,
      permissions,
      signInWithGoogle,
      signOutUser,
      refreshMembership,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export default AuthContext;
