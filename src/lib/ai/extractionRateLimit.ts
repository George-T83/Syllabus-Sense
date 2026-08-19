import { adminDb } from '@/lib/firebase/adminFirestore';

/** Generous but real ceiling - a student re-uploading a syllabus a few times
 * while fixing a bad scan is normal; a scripted loop burning Anthropic spend
 * is not. Tracked server-side so it can't be bypassed by the client. */
const DAILY_LIMIT = 15;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Atomically checks and increments a per-user daily extraction counter,
 * stored outside any collection the client has rules access to (the
 * Firestore rules' catch-all `allow read, write: if false` denies clients
 * by default, so this is admin-only by construction, not just convention).
 */
export async function checkAndIncrementExtractionCount(userId: string): Promise<RateLimitResult> {
  if (!adminDb) {
    // Fails open only if the admin SDK isn't configured at all (e.g. local
    // dev without admin env vars) - the route itself still requires a valid
    // user token, so this isn't an open door, just an unmetered one.
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  const today = new Date().toISOString().slice(0, 10);
  const ref = adminDb.collection('rateLimits').doc(userId);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { date?: string; count?: number } | undefined;

    const count = data?.date === today ? (data.count ?? 0) : 0;
    if (count >= DAILY_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    tx.set(ref, { date: today, count: count + 1 }, { merge: true });
    return { allowed: true, remaining: DAILY_LIMIT - (count + 1) };
  });
}
