export const DEFAULT_BUSINESS_ID = 'tps-battery-house';

export const AUTH_STATUS = Object.freeze({
  LOADING: 'loading',
  UNAUTHENTICATED: 'unauthenticated',
  CHECKING_AUTHORIZATION: 'checking_authorization',
  AUTHORIZED: 'authorized',
  UNAUTHORIZED: 'unauthorized', // Signed in to Google, but no member document exists
  DISABLED: 'disabled', // Member document exists, but status !== 'active'
});

