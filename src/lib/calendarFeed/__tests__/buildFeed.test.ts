import { describe, it, expect } from 'vitest';
import { buildCalendarFeed } from '../buildFeed';
import { generateICS } from '@/lib/export/ics';
import { generateCalendarFeedToken, isValidCalendarFeedToken } from '../token';
import type { Course, ScheduleItem } from '@/types/schedule';

const NOW = new Date('2026-10-17T12:00:00Z');
const course = { id: 'c1', code: 'BIO 101', title: 'Biology', instructor: 'Dr. Lee' } as Course;
const item = (over: Partial<ScheduleItem>): ScheduleItem =>
  ({
    id: 'i1',
    courseId: 'c1',
    title: 'Lab report',
    type: 'assignment',
    dueDate: '2026-10-20',
    completed: false,
    ...over,
  }) as ScheduleItem;

describe('buildCalendarFeed', () => {
  it('produces the same output as the download generator for valid items', () => {
    const items = [item({}), item({ id: 'i2', title: 'Midterm', dueDate: '2026-11-02T15:00:00Z' })];
    expect(buildCalendarFeed(items, [course], NOW)).toBe(generateICS(items, [course], NOW));
  });

  it('produces a valid, CRLF-terminated VCALENDAR with one VEVENT per item', () => {
    const ics = buildCalendarFeed([item({}), item({ id: 'i2' })], [course], NOW);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('leaves out an item with an unreadable due date instead of failing the whole feed', () => {
    const ics = buildCalendarFeed(
      [item({ id: 'bad', title: 'Broken', dueDate: 'not-a-date' }), item({})],
      [course],
      NOW,
    );
    expect(ics).not.toContain('Broken');
    expect(ics).toContain('SUMMARY:BIO 101: Lab report');
  });
});

describe('calendar feed tokens', () => {
  it('generates 32-character base64url tokens that validate and do not repeat', () => {
    const a = generateCalendarFeedToken();
    const b = generateCalendarFeedToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(isValidCalendarFeedToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it.each([
    '',
    'short',
    'a'.repeat(31),
    'a'.repeat(33),
    'a'.repeat(31) + '/',
    'a'.repeat(31) + '=',
  ])('rejects %j', (value) => {
    expect(isValidCalendarFeedToken(value)).toBe(false);
  });
});
