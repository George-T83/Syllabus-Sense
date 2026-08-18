/**
 * Verifies a Firebase Auth ID token without going through firebase-admin's
 * `verifyIdToken`. firebase-admin's Auth module transitively depends on
 * jwks-rsa, which does a synchronous `require('jose')` - jose has been
 * ESM-only since v5, and that require() crashes with ERR_REQUIRE_ESM inside
 * Vercel's Lambda runtime bootstrap (reproduced in production; no bundler
 * config fixes it, since the crash comes from jwks-rsa's own source, not
 * from how Next.js bundles this codebase's imports).
 *
 * This does the same verification Firebase ID tokens require - signature
 * check against Google's public JWKS, issuer/audience/expiry checks - using
 * jose directly via a real `import`, which Next.js bundles as ESM with no
 * conflict (the crash is specific to jwks-rsa's internal `require()`, not to
 * importing jose at all).
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
): Promise<VerifiedFirebaseToken> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Token payload is missing a subject (uid).');
  }

  return {
    uid: payload.sub,
    ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
  };
}
