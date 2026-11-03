import app, { auth, db, storage } from './firebase';

/**
 * Diagnostic utility to verify that Firebase SDK components have initialized
 * properly in the client environment without exposing credentials or making
 * any writes to production databases.
 */
export function verifyFirebaseInitialization() {
  try {
    const isAppInitialized = Boolean(app && app.name);
    const isAuthInitialized = Boolean(auth);
    const isFirestoreInitialized = Boolean(db);
    const isStorageInitialized = Boolean(storage);

    const isHealthy =
      isAppInitialized &&
      isAuthInitialized &&
      isFirestoreInitialized &&
      isStorageInitialized;

    return {
      success: isHealthy,
      app: isAppInitialized ? app.name : null,
      services: {
        auth: isAuthInitialized,
        firestore: isFirestoreInitialized,
        storage: isStorageInitialized,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown initialization error',
    };
  }
}

export default verifyFirebaseInitialization;

