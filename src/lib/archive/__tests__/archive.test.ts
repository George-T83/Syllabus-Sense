import { describe, it, expect } from 'vitest';
import {
  archivedCourseIds,
  isArchived,
  onlyArchivedRecords,
  withoutArchived,
  withoutArchivedRecords,
} from '../archive';
import type { Course } from '@/types/schedule';

const live: Course = { id: 'live', code: 'CS 101', title: 'Intro' };
const old: Course = {
  id: 'old',
  code: 'MA 101',
  title: 'Calc',
  archivedAt: '2026-10-01T12:00:00.000Z',
};

describe('isArchived / archivedCourseIds', () => {
  it('treats a course with an archivedAt as archived', () => {
    expect(isArchived(live)).toBe(false);
    expect(isArchived(old)).toBe(true);
    expect(isArchived({ archivedAt: '' })).toBe(false);
    expect(archivedCourseIds([live, old])).toEqual(new Set(['old']));
  });
});

describe('withoutArchivedRecords / onlyArchivedRecords', () => {
  const records = [
    { id: 'a', courseId: 'live' },
    { id: 'b', courseId: 'old' },
    { id: 'c', courseId: 'gone' },
    { id: 'd' },
  ];
  it('drops the records of an archived course and keeps the rest, including orphans', () => {
    expect(withoutArchivedRecords(records, new Set(['old'])).map((r) => r.id)).toEqual([
      'a',
      'c',
      'd',
    ]);
  });
  it('returns the same array when nothing is archived', () => {
    expect(withoutArchivedRecords(records, new Set())).toBe(records);
  });
  it('picks out exactly the archived records', () => {
    expect(onlyArchivedRecords(records, new Set(['old'])).map((r) => r.id)).toEqual(['b']);
    expect(onlyArchivedRecords(records, new Set())).toEqual([]);
  });
});

describe('withoutArchived', () => {
  it('leaves the courses in use and their records', () => {
    const out = withoutArchived(
      [live, old],
      [
        { id: 'a', courseId: 'live' },
        { id: 'b', courseId: 'old' },
      ],
    );
    expect(out.courses.map((c) => c.id)).toEqual(['live']);
    expect(out.records.map((r) => r.id)).toEqual(['a']);
  });
});
