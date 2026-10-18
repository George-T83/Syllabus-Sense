// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeAdminDb, type Store } from './fakeAdminDb';

const mockVerifyToken = vi.fn();
const state: { store: Store; available: boolean } = { store: new Map(), available: true };

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

vi.mock('@/lib/firebase/adminFirestore', () => ({
  get adminDb() {
    return state.available ? createFakeAdminDb(state.store) : undefined;
  },
}));

import { GET, POST, DELETE } from '@/app/api/calendar/feed/route';
import { GET as GET_FEED } from '@/app/api/calendar/[token]/route';

const req = (method: string, auth = true) =>
  new NextRequest('http://localhost:3000/api/calendar/feed', {
    method,
    headers: auth ? { Authorization: 'Bearer valid' } : {},
  });

const tokensFor = (uid: string) =>
  [...state.store.entries()]
    .filter(([p, d]) => p.startsWith('calendarFeeds/') && d.uid === uid)
    .map(([p]) => p.split('/')[1]);

const handlers = [
  ['POST', POST],
  ['GET', GET],
  ['DELETE', DELETE],
] as const;

describe('/api/calendar/feed (create, rotate, revoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project';
    mockVerifyToken.mockResolvedValue({ uid: 'user-1' });
    state.available = true;
    state.store = new Map();
  });

  it.each(handlers)('%s rejects unauthenticated callers with 401', async (method, handler) => {
    const res = await handler(req(method, false));
    expect(res.status).toBe(401);
  });

  it.each(handlers)(
    '%s returns 503 when the admin database is unavailable',
    async (method, handler) => {
      state.available = false;
      const res = await handler(req(method));
      expect(res.status).toBe(503);
    },
  );

  it('POST creates an unguessable token mapped to the caller', async () => {
    const res = await POST(req('POST'));
    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(state.store.get(`calendarFeeds/${token}`)).toMatchObject({ uid: 'user-1' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('POST rotates: the old mapping is deleted and the old link stops working', async () => {
    const first = (await (await POST(req('POST'))).json()).token;
    const second = (await (await POST(req('POST'))).json()).token;

    expect(second).not.toBe(first);
    expect(tokensFor('user-1')).toEqual([second]);

    const oldFeed = await GET_FEED(new NextRequest(`http://localhost/api/calendar/${first}`), {
      params: Promise.resolve({ token: first }),
    });
    expect(oldFeed.status).toBe(404);
  });

  it("POST never touches another user's feed", async () => {
    state.store.set(`calendarFeeds/${'C'.repeat(32)}`, { uid: 'someone-else' });
    await POST(req('POST'));
    expect(tokensFor('someone-else')).toEqual(['C'.repeat(32)]);
  });

  it('GET returns the current token, or null when none exists', async () => {
    expect((await (await GET(req('GET'))).json()).token).toBeNull();
    const { token } = await (await POST(req('POST'))).json();
    expect((await (await GET(req('GET'))).json()).token).toBe(token);
  });

  it('DELETE revokes the caller feed and is safe to repeat', async () => {
    state.store.set(`calendarFeeds/${'C'.repeat(32)}`, { uid: 'someone-else' });
    await POST(req('POST'));
    expect(tokensFor('user-1')).toHaveLength(1);

    expect((await DELETE(req('DELETE'))).status).toBe(200);
    expect(tokensFor('user-1')).toHaveLength(0);
    expect(tokensFor('someone-else')).toHaveLength(1);

    expect((await DELETE(req('DELETE'))).status).toBe(200);
  });
});
