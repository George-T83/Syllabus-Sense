import { NextRequest } from 'next/server';
import {
  verifyFirebaseIdToken,
  type VerifiedFirebaseToken,
} from '@/lib/auth/verifyFirebaseIdToken';

/**
 * Verifies the caller's Firebase ID token from the Authorization header.
 * Was copy-pasted verbatim into every /api/syllabus/* route (7 copies) -
 * consolidated here so there's one place to change the auth check.
 */
export async function requireUser(req: NextRequest): Promise<VerifiedFirebaseToken | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!token || !projectId) return null;
  try {
    return await verifyFirebaseIdToken(token, projectId);
  } catch {
    return null;
  }
}

/**
 * For routes that let a signed-out caller through in local dev and demos.
 * In production a missing sign-in is always refused, including when
 * FIREBASE_ADMIN_PROJECT_ID is unset: that setting is what makes
 * requireUser able to verify anyone, so treating "unset" as "no auth
 * needed" would turn a missing environment variable into an open,
 * unmetered AI endpoint.
 */
export async function requireUserOutsideDemo(
  req: NextRequest,
): Promise<{ user: VerifiedFirebaseToken | null; denied: boolean }> {
  const user = await requireUser(req);
  if (user) return { user, denied: false };
  if (process.env.NODE_ENV !== 'production') return { user: null, denied: false };
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
    console.error(
      'FIREBASE_ADMIN_PROJECT_ID is not set in production, so every AI request is being refused. Set it to the Firebase project ID.',
    );
  }
  return { user: null, denied: true };
}
