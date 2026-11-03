import { useContext } from 'react';
import AuthContext from './AuthContext';
import { DEFAULT_BUSINESS_ID, AUTH_STATUS } from './authConstants';
import { getPermissionsForRole } from '../utils/permissions';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      member: null,
      businessId: DEFAULT_BUSINESS_ID,
      authStatus: AUTH_STATUS.UNAUTHENTICATED,
      authError: null,
      isSigningIn: false,
      permissions: getPermissionsForRole(null),
      signInWithGoogle: async () => {},
      signOutUser: async () => {},
      refreshMembership: async () => {},
      setAuthError: () => {},
      isAuthenticated: false,
    };
  }
  return context;
}

export default useAuth;

