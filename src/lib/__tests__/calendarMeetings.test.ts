import { describe, it, expect } from 'vitest';
import { formatTimeLabel, getMeetingsForDay } from '@/lib/calendar/meetings';
import type { Course } from '@/types/schedule';

const monday = new Date(2026, 8, 7); // Sep 7, 2026 is a Monday
const tuesday = new Date(2026, 8, 8);

const courses: Course[] = [
  {
    id: 'c1',
    code: 'CSCI 213',
    title: 'Computer Science I',
    color: 'bg-blue-500',
    meetingTimes: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:15', location: 'Rm 204' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '10:15' },
    ],
  },
  {
    id: 'c2',
    code: 'MATH 301',
    title: 'Linear Algebra',
    color: 'bg-green-500',
    meetingTimes: [{ dayOfWeek: 1, startTime: '08:00', endTime: '08:50' }],
  },
  {
    id: 'c3',
    code: 'PHIL 101',
    title: 'Ethics',
    color: 'bg-purple-500',
    // No meetingTimes at all - should simply contribute nothing.
  },
];

describe('getMeetingsForDay', () => {
  it('returns every course meeting whose dayOfWeek matches, sorted by start time', () => {
    const result = getMeetingsForDay(courses, monday);
    expect(result.map((m) => m.course.id)).toEqual(['c2', 'c1']);
  });

  it('returns an empty array for a day with no recurring meetings', () => {
    expect(getMeetingsForDay(courses, tuesday)).toEqual([]);
  });

  it('does not throw for courses missing meetingTimes entirely', () => {
    expect(() => getMeetingsForDay([{ id: 'x', code: 'X', title: 'X' }], monday)).not.toThrow();
  });
});

describe('formatTimeLabel', () => {
  it('formats morning times', () => {
    expect(formatTimeLabel('09:00')).toBe('9:00 AM');
  });

  it('formats afternoon times', () => {
    expect(formatTimeLabel('14:30')).toBe('2:30 PM');
  });

  it('formats midnight and noon edge cases', () => {
    expect(formatTimeLabel('00:00')).toBe('12:00 AM');
    expect(formatTimeLabel('12:00')).toBe('12:00 PM');
  });
});
