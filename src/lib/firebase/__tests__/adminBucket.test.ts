// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { deleteApp, getApps } from 'firebase-admin/app';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const BUCKET = 'test-project.appspot.com';

describe('admin Storage default bucket', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', 'test-project');
    vi.stubEnv('FIREBASE_ADMIN_CLIENT_EMAIL', 'svc@test-project.iam.gserviceaccount.com');
    vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', privateKey.replace(/\n/g, '\\n'));
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', BUCKET);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  // Every route that reads a file imports the Firestore admin first (for the
  // daily AI usage count), so that module creates the shared app. Storage must
  // still know its bucket then, or `bucket()` throws "Bucket name not specified".
  it('is available when Firestore admin loaded first', async () => {
    await import('../adminFirestore');
    const { adminStorage } = await import('../adminStorage');
    expect(adminStorage?.bucket().name).toBe(BUCKET);
  });

  it('is available when the combined admin module loaded first', async () => {
    await import('../admin');
    const { adminStorage } = await import('../adminStorage');
    expect(adminStorage?.bucket().name).toBe(BUCKET);
  });

  it('is available when Storage admin loaded first', async () => {
    const { adminStorage } = await import('../adminStorage');
    await import('../adminFirestore');
    expect(adminStorage?.bucket().name).toBe(BUCKET);
  });
});
