/**
 * Server-only Firestore Admin client, deliberately separate from
 * src/lib/firebase/admin.ts. That module also imports `firebase-admin/auth`
 * at the top level, and firebase-admin's Auth module pulls in jwks-rsa,
 * which crashes with ERR_REQUIRE_ESM inside Vercel's Lambda runtime (see
 * src/lib/auth/verifyFirebaseIdToken.ts for the full story - that file
 * replaces firebase-admin's Auth entirely for the same reason). Anything
 * that only needs Firestore admin access must import from here instead of
 * admin.ts, or it drags the broken Auth import back in.
 */
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore as getAdminDb, Firestore } from 'firebase-admin/firestore';

if (typeof window !== 'undefined') {
  throw new Error('Internal Error: firebase-admin must not be imported in client-side code.');
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

let adminDb: Firestore | undefined;

if (projectId && clientEmail && privateKey) {
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
  const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;

  const app: App = !getApps().length
    ? initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: formattedPrivateKey }),
      })
    : getApp();

  adminDb =
    databaseId && databaseId !== '(default)' ? getAdminDb(app, databaseId) : getAdminDb(app);
}

export { adminDb };
