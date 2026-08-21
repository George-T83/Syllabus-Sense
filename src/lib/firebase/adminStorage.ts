/**
 * Server-only Storage Admin client, deliberately separate from a combined
 * admin.ts for the same reason as adminFirestore.ts: firebase-admin/auth
 * pulls in jwks-rsa, which crashes with ERR_REQUIRE_ESM inside Vercel's
 * Lambda runtime (see src/lib/auth/verifyFirebaseIdToken.ts). Storage's own
 * admin module doesn't touch that dependency chain, but importing it
 * through a shared admin.ts that also re-exports Auth would drag it back
 * in - so this stays its own module, importing only firebase-admin/app and
 * firebase-admin/storage.
 */
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getStorage as getAdminStorage, Storage } from 'firebase-admin/storage';

if (typeof window !== 'undefined') {
  throw new Error('Internal Error: firebase-admin must not be imported in client-side code.');
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

let adminStorage: Storage | undefined;

if (projectId && clientEmail && privateKey && storageBucket) {
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const app: App = !getApps().length
    ? initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: formattedPrivateKey }),
        storageBucket,
      })
    : getApp();

  adminStorage = getAdminStorage(app);
}

export { adminStorage };
