import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { adminDb } from '@/lib/firebase/adminFirestore';
import { adminStorage } from '@/lib/firebase/adminStorage';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Deleting an account must follow a recent sign-in. Firebase refuses the
 * final deleteUser call for an older session, and by then this route has
 * already wiped the data, leaving a signed-in account with nothing in it.
 * Checking here, before anything is deleted, keeps the two halves together.
 */
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

/**
 * Deletes everything under `users/{uid}` - every course (and its nested
 * syllabi/gradeScenarios), schedule items, contacts, sources, flashcards,
 * quizzes, quiz attempts, mood entries, and the daily AI-usage counters -
 * plus every uploaded file in Storage under the same prefix.
 *
 * This intentionally does NOT delete the Firebase Auth account itself: the
 * Admin SDK's Auth module can't be imported here (firebase-admin/auth pulls
 * in jwks-rsa, which crashes with ERR_REQUIRE_ESM inside Vercel's Lambda
 * runtime - see verifyFirebaseIdToken.ts for the full story). The client
 * still calls `deleteUser` from the client SDK for that half, and only
 * after this route has confirmed the data is gone - so a failure here
 * leaves the account and its data both intact for the user to retry,
 * rather than deleting the login and orphaning the data (the previous bug)
 * or the reverse.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json(
      { error: 'Account deletion is not configured on the server.' },
      { status: 503 },
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (user.authTime === undefined || nowSeconds - user.authTime > MAX_SIGN_IN_AGE_SECONDS) {
    return NextResponse.json(
      {
        error: 'For your security, please sign in again before deleting your account.',
        code: 'recent-login-required',
      },
      { status: 403 },
    );
  }

  try {
    await adminDb.recursiveDelete(adminDb.doc(`users/${user.uid}`));
  } catch (err) {
    console.error('Failed to recursively delete Firestore data for account deletion:', err);
    return NextResponse.json({ error: 'Failed to delete your data. Try again.' }, { status: 500 });
  }

  if (adminStorage) {
    try {
      await adminStorage.bucket().deleteFiles({ prefix: `users/${user.uid}/` });
    } catch (err) {
      // Uploaded files are the student's own documents, so leaving them
      // behind while telling the student the account is gone would be
      // untrue. Fail instead: nothing else is deleted yet, and running this
      // again is safe (the Firestore delete finds nothing and the file
      // delete retries).
      console.error('Failed to delete Storage files for account deletion:', err);
      return NextResponse.json(
        {
          error:
            "Your data was removed, but some uploaded files couldn't be deleted. Your account is still open; please try deleting it again.",
          code: 'storage-cleanup-failed',
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
