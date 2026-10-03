/**
 * The Firebase project ID the server uses to verify sign-ins and to talk to
 * Firebase Admin. FIREBASE_ADMIN_PROJECT_ID wins when it is set (for a server
 * that must point at a different project than the browser); otherwise the
 * browser's NEXT_PUBLIC_FIREBASE_PROJECT_ID is used, which is the same value
 * in a normal deployment. Empty values count as unset.
 *
 * Each variable is read by its full name so Next.js can inline the public one
 * at build time.
 */
export function getServerProjectId(): string | undefined {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    undefined
  );
}
