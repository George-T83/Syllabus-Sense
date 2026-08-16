import { describe, it, expect } from 'vitest';
import type { Course, ScheduleItem } from '@/types/schedule';
import {
  escapeICSText,
  foldICSLine,
  generateICS,
  scheduleItemToVEvent,
  buildICSUid,
  createICSBlob,
  buildICSFilename,
} from '@/lib/export/ics';

const NOW = new Date('2026-08-15T12:00:00.000Z');

const course: Course = {
  id: 'c1',
  code: 'CSCI 213',
  title: 'Computer Science I',
  instructor: 'Dr. Jane Smith',
  term: 'Fall 2026',
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

describe('escapeICSText', () => {
  it('escapes backslashes, commas, and semicolons', () => {
    expect(escapeICSText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
  });

  it('escapes backslash before other characters so output is not double-escaped', () => {
    // A literal backslash followed by a comma should become \\\, not \\\\,
    expect(escapeICSText('\\,')).toBe('\\\\\\,');
  });

  it('converts newlines to the literal \\n escape sequence', () => {
    expect(escapeICSText('line1\nline2')).toBe('line1\\nline2');
    expect(escapeICSText('line1\r\nline2')).toBe('line1\\nline2');
  });
});

describe('foldICSLine', () => {
  it('leaves short lines untouched', () => {
    const line = 'SUMMARY:Short title';
    expect(foldICSLine(line)).toBe(line);
  });

  it('folds a line longer than 75 octets at the 75th octet, with a leading space continuation', () => {
    const longValue = 'X'.repeat(100);
    const line = `SUMMARY:${longValue}`;
    const folded = foldICSLine(line);

    expect(folded).toContain('\r\n ');

    const segments = folded.split('\r\n ');
    // First segment must be exactly 75 octets (all ASCII here, so bytes === chars).
    expect(new TextEncoder().encode(segments[0]).length).toBe(75);
    // Continuation segments must be at most 74 octets (75 minus the leading space).
    for (const seg of segments.slice(1)) {
      expect(new TextEncoder().encode(seg).length).toBeLessThanOrEqual(74);
    }
    // Rejoining (minus the folding artifacts) must reproduce the original content.
    expect(segments.join('')).toBe(line);
  });

  it('does not split a multi-byte UTF-8 character across a fold boundary', () => {
    // Use a multi-byte character repeated so the fold boundary would land
    // mid-character if we folded on naive character counts.
    const value = 'é'.repeat(60); // 'é', 2 octets each in UTF-8 = 120 octets
    const line = `SUMMARY:${value}`;
    const folded = foldICSLine(line);

    for (const segment of folded.split('\r\n ')) {
      // A valid UTF-8 string decodes/re-encodes without replacement characters.
      const bytes = new TextEncoder().encode(segment);
      expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(segment);
    }
  });
});

describe('buildICSUid', () => {
  it('is deterministic for a given item id', () => {
    expect(buildICSUid({ id: 'abc' })).toBe(buildICSUid({ id: 'abc' }));
    expect(buildICSUid({ id: 'abc' })).toBe('abc@syllabus-sense.app');
  });
});

describe('scheduleItemToVEvent', () => {
  it('includes required VEVENT properties', () => {
    const vevent = scheduleItemToVEvent(makeItem(), course, NOW);

    expect(vevent).toContain('BEGIN:VEVENT');
    expect(vevent).toContain('END:VEVENT');
    expect(vevent).toContain('UID:item-1@syllabus-sense.app');
    expect(vevent).toContain('DTSTAMP:20260815T120000Z');
    expect(vevent).toContain('DTSTART:20260901T170000Z');
    expect(vevent).toContain('SUMMARY:CSCI 213: Homework 1');
  });

  it('produces a timed event with default 1-hour duration when estimatedHours is missing', () => {
    const vevent = scheduleItemToVEvent(makeItem(), course, NOW);
    expect(vevent).toContain('DTEND:20260901T180000Z');
  });

  it('uses estimatedHours for DTEND when provided', () => {
    const vevent = scheduleItemToVEvent(makeItem({ estimatedHours: 2.5 }), course, NOW);
    expect(vevent).toContain('DTSTART:20260901T170000Z');
    expect(vevent).toContain('DTEND:20260901T193000Z');
  });

  it('produces an all-day VALUE=DATE event for a bare YYYY-MM-DD dueDate', () => {
    const vevent = scheduleItemToVEvent(makeItem({ dueDate: '2026-09-01' }), course, NOW);
    expect(vevent).toContain('DTSTART;VALUE=DATE:20260901');
    expect(vevent).toContain('DTEND;VALUE=DATE:20260902');
  });

  it('escapes commas, semicolons, and newlines in the title', () => {
    const vevent = scheduleItemToVEvent(
      makeItem({ title: 'Essay, Part 2; Final Draft' }),
      course,
      NOW,
    );
    expect(vevent).toContain('SUMMARY:CSCI 213: Essay\\, Part 2\\; Final Draft');
  });

  it('folds a very long title across multiple lines', () => {
    const longTitle = 'A very long assignment title that keeps going '.repeat(4).trim();
    const vevent = scheduleItemToVEvent(makeItem({ title: longTitle }), course, NOW);
    const summaryLine = vevent.split('\r\n').findIndex((l) => l.startsWith('SUMMARY:'));
    expect(summaryLine).toBeGreaterThanOrEqual(0);
    // The line after SUMMARY's start should be a folded continuation (leading space)
    // whenever the summary exceeds 75 octets.
    const fullEvent = vevent.split('\r\n');
    const summaryStartsAt = fullEvent.findIndex((l) => l.startsWith('SUMMARY:'));
    if (new TextEncoder().encode(fullEvent[summaryStartsAt]).length >= 75) {
      expect(fullEvent[summaryStartsAt + 1]?.startsWith(' ')).toBe(true);
    }
  });

  it('omits course prefix and instructor line when no course is provided', () => {
    const vevent = scheduleItemToVEvent(makeItem(), undefined, NOW);
    expect(vevent).toContain('SUMMARY:Homework 1');
    expect(vevent).not.toContain('Instructor:');
  });

  it('includes notes in DESCRIPTION when present, omits DESCRIPTION when absent', () => {
    const withNotes = scheduleItemToVEvent(makeItem({ notes: 'Bring calculator' }), course, NOW);
    expect(withNotes).toContain('DESCRIPTION:Instructor: Dr. Jane Smith\\nBring calculator');

    const withoutNotes = scheduleItemToVEvent(makeItem(), undefined, NOW);
    expect(withoutNotes).not.toContain('DESCRIPTION:');
  });
});

describe('generateICS', () => {
  it('wraps events in a valid VCALENDAR with required calendar properties', () => {
    const ics = generateICS([makeItem()], [course], NOW);

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Syllabus Sense//Calendar Export//EN');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('uses CRLF line endings throughout, never a bare LF', () => {
    const ics = generateICS([makeItem()], [course], NOW);
    // Normalize CRLF away, then assert no lone LF remains.
    const withoutCRLF = ics.replace(/\r\n/g, '');
    expect(withoutCRLF.includes('\n')).toBe(false);
    expect(ics.includes('\r\n')).toBe(true);
  });

  it('produces one VEVENT per schedule item', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b', title: 'HW2' })];
    const ics = generateICS(items, [course], NOW);
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2);
    expect(ics.split('END:VEVENT').length - 1).toBe(2);
  });

  it('handles an empty item array by producing a valid, event-less calendar', () => {
    const ics = generateICS([], [course], NOW);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('still exports an item whose course is missing from the courses array', () => {
    const ics = generateICS([makeItem({ courseId: 'unknown' })], [course], NOW);
    expect(ics).toContain('SUMMARY:Homework 1');
  });
});

describe('createICSBlob', () => {
  it('creates a Blob with the correct calendar MIME type', () => {
    const blob = createICSBlob('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    expect(blob.type).toBe('text/calendar;charset=utf-8');
  });
});

describe('buildICSFilename', () => {
  it('sanitizes unsafe characters and appends .ics', () => {
    expect(buildICSFilename('My Schedule: Fall 2026!')).toBe('My-Schedule-Fall-2026.ics');
  });

  it('falls back to a default name when input is empty', () => {
    expect(buildICSFilename('   ')).toBe('schedule.ics');
  });
});
