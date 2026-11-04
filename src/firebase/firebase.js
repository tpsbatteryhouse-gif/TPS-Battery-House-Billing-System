import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : (typeof process !== 'undefined' && process.env ? process.env : {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "test-api-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "test-project.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "tps-battery-house",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "test-project.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef",
};

// Validate required configuration in browser / production build without exposing values.
const isBrowser = typeof window !== 'undefined';
if (isBrowser) {
  const requiredConfig = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
  ];

  const missingConfig = requiredConfig.filter(
    (key) => !env[key]
  );

  if (missingConfig.length > 0) {
    throw new Error(
      `Missing Firebase environment variables: ${missingConfig.join(", ")}`
    );
  }
}

// Prevent duplicate initialization during development.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

