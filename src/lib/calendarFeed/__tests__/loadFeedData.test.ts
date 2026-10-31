import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { loadFeedData } from '../loadFeedData';

function fakeDb(data: Record<string, Record<string, object>>): Firestore {
  return {
    collection: (path: string) => ({
      get: async () => ({
        docs: Object.entries(data[path] ?? {}).map(([id, d]) => ({ id, data: () => d })),
      }),
    }),
  } as unknown as Firestore;
}

describe('loadFeedData', () => {
  const db = fakeDb({
    'users/u1/courses': {
      live: { code: 'CS 101', title: 'Intro' },
      old: { code: 'MA 101', title: 'Calc', archivedAt: '2026-10-01T12:00:00.000Z' },
      demo: { code: 'DEMO', title: 'Sample', sample: true },
    },
    'users/u1/scheduleItems': {
      a: { courseId: 'live', title: 'Problem Set' },
      b: { courseId: 'old', title: 'Archived homework' },
      c: { courseId: 'demo', title: 'Sample task', sample: true },
    },
  });

  it('leaves an archived course and its tasks out of the subscribed calendar', async () => {
    const { courses, items } = await loadFeedData(db, 'u1');
    expect(courses.map((c) => c.id)).toEqual(['live']);
    expect(items.map((i) => i.id)).toEqual(['a']);
  });
});
