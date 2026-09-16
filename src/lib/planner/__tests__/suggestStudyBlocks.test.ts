import { describe, it, expect } from 'vitest';
import { suggestStudyBlocks } from '../suggestStudyBlocks';
import type { Course, MeetingTime, ScheduleItem } from '@/types/schedule';

// Wed, Sep 16 2026 - matches dayOfWeek=3 for meeting/shift-conflict tests.
const REFERENCE = new Date(2026, 8, 16);

let idCounter = 0;
function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  idCounter += 1;
  return {
    id: `item-${idCounter}`,
    courseId: 'course-1',
    title: `Item ${idCounter}`,
    type: 'assignment',
    dueDate: '2026-09-20',
    completed: false,
    ...overrides,
  };
}

function courseWithMeeting(startTime: string, endTime: string, dayOfWeek: number): Course {
  return {
    id: 'course-1',
    code: 'CS 101',
    title: 'Intro to CS',
    meetingTimes: [{ dayOfWeek, startTime, endTime }],
  };
}

function studyEntries(entries: ReturnType<typeof suggestStudyBlocks>) {
  return entries.filter((e) => e.kind === 'study');
}

describe('suggestStudyBlocks', () => {
  it('returns no suggestions when there are no upcoming items', () => {
    expect(suggestStudyBlocks([], [], [], REFERENCE)).toEqual([]);
  });

  it('excludes completed items', () => {
    const done = item({ estimatedHours: 3, completed: true });
    expect(suggestStudyBlocks([done], [], [], REFERENCE)).toEqual([]);
  });

  it('excludes items already past their due date', () => {
    const overdue = item({ dueDate: '2026-09-10', estimatedHours: 2 });
    expect(suggestStudyBlocks([overdue], [], [], REFERENCE)).toEqual([]);
  });

  it('suggests a single block for a small item with no conflicting meetings', () => {
    const small = item({ estimatedHours: 1 });
    const entries = suggestStudyBlocks([small], [], [], REFERENCE);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'study',
      dateKey: '2026-09-16',
      startTime: '09:00',
      endTime: '10:00',
      item: small,
    });
  });

  it('splits an item larger than the max block length into multiple blocks', () => {
    const big = item({ estimatedHours: 5, dueDate: '2026-09-25' });
    const blocks = studyEntries(suggestStudyBlocks([big], [], [], REFERENCE));
    // 5h split into blocks capped at 2h each -> at least 3 blocks.
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) {
      const [sh, sm] = block.startTime.split(':').map(Number);
      const [eh, em] = block.endTime.split(':').map(Number);
      const length = eh + em / 60 - (sh + sm / 60);
      expect(length).toBeLessThanOrEqual(2);
      expect(length).toBeGreaterThan(0);
    }
  });

  it('caps total suggested study hours per day', () => {
    const huge = item({ estimatedHours: 20, dueDate: '2026-09-30' });
    const blocks = studyEntries(suggestStudyBlocks([huge], [], [], REFERENCE));
    const byDay = new Map<string, number>();
    for (const block of blocks) {
      const [sh, sm] = block.startTime.split(':').map(Number);
      const [eh, em] = block.endTime.split(':').map(Number);
      const length = eh + em / 60 - (sh + sm / 60);
      byDay.set(block.dateKey, (byDay.get(block.dateKey) ?? 0) + length);
    }
    for (const total of byDay.values()) {
      expect(total).toBeLessThanOrEqual(4);
    }
  });

  it('routes around a same-day class meeting instead of overlapping it', () => {
    const course = courseWithMeeting('10:00', '11:15', REFERENCE.getDay());
    const task = item({ estimatedHours: 1 });
    const blocks = studyEntries(suggestStudyBlocks([task], [course], [], REFERENCE));
    for (const block of blocks.filter((b) => b.dateKey === '2026-09-16')) {
      const [sh] = block.startTime.split(':').map(Number);
      const [eh] = block.endTime.split(':').map(Number);
      const overlapsClass = sh < 11.25 && eh > 10;
      expect(overlapsClass).toBe(false);
    }
  });

  it('gives the more urgent item first claim on the earliest free time', () => {
    const urgent = item({ estimatedHours: 1, priority: 'high', dueDate: '2026-09-17' });
    const relaxed = item({ estimatedHours: 1, priority: 'low', dueDate: '2026-09-30' });
    const blocks = studyEntries(suggestStudyBlocks([relaxed, urgent], [], [], REFERENCE));
    expect(blocks[0].item.id).toBe(urgent.id);
  });

  it('gives an item with no estimatedHours a default one-hour suggestion', () => {
    const noEstimate = item({});
    const blocks = studyEntries(suggestStudyBlocks([noEstimate], [], [], REFERENCE));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].startTime).toBe('09:00');
    expect(blocks[0].endTime).toBe('10:00');
  });

  it('blocks out a recurring work shift the same way it blocks a class meeting', () => {
    const shift: MeetingTime = {
      dayOfWeek: REFERENCE.getDay(),
      startTime: '09:00',
      endTime: '13:00',
    };
    const task = item({ estimatedHours: 2, dueDate: '2026-09-25' });
    const entries = suggestStudyBlocks([task], [], [shift], REFERENCE);
    const todayEntries = entries.filter((e) => e.dateKey === '2026-09-16');
    expect(todayEntries.length).toBeGreaterThan(0);
    for (const entry of todayEntries) {
      const [sh] = entry.startTime.split(':').map(Number);
      expect(sh).toBeGreaterThanOrEqual(13);
    }
  });

  it('inserts a short break between two consecutive blocks when there is room', () => {
    const task = item({ estimatedHours: 3, dueDate: '2026-09-25' });
    const entries = suggestStudyBlocks([task], [], [], REFERENCE);
    const breaks = entries.filter((e) => e.kind === 'break');
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toMatchObject({
      dateKey: '2026-09-16',
      startTime: '11:00',
      endTime: '11:15',
    });
    const blocks = studyEntries(entries);
    expect(blocks[0]).toMatchObject({ startTime: '09:00', endTime: '11:00' });
    expect(blocks[1]).toMatchObject({ startTime: '11:15', endTime: '12:15' });
  });

  it('does not insert a trailing break when nothing more needs scheduling', () => {
    const task = item({ estimatedHours: 1 });
    const entries = suggestStudyBlocks([task], [], [], REFERENCE);
    expect(entries.filter((e) => e.kind === 'break')).toHaveLength(0);
  });

  it('does not squeeze a break in right against a class meeting boundary', () => {
    const course = courseWithMeeting('10:00', '11:15', REFERENCE.getDay());
    const first = item({ estimatedHours: 1, priority: 'high', dueDate: '2026-09-17' });
    const second = item({ estimatedHours: 1, priority: 'low', dueDate: '2026-09-30' });
    const entries = suggestStudyBlocks([second, first], [course], [], REFERENCE);
    const todayEntries = entries.filter((e) => e.dateKey === '2026-09-16');
    // The [9,10) interval exactly fits `first`'s 1h - no break should be
    // squeezed in against the 10:00 meeting boundary.
    expect(todayEntries.some((e) => e.kind === 'break')).toBe(false);
  });
});
