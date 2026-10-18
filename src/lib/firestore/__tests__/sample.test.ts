import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

const mocks = vi.hoisted(() => ({
  createCourseWithScheduleItems: vi.fn(async () => undefined),
  createContacts: vi.fn(async () => undefined),
  deleteCourse: vi.fn(async () => ({ failedFiles: 0 })),
  deleteScheduleItem: vi.fn(async () => undefined),
  deleteContact: vi.fn(async () => undefined),
}));

vi.mock('@/lib/firestore/courses', () => ({
  createCourseWithScheduleItems: mocks.createCourseWithScheduleItems,
  deleteCourse: mocks.deleteCourse,
}));
vi.mock('@/lib/firestore/contacts', () => ({
  createContacts: mocks.createContacts,
  deleteContact: mocks.deleteContact,
}));
vi.mock('@/lib/firestore/scheduleItems', () => ({
  deleteScheduleItem: mocks.deleteScheduleItem,
}));

import { loadSampleSemester, removeSampleData } from '@/lib/firestore/sample';

const dispatch = vi.fn();

const course = (id: string, sample?: boolean): Course => ({
  id,
  code: id,
  title: id,
  ...(sample ? { sample: true } : {}),
});
const item = (id: string, courseId: string, sample?: boolean): ScheduleItem => ({
  id,
  courseId,
  title: id,
  type: 'assignment',
  dueDate: '2026-11-01',
  completed: false,
  ...(sample ? { sample: true } : {}),
});
const contact = (id: string, courseId: string, sample?: boolean): Contact => ({
  id,
  courseId,
  role: 'ta',
  fullName: id,
  ...(sample ? { sample: true } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadSampleSemester', () => {
  it('saves each course with its items, then the contacts, all flagged sample', async () => {
    const added = await loadSampleSemester('u1', [], dispatch, new Date(2026, 9, 17));
    expect(added).toBe(3);
    expect(mocks.createCourseWithScheduleItems).toHaveBeenCalledTimes(3);
    const calls = mocks.createCourseWithScheduleItems.mock.calls as unknown as [
      string,
      Course,
      ScheduleItem[],
    ][];
    for (const [uid, c, items] of calls) {
      expect(uid).toBe('u1');
      expect(c.sample).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((i) => i.courseId === c.id && i.sample)).toBe(true);
    }
    expect(mocks.createContacts).toHaveBeenCalledTimes(1);
  });
});

describe('removeSampleData', () => {
  it('deletes sample courses with their items and contacts, and nothing else', async () => {
    const removed = await removeSampleData(
      'u1',
      {
        courses: [course('mine'), course('s1', true), course('s2', true)],
        scheduleItems: [item('t-mine', 'mine'), item('t1', 's1', true), item('t2', 's2', true)],
        contacts: [contact('k-mine', 'mine'), contact('k1', 's1', true)],
      },
      dispatch,
    );
    expect(removed).toBe(2);
    expect(mocks.deleteCourse).toHaveBeenCalledTimes(2);
    const deleted = (mocks.deleteCourse.mock.calls as unknown as [string, Course][]).map(
      (c) => c[1].id,
    );
    expect(deleted).toEqual(['s1', 's2']);
    const first = mocks.deleteCourse.mock.calls[0] as unknown as [
      string,
      Course,
      ScheduleItem[],
      unknown,
      Contact[],
    ];
    expect(first[2].map((i) => i.id)).toEqual(['t1']);
    expect(first[4].map((c) => c.id)).toEqual(['k1']);
    expect(mocks.deleteScheduleItem).not.toHaveBeenCalled();
    expect(mocks.deleteContact).not.toHaveBeenCalled();
  });

  it('removes a flagged item or contact that sits on a course the student kept', async () => {
    await removeSampleData(
      'u1',
      {
        courses: [course('mine')],
        scheduleItems: [item('stray', 'mine', true), item('keep', 'mine')],
        contacts: [contact('stray-k', 'mine', true)],
      },
      dispatch,
    );
    expect(mocks.deleteCourse).not.toHaveBeenCalled();
    expect(mocks.deleteScheduleItem).toHaveBeenCalledTimes(1);
    expect((mocks.deleteScheduleItem.mock.calls[0] as unknown[])[1]).toMatchObject({
      id: 'stray',
    });
    expect(mocks.deleteContact).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no sample data', async () => {
    const removed = await removeSampleData(
      'u1',
      { courses: [course('mine')], scheduleItems: [item('t', 'mine')], contacts: [] },
      dispatch,
    );
    expect(removed).toBe(0);
    expect(mocks.deleteCourse).not.toHaveBeenCalled();
  });
});
