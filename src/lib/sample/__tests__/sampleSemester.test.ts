import { describe, expect, it } from 'vitest';
import { daysUntilDue, isOverdue } from '@/lib/calendar/dates';
import { appStateReducer, initialAppState, type AppState } from '@/context/AppStateContext';
import { pickNowHero } from '@/lib/dashboard/nowHero';
import {
  buildSampleSemester,
  collectSampleRecords,
  hasSampleData,
  termLabelFor,
  withoutSample,
} from '@/lib/sample/sampleSemester';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

const TODAY = new Date(2026, 9, 17, 14, 30);

describe('buildSampleSemester', () => {
  const sample = buildSampleSemester(TODAY);

  it('returns three distinct, plausible courses', () => {
    expect(sample.courses).toHaveLength(3);
    expect(new Set(sample.courses.map((c) => c.color)).size).toBe(3);
    expect(new Set(sample.courses.map((c) => c.code)).size).toBe(3);
    for (const c of sample.courses) {
      expect(c.instructor).toBeTruthy();
      expect(c.credits).toBeGreaterThan(0);
      expect(c.meetingTimes?.length).toBeGreaterThan(0);
    }
  });

  it('returns about sixteen items, all pointing at a sample course', () => {
    expect(sample.scheduleItems).toHaveLength(16);
    const ids = new Set(sample.courses.map((c) => c.id));
    expect(sample.scheduleItems.every((i) => ids.has(i.courseId))).toBe(true);
    const types = new Set(sample.scheduleItems.map((i) => i.type));
    for (const t of ['assignment', 'quiz', 'exam', 'reading', 'project'] as const) {
      expect(types.has(t)).toBe(true);
    }
  });

  it('returns one or two contacts on sample courses', () => {
    expect(sample.contacts.length).toBeGreaterThanOrEqual(1);
    expect(sample.contacts.length).toBeLessThanOrEqual(2);
    const ids = new Set(sample.courses.map((c) => c.id));
    expect(sample.contacts.every((c) => ids.has(c.courseId))).toBe(true);
  });

  it('flags every record sample: true', () => {
    for (const r of [...sample.courses, ...sample.scheduleItems, ...sample.contacts]) {
      expect(r.sample).toBe(true);
    }
  });

  it('has unique ids across all records', () => {
    const all = [...sample.courses, ...sample.scheduleItems, ...sample.contacts].map((r) => r.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('is deterministic for the same day', () => {
    expect(buildSampleSemester(TODAY)).toEqual(buildSampleSemester(new Date(TODAY)));
    expect(buildSampleSemester(TODAY, ['Fall 2026'])).toEqual(
      buildSampleSemester(TODAY, ['Fall 2026']),
    );
  });

  it('puts due dates relative to today', () => {
    const later = buildSampleSemester(new Date(2027, 2, 3, 8, 0));
    const offsets = (items: ScheduleItem[], day: Date) =>
      items.map((i) => daysUntilDue(i.dueDate, day));
    expect(offsets(later.scheduleItems, new Date(2027, 2, 3, 8, 0))).toEqual(
      offsets(sample.scheduleItems, TODAY),
    );
  });

  it('includes an overdue item, an item due today and an exam inside ten days', () => {
    const open = sample.scheduleItems.filter((i) => !i.completed);
    expect(open.some((i) => isOverdue(i, TODAY))).toBe(true);
    expect(open.some((i) => daysUntilDue(i.dueDate, TODAY) === 0 && !isOverdue(i, TODAY))).toBe(
      true,
    );
    expect(
      open.some((i) => {
        const d = daysUntilDue(i.dueDate, TODAY);
        return i.type === 'exam' && d > 0 && d <= 10;
      }),
    ).toBe(true);
  });

  it('has weighted items and a completed one with a score', () => {
    expect(sample.scheduleItems.filter((i) => i.gradeWeight).length).toBeGreaterThanOrEqual(8);
    const done = sample.scheduleItems.filter((i) => i.completed);
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((i) => i.earnedScore !== undefined && i.gradeWeight)).toBe(true);
  });

  it('gives the dashboard hero something urgent to show', () => {
    const hero = pickNowHero(sample.scheduleItems, sample.courses, [], TODAY);
    expect(hero.kind).toBe('urgent');
  });

  it('uses the first existing term, else the term today falls in', () => {
    expect(buildSampleSemester(TODAY, ['Spring 2026', 'Fall 2025']).term).toBe('Spring 2026');
    expect(buildSampleSemester(TODAY, ['', '  ']).term).toBe('Fall 2026');
    expect(sample.courses.every((c) => c.term === 'Fall 2026')).toBe(true);
    expect(termLabelFor(new Date(2027, 0, 20))).toBe('Spring 2027');
    expect(termLabelFor(new Date(2027, 5, 20))).toBe('Summer 2027');
  });
});

describe('sample record helpers', () => {
  const mine: Course = { id: 'c-real', code: 'ENGL 101', title: 'Composition' };
  const myItem: ScheduleItem = {
    id: 'i-real',
    courseId: 'c-real',
    title: 'Essay',
    type: 'assignment',
    dueDate: '2026-11-01',
    completed: false,
  };
  const myContact: Contact = {
    id: 'k-real',
    courseId: 'c-real',
    role: 'professor',
    fullName: 'Real Person',
  };

  const sample = buildSampleSemester(TODAY);
  const scope = {
    courses: [mine, ...sample.courses],
    scheduleItems: [myItem, ...sample.scheduleItems],
    contacts: [myContact, ...sample.contacts],
  };

  it('detects whether any sample record exists', () => {
    expect(hasSampleData({ courses: [mine], scheduleItems: [myItem], contacts: [myContact] })).toBe(
      false,
    );
    expect(hasSampleData(scope)).toBe(true);
    expect(
      hasSampleData({ courses: [], scheduleItems: [], contacts: [{ ...myContact, sample: true }] }),
    ).toBe(true);
  });

  it('collects every sample record and none of the student’s own', () => {
    const found = collectSampleRecords(scope);
    expect(found.courses).toHaveLength(3);
    expect(found.scheduleItems).toHaveLength(16);
    expect(found.contacts).toHaveLength(2);
    expect(found.courses.some((c) => c.id === 'c-real')).toBe(false);
    expect(found.scheduleItems.some((i) => i.id === 'i-real')).toBe(false);
    expect(found.contacts.some((c) => c.id === 'k-real')).toBe(false);
  });

  it('withoutSample drops flagged records only', () => {
    expect(withoutSample(scope.courses)).toEqual([mine]);
  });

  it('removing the sample courses through the reducer leaves the student’s data', () => {
    let state: AppState = { ...initialAppState, ...scope };
    for (const c of collectSampleRecords(scope).courses) {
      state = appStateReducer(state, { type: 'REMOVE_COURSE', payload: c.id });
    }
    expect(state.courses).toEqual([mine]);
    expect(state.scheduleItems).toEqual([myItem]);
    expect(state.contacts).toEqual([myContact]);
  });

  it('removing a single sample course the normal way still works', () => {
    let state: AppState = { ...initialAppState, ...scope };
    state = appStateReducer(state, { type: 'REMOVE_COURSE', payload: 'sample-course-1' });
    expect(state.courses.map((c) => c.id)).toEqual([
      'c-real',
      'sample-course-2',
      'sample-course-3',
    ]);
    expect(state.scheduleItems.some((i) => i.courseId === 'sample-course-1')).toBe(false);
    expect(state.contacts.some((c) => c.courseId === 'sample-course-1')).toBe(false);
    expect(hasSampleData(state)).toBe(true);
  });
});
