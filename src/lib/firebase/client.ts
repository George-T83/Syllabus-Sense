import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// Pure helper function for getting the database ID to make it unit-testable
export function getFirestoreDatabaseId(envVal?: string): string | undefined {
  return envVal && envVal !== '(default)' ? envVal : undefined;
}

// Safe runtime/build guard: only initialize if config parameters are present.
// Prevents module-load crashes during static builds when env vars are missing.
if (firebaseConfig.apiKey) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);

  const databaseId = getFirestoreDatabaseId(process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID);
  // Auto-detect long polling: some networks (corporate proxies, sandboxed
  // containers) silently break Firestore's default streaming WebChannel
  // connection, surfacing as a hung "Could not reach Cloud Firestore
  // backend" with no application-visible error. This only changes behavior
  // when streaming actually fails, falling back to plain long-polling.
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, databaseId);

  storage = getStorage(app);

  // Client-side only emulator setup (prevents double-connecting via global/internal flag)
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' && typeof window !== 'undefined') {
    const globalEmulatorKey = '_firebase_emulators_connected_';
    const anyWindow = window as unknown as Record<string, unknown>;
    if (!anyWindow[globalEmulatorKey]) {
      anyWindow[globalEmulatorKey] = true;
      connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
    }
  }
}

export { app, auth, db, storage };
