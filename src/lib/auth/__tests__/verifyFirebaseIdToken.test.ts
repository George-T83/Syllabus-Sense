import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyFirebaseIdToken } from '../verifyFirebaseIdToken';

// Only the production-guard test below needs this: it proves control flow
// reaches real JWKS signature verification (jwtVerify) instead of the
// emulator's decode-only branch, without making a real network call to
// Google's JWKS endpoint.
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(
      () => (() => {}) as unknown as ReturnType<typeof actual.createRemoteJWKSet>,
    ),
    jwtVerify: vi.fn().mockRejectedValue(new Error('mock-signature-rejected')),
  };
});

const PROJECT_ID = 'demo-syllabus-sense';

function base64url(input: object): string {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Builds a JWT-shaped string with an arbitrary payload and no real
 * signature - fine here since these tests only exercise the emulator
 * branch, which intentionally never checks the signature (the Auth
 * emulator's own tokens aren't signed with Google's real key either). */
function fakeToken(payload: object): string {
  const header = base64url({ alg: 'none', typ: 'JWT' });
  const body = base64url(payload);
  return `${header}.${body}.fake-signature`;
}

describe('verifyFirebaseIdToken (emulator branch)', () => {
  const originalEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  beforeEach(() => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  });

  afterEach(() => {
    if (originalEmulatorHost === undefined) {
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    } else {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = originalEmulatorHost;
    }
  });

  it('accepts a well-formed emulator token and extracts uid/email', async () => {
    const token = fakeToken({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      sub: 'test-uid-123',
      email: 'student@example.edu',
    });

    const result = await verifyFirebaseIdToken(token, PROJECT_ID);

    expect(result).toEqual({ uid: 'test-uid-123', email: 'student@example.edu' });
  });

  it('omits email when the token has none', async () => {
    const token = fakeToken({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      sub: 'test-uid-456',
    });

    const result = await verifyFirebaseIdToken(token, PROJECT_ID);

    expect(result).toEqual({ uid: 'test-uid-456' });
  });

  it('rejects a token for the wrong project (audience mismatch)', async () => {
    const token = fakeToken({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: 'some-other-project',
      sub: 'test-uid-789',
    });

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).rejects.toThrow();
  });

  it('rejects a token missing a subject', async () => {
    const token = fakeToken({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
    });

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).rejects.toThrow(
      'Token payload is missing a subject (uid).',
    );
  });

  it('never bypasses signature verification when NODE_ENV is production, even with the emulator host var set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const token = fakeToken({
        iss: `https://securetoken.google.com/${PROJECT_ID}`,
        aud: PROJECT_ID,
        sub: 'test-uid-123',
      });

      // Rejects with the mocked jwtVerify's error specifically - proving
      // control flow reached real signature verification instead of the
      // emulator's decode-only branch, which would have resolved this
      // well-formed payload successfully without ever calling jwtVerify.
      await expect(verifyFirebaseIdToken(token, PROJECT_ID)).rejects.toThrow(
        'mock-signature-rejected',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
