/**
 * WARNING: This module is intended ONLY for server-side code
 * (Server Components, Route Handlers, Server Actions).
 * It will not function client-side because firebase-admin relies on Node.js APIs.
 */
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth as getAdminAuth, Auth } from 'firebase-admin/auth';
import { getFirestore as getAdminDb, Firestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, Storage } from 'firebase-admin/storage';

// Add an explicit runtime guard to ensure this file is never imported client-side
if (typeof window !== 'undefined') {
  throw new Error('Internal Error: firebase-admin must not be imported in client-side code.');
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

let adminApp: App | undefined;
let adminAuth: Auth | undefined;
let adminDb: Firestore | undefined;
let adminStorage: Storage | undefined;

// Safe runtime/build guard: only initialize if admin credentials are present.
// Prevents module-load crashes during static builds or in tests when admin env vars are missing.
if (projectId && clientEmail && privateKey) {
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  adminApp = !getApps().length
    ? initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      })
    : getApp();

  adminAuth = getAdminAuth(adminApp);
  adminDb = getAdminDb(adminApp);
  adminStorage = getAdminStorage(adminApp);
}

export { adminApp, adminAuth, adminDb, adminStorage };
