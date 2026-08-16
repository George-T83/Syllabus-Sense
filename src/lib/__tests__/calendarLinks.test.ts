import { describe, it, expect } from 'vitest';
import type { Course, ScheduleItem } from '@/types/schedule';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '@/lib/export/calendarLinks';

const course: Course = {
  id: 'c1',
  code: 'CSCI 213',
  title: 'Computer Science I',
  instructor: 'Dr. Jane Smith',
};

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item-1',
    courseId: 'c1',
    title: 'Homework 1',
    type: 'assignment',
    dueDate: '2026-09-01T17:00:00.000Z',
    completed: false,
    ...overrides,
  };
}

describe('generateGoogleCalendarUrl', () => {
  it('builds a TEMPLATE render URL with encoded text and dates', () => {
    const url = generateGoogleCalendarUrl(makeItem(), course);
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('CSCI 213: Homework 1');
    expect(parsed.searchParams.get('dates')).toBe('20260901T170000Z/20260901T180000Z');
  });

  it('encodes special characters in the instructor name and title', () => {
    const url = generateGoogleCalendarUrl(makeItem({ title: 'Essay, Draft & Review' }), {
      ...course,
      instructor: "Dr. O'Malley & Smith",
    });
    // Raw special characters must not appear unencoded in the query string.
    expect(url).not.toContain('&Review'); // would indicate an unencoded literal "&"
    expect(url).toContain(encodeURIComponent('Essay, Draft & Review').replace(/%20/g, '+'));
  });

  it('uses all-day date-only range for a bare YYYY-MM-DD dueDate', () => {
    const url = generateGoogleCalendarUrl(makeItem({ dueDate: '2026-09-01' }), course);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('dates')).toBe('20260901/20260902');
  });

  it('omits details param when there is no course/notes info', () => {
    const url = generateGoogleCalendarUrl(makeItem());
    const parsed = new URL(url);
    expect(parsed.searchParams.has('details')).toBe(false);
  });

  it('includes instructor and notes in details when present', () => {
    const url = generateGoogleCalendarUrl(makeItem({ notes: 'Bring calculator' }), course);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('details')).toBe('Instructor: Dr. Jane Smith\nBring calculator');
  });
});

describe('generateOutlookCalendarUrl', () => {
  it('builds an Outlook deeplink compose URL with ISO start/end', () => {
    const url = generateOutlookCalendarUrl(makeItem(), course);
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      'https://outlook.live.com/calendar/0/deeplink/compose',
    );
    expect(parsed.searchParams.get('subject')).toBe('CSCI 213: Homework 1');
    expect(parsed.searchParams.get('startdt')).toBe('2026-09-01T17:00:00.000Z');
    expect(parsed.searchParams.get('enddt')).toBe('2026-09-01T18:00:00.000Z');
    expect(parsed.searchParams.get('allday')).toBe('false');
  });

  it('marks all-day for a bare YYYY-MM-DD dueDate', () => {
    const url = generateOutlookCalendarUrl(makeItem({ dueDate: '2026-09-01' }), course);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('allday')).toBe('true');
  });

  it('works with no course and no notes (missing optional fields)', () => {
    const url = generateOutlookCalendarUrl(makeItem());
    const parsed = new URL(url);
    expect(parsed.searchParams.get('subject')).toBe('Homework 1');
    expect(parsed.searchParams.has('body')).toBe(false);
  });
});
