// @vitest-environment node
//
// The route imports adminFirestore.ts/adminStorage.ts, which throw if
// `window` is defined (firebase-admin must never load in client code), so
// this needs the real Node environment instead of the project's default
// jsdom.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyToken = vi.fn();
const mockRecursiveDelete = vi.fn();
const mockDoc = vi.fn((path: string) => ({ path }));
const mockDeleteFiles = vi.fn();
const mockBucket = vi.fn(() => ({ deleteFiles: mockDeleteFiles }));

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

vi.mock('@/lib/firebase/adminFirestore', () => ({
  get adminDb() {
    return {
      doc: mockDoc,
      recursiveDelete: (...args: unknown[]) => mockRecursiveDelete(...args),
    };
  },
}));

vi.mock('@/lib/firebase/adminStorage', () => ({
  get adminStorage() {
    return { bucket: mockBucket };
  },
}));

import { POST } from '@/app/api/account/delete/route';

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/account/delete', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token' },
  });
}

describe('/api/account/delete route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project';
    mockVerifyToken.mockResolvedValue({ uid: 'user-123' });
    mockRecursiveDelete.mockResolvedValue(undefined);
    mockDeleteFiles.mockResolvedValue(undefined);
  });

  it('rejects requests without a valid token with 401', async () => {
    mockVerifyToken.mockRejectedValue(new Error('bad token'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('recursively deletes the user document and all Storage files under their prefix', async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });

    expect(mockDoc).toHaveBeenCalledWith('users/user-123');
    expect(mockRecursiveDelete).toHaveBeenCalledWith({ path: 'users/user-123' });
    expect(mockBucket).toHaveBeenCalled();
    expect(mockDeleteFiles).toHaveBeenCalledWith({ prefix: 'users/user-123/' });
  });

  it('returns 500 and never touches Storage when the Firestore delete fails', async () => {
    mockRecursiveDelete.mockRejectedValue(new Error('firestore is down'));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(mockDeleteFiles).not.toHaveBeenCalled();
  });

  it('still reports success if Storage cleanup fails after Firestore data is already gone', async () => {
    mockDeleteFiles.mockRejectedValue(new Error('storage is down'));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
  });
});
