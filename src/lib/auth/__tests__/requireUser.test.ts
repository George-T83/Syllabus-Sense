// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyToken = vi.fn();
vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

import { requireUserOutsideDemo } from '../requireUser';

const signedOut = () => new NextRequest('http://localhost:3000/api/x', { method: 'POST' });
const signedIn = () =>
  new NextRequest('http://localhost:3000/api/x', {
    method: 'POST',
    headers: { authorization: 'Bearer good-token' },
  });

describe('requireUserOutsideDemo', () => {
  beforeEach(() => {
    mockVerifyToken.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('lets a signed-out caller through outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    expect(await requireUserOutsideDemo(signedOut())).toEqual({ user: null, denied: false });
  });

  it('refuses a signed-out caller in production when the admin project is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'my-project');
    expect(await requireUserOutsideDemo(signedOut())).toEqual({ user: null, denied: true });
  });

  it('refuses a signed-out caller in production when the admin project is NOT set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    expect(await requireUserOutsideDemo(signedOut())).toEqual({ user: null, denied: true });
  });

  it('refuses a caller with a token in production when the admin project is NOT set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    expect((await requireUserOutsideDemo(signedIn())).denied).toBe(true);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('says why in the server log when the admin project is missing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    await requireUserOutsideDemo(signedOut());
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/NEXT_PUBLIC_FIREBASE_PROJECT_ID/),
    );
  });

  it('accepts a verified caller in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'my-project');
    mockVerifyToken.mockResolvedValue({ uid: 'u1' });
    expect(await requireUserOutsideDemo(signedIn())).toEqual({
      user: { uid: 'u1' },
      denied: false,
    });
  });
});
