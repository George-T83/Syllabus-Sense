import { describe, it, expect } from 'vitest';
import { suggestStudyBlocks } from '../suggestStudyBlocks';
import type { Course, ScheduleItem } from '@/types/schedule';

// Wed, Sep 16 2026 - matches dayOfWeek=3 for meeting-conflict tests.
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

describe('suggestStudyBlocks', () => {
  it('returns no suggestions when there are no upcoming items', () => {
    expect(suggestStudyBlocks([], [], REFERENCE)).toEqual([]);
  });

  it('excludes completed items', () => {
    const done = item({ estimatedHours: 3, completed: true });
    expect(suggestStudyBlocks([done], [], REFERENCE)).toEqual([]);
  });

  it('excludes items already past their due date', () => {
    const overdue = item({ dueDate: '2026-09-10', estimatedHours: 2 });
    expect(suggestStudyBlocks([overdue], [], REFERENCE)).toEqual([]);
  });

  it('suggests a single block for a small item with no conflicting meetings', () => {
    const small = item({ estimatedHours: 1 });
    const suggestions = suggestStudyBlocks([small], [], REFERENCE);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      dateKey: '2026-09-16',
      startTime: '09:00',
      endTime: '10:00',
      item: small,
    });
  });

  it('splits an item larger than the max block length into multiple blocks', () => {
    const big = item({ estimatedHours: 5, dueDate: '2026-09-25' });
    const suggestions = suggestStudyBlocks([big], [], REFERENCE);
    // 5h split into blocks capped at 2h each -> at least 3 blocks.
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    for (const block of suggestions) {
      const [sh, sm] = block.startTime.split(':').map(Number);
      const [eh, em] = block.endTime.split(':').map(Number);
      const length = eh + em / 60 - (sh + sm / 60);
      expect(length).toBeLessThanOrEqual(2);
      expect(length).toBeGreaterThan(0);
    }
  });

  it('caps total suggested hours per day', () => {
    const huge = item({ estimatedHours: 20, dueDate: '2026-09-30' });
    const suggestions = suggestStudyBlocks([huge], [], REFERENCE);
    const byDay = new Map<string, number>();
    for (const block of suggestions) {
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
    const suggestions = suggestStudyBlocks([task], [course], REFERENCE);
    for (const block of suggestions.filter((b) => b.dateKey === '2026-09-16')) {
      const [sh] = block.startTime.split(':').map(Number);
      const [eh] = block.endTime.split(':').map(Number);
      const overlapsClass = sh < 11.25 && eh > 10;
      expect(overlapsClass).toBe(false);
    }
  });

  it('gives the more urgent item first claim on the earliest free time', () => {
    const urgent = item({ estimatedHours: 1, priority: 'high', dueDate: '2026-09-17' });
    const relaxed = item({ estimatedHours: 1, priority: 'low', dueDate: '2026-09-30' });
    const suggestions = suggestStudyBlocks([relaxed, urgent], [], REFERENCE);
    const firstBlock = suggestions[0];
    expect(firstBlock.item.id).toBe(urgent.id);
  });

  it('gives an item with no estimatedHours a default one-hour suggestion', () => {
    const noEstimate = item({});
    const suggestions = suggestStudyBlocks([noEstimate], [], REFERENCE);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].startTime).toBe('09:00');
    expect(suggestions[0].endTime).toBe('10:00');
  });
});
