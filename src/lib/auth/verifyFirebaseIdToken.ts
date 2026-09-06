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
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
}

function subjectFromPayload(payload: { sub?: string; email?: unknown }): VerifiedFirebaseToken {
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Token payload is missing a subject (uid).');
  }
  return {
    uid: payload.sub,
    ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
  };
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
): Promise<VerifiedFirebaseToken> {
  // The Auth emulator issues tokens that are never signed with Google's real
  // key, so signature verification against the production JWKS below would
  // reject every emulator-issued token unconditionally - this route would be
  // impossible to verify against the required local emulator setup otherwise.
  // Decode-only is safe specifically because this branch only activates when
  // FIREBASE_AUTH_EMULATOR_HOST is set AND NODE_ENV isn't 'production' - the
  // second check is deliberately redundant defense-in-depth: a single
  // misconfigured env var (the emulator host var alone) must never be able
  // to disable signature verification in a real deployment.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.NODE_ENV !== 'production') {
    const payload = decodeJwt(idToken);
    if (
      payload.iss !== `https://securetoken.google.com/${projectId}` ||
      payload.aud !== projectId
    ) {
      throw new Error('Emulator token has an unexpected issuer or audience.');
    }
    return subjectFromPayload(payload);
  }

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  return subjectFromPayload(payload);
}
