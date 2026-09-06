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
