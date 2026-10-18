// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeAdminDb, type Store } from './fakeAdminDb';

const state: { store: Store; available: boolean; reads: number } = {
  store: new Map(),
  available: true,
  reads: 0,
};

vi.mock('@/lib/firebase/adminFirestore', () => ({
  get adminDb() {
    return state.available
      ? createFakeAdminDb(state.store, () => {
          state.reads += 1;
        })
      : undefined;
  },
}));

import { GET } from '@/app/api/calendar/[token]/route';

const TOKEN = 'A'.repeat(32);
const UID = 'secret-uid-9f3c1e';

function call(token: string) {
  return GET(new NextRequest(`http://localhost:3000/api/calendar/${token}`), {
    params: Promise.resolve({ token }),
  });
}

describe('GET /api/calendar/[token]', () => {
  beforeEach(() => {
    state.available = true;
    state.reads = 0;
    state.store = new Map<string, Record<string, unknown>>([
      [`calendarFeeds/${TOKEN}`, { uid: UID, createdAt: '2026-01-01T00:00:00.000Z' }],
      [`users/${UID}/courses/c1`, { code: 'CSCI 213', title: 'Computer Science I' }],
      [
        `users/${UID}/scheduleItems/i1`,
        { courseId: 'c1', title: 'Problem Set 1', type: 'assignment', dueDate: '2026-10-20' },
      ],
      [
        'users/other-user/scheduleItems/i2',
        { courseId: 'x', title: 'Not Mine', type: 'exam', dueDate: '2026-10-21' },
      ],
    ]);
  });

  it('returns 404 with no body for a malformed token, without reading Firestore', async () => {
    for (const bad of ['short', 'a.b', 'x'.repeat(33), '..%2Fetc', '!'.repeat(32)]) {
      const res = await call(bad);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('');
    }
    expect(state.reads).toBe(0);
  });

  it('returns 404 with no detail for an unknown token', async () => {
    const res = await call('B'.repeat(32));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });

  it('returns 503 when the admin database is unavailable', async () => {
    state.available = false;
    const res = await call(TOKEN);
    expect(res.status).toBe(503);
  });

  it('returns a VCALENDAR with the owner events and the required headers', async () => {
    const res = await call(TOKEN);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/calendar');
    expect(res.headers.get('cache-control')).toBe('private, max-age=300');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');

    const body = await res.text();
    expect(body.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(body).toContain('END:VCALENDAR');
    expect(body).toContain('SUMMARY:CSCI 213: Problem Set 1');
    expect(body).toContain('UID:i1@syllabus-sense.app');
    expect(body).not.toContain('Not Mine');
  });

  it('never leaks the uid or the token in the output', async () => {
    const res = await call(TOKEN);
    const body = await res.text();
    expect(body).not.toContain(UID);
    expect(body).not.toContain(TOKEN);
    res.headers.forEach((value) => expect(value).not.toContain(UID));
  });

  it('returns 200 with an empty calendar when the user has no schedule items', async () => {
    state.store = new Map([[`calendarFeeds/${TOKEN}`, { uid: UID }]]);
    const res = await call(TOKEN);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).not.toContain('BEGIN:VEVENT');
  });
});
