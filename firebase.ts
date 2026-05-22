import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';                
import { getAnalytics, isSupported } from 'firebase/analytics';
const autoConfig: any = {};
try {
  // Use Vite's glob import to optionally load the config file at runtime/build-time without breaking if it's missing
  const configs = import.meta.glob('../../firebase-applet-config.json', { eager: true });
  if (configs['../../firebase-applet-config.json']) {
    Object.assign(autoConfig, (configs['../../firebase-applet-config.json'] as any).default || configs['../../firebase-applet-config.json']);
  }
} catch (e) {
  // Ignore
}
export const config = {
  apiKey: autoConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: autoConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: autoConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: autoConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: autoConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: autoConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || "",
  firestoreDatabaseId: (autoConfig as any).firestoreDatabaseId || '(default)'
};

export const isFirebaseConfigured = !!(
  config.apiKey && 
  config.apiKey.startsWith('AIza') && 
  config.apiKey.length > 30 &&
  config.apiKey !== 'AIzaSyDummyKeyForInitializationOnly-NoActualBackend' &&
  config.projectId && 
  config.projectId !== 'not-configured' &&
  config.projectId !== 'not-configured-placeholder'
);

// Diagnostic state
export const getFirebaseDiagnostics = async () => {
    if (!isFirebaseConfigured) return { status: 'unconfigured', message: 'Firebase is not set up.' };
    
    try {
      const testDoc = doc(db, '_connection_test_', 'ping');
      await getDocFromServer(testDoc);
      return { status: 'ok', message: 'Connected to Firestore.' };
    } catch (error: any) {
      if (error?.message?.includes('Quota exceeded')) {
        return { 
          status: 'quota-exceeded', 
          message: 'FIREBASE QUOTA EXCEEDED: The free tier limits for this project have been reached. It will reset in 24 hours.' 
        };
      }
      if (error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
        return { 
          status: 'offline', 
          code: error?.code,
          message: 'Firestore client is OFFLINE. Database might not be enabled in console, or the project ID is incorrect. Check your internet connection or force long polling.' 
        };
      }
      if (error?.code === 'permission-denied') {
        return { status: 'ok', message: 'Connected (Permission Denied but reachable).' };
      }
      if (error?.message?.includes('API key not valid')) {
         return { status: 'invalid-key', message: 'The API Key provided is INVALID. Check restrictions in Google Cloud Console.' };
      }
      return { status: 'error', message: error?.message || 'Unknown connection error.' };
    }
};

console.log("[Firebase] Configuration Status:", {
    configured: isFirebaseConfigured,
    projectId: config.projectId,
    hasApiKey: !!config.apiKey,
    dbId: config.firestoreDatabaseId,
    env: import.meta.env.MODE
});

/**
 * Checks if the authentication service is actually operational.
 * Prevents throwing "API-KEY-NOT-VALID" errors when the backend is dummy.
 */
export const isAuthOperational = () => {
    return isFirebaseConfigured && !config.apiKey.includes('Dummy');
};

if (!isFirebaseConfigured) {
  console.info("Firebase: Authentication and database features are currently inactive. Use 'set_up_firebase' to enable them.");
}

const app = getApps().length === 0 
  ? initializeApp(isFirebaseConfigured ? config : { 
      apiKey: "AIzaSyDummyKeyForInitializationOnly-NoActualBackend", 
      projectId: "not-configured-placeholder",
      appId: "1:1234567890:web:abcdef1234567890"
    })
  : getApps()[0];

const dbId = config.firestoreDatabaseId;
console.log(`[Firebase] Initializing Firestore with Database ID: ${dbId || '(default)'}`);

// Force long polling for all instances to increase stability in sandboxed environments
export const db = isFirebaseConfigured 
  ? initializeFirestore(app, { 
      experimentalForceLongPolling: true
    }, dbId === '(default)' ? undefined : dbId)
  : getFirestore(app);

// Offline persistence disabled due to multi-tab iframe constraint errors

export const auth = getAuth(app);

// Enable Auth persistence
if (isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("[Firebase] Auth persistence error:", err);
  });
}


// Initialize Analytics (optional, guarded for environment compatibility)
// Note: "Failed to fetch" errors often happen if ad-blockers or restricted networks block analytics endpoints.
export let analytics: any = null;
export const analyticsPromise = (async () => {
  try {
    const supported = await isSupported();
    if (supported && isFirebaseConfigured) {
      analytics = getAnalytics(app);
      return analytics;
    }
  } catch (err) {
    // Silent fail for analytics - not critical for app function
    console.debug("[Firebase] Analytics initialization skipped or blocked:", err);
  }
  return null;
})();

// Use a secondary auth instance for admin user creation without logging out current user
export const secondaryApp = isFirebaseConfigured ? (getApps().find(a => a.name === 'Secondary') || initializeApp(config, 'Secondary')) : app;
export const secondaryAuth = getAuth(secondaryApp);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

if (isFirebaseConfigured) {
  const runDiagnostics = async () => {
    const diag = await getFirebaseDiagnostics();
    if (diag.status !== 'ok') {
      console.error("[Firebase] Diagnostics result:", diag);
    } else {
      console.log("[Firebase] Diagnostics result: OK");
    }
  };
  runDiagnostics();
}
