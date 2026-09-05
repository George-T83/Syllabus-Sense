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

describe('getMeetingsForDay term bounding', () => {
  const springCourse: Course = {
    id: 'c4',
    code: 'ECE 211',
    title: 'Circuit Analysis 1',
    color: 'bg-blue-500',
    term: 'Spring 2026',
    meetingTimes: [{ dayOfWeek: 1, startTime: '09:00', endTime: '09:50' }],
  };

  it('renders a Spring course meeting within its own term months', () => {
    const marchMonday = new Date(2026, 2, 2); // Mar 2, 2026 is a Monday
    expect(getMeetingsForDay([springCourse], marchMonday).map((m) => m.course.id)).toEqual(['c4']);
  });

  it('does not render a Spring course meeting the following August', () => {
    const augustMonday = new Date(2026, 7, 3); // Aug 3, 2026 is a Monday
    expect(getMeetingsForDay([springCourse], augustMonday)).toEqual([]);
  });

  it('still renders every week for a course with no term set', () => {
    const untouchedCourse: Course = { ...springCourse, id: 'c5', term: undefined };
    const augustMonday = new Date(2026, 7, 3);
    expect(getMeetingsForDay([untouchedCourse], augustMonday).map((m) => m.course.id)).toEqual([
      'c5',
    ]);
  });
});

describe('getMeetingsForDay skipDates', () => {
  const courseWithBreak: Course = {
    id: 'c6',
    code: 'CSCI 213',
    title: 'Computer Science I',
    color: 'bg-blue-500',
    meetingTimes: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:15' }],
    skipDates: ['2026-09-07'],
  };

  it("omits a meeting on a date listed in the course's skipDates", () => {
    expect(getMeetingsForDay([courseWithBreak], monday)).toEqual([]);
  });

  it('still renders the same weekday meeting on a date not in skipDates', () => {
    const nextMonday = new Date(2026, 8, 14);
    expect(getMeetingsForDay([courseWithBreak], nextMonday).map((m) => m.course.id)).toEqual([
      'c6',
    ]);
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
