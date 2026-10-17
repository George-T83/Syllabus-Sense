import { describe, it, expect } from 'vitest';
import { salvageExtraction } from '../salvageExtraction';

const course = { code: 'CSCI 213', title: 'Data Structures' };
const item = (o: Record<string, unknown> = {}) => ({
  title: 'Problem Set 1',
  type: 'assignment',
  dueDate: '2026-09-10',
  dateConfidence: 'exact',
  ...o,
});

describe('salvageExtraction', () => {
  it('passes a valid extraction through untouched and says nothing was lost', () => {
    const r = salvageExtraction({
      course,
      scheduleItems: [item()],
      unresolved: ['Exam dates are on Blackboard.'],
    });
    expect(r?.clean).toBe(true);
    expect(r?.notes).toEqual([]);
    expect(r?.data.scheduleItems).toHaveLength(1);
    expect(r?.data.unresolved).toEqual(['Exam dates are on Blackboard.']);
  });

  it('leaves out one unreadable assignment and keeps the rest, naming what was lost', () => {
    const r = salvageExtraction({
      course,
      scheduleItems: [
        item({ title: 'Quiz 1' }),
        item({ title: 'Midterm', dueDate: 'next Tuesday' }),
        item({ title: 'Final' }),
      ],
    });
    expect(r?.clean).toBe(false);
    expect(r?.data.scheduleItems.map((i) => i.title)).toEqual(['Quiz 1', 'Final']);
    expect(r?.notes[0]).toContain('1 item in the schedule');
    expect(r?.notes[0]).toContain('"Midterm"');
    expect(r?.data.unresolved).toContain(r?.notes[0]);
  });

  it('names a few lost items and counts the rest', () => {
    const bad = (t: string) => item({ title: t, dueDate: 'soon' });
    const r = salvageExtraction({
      course,
      scheduleItems: [bad('A'), bad('B'), bad('C'), bad('D'), bad('E')],
    });
    expect(r?.data.scheduleItems).toEqual([]);
    expect(r?.notes[0]).toContain('5 items in the schedule');
    expect(r?.notes[0]).toContain('and 2 more');
  });

  it('shortens text that runs over its limit instead of failing', () => {
    const r = salvageExtraction({
      course: { ...course, notes: 'x'.repeat(1200) },
      scheduleItems: [item({ notes: 'y'.repeat(400) })],
    });
    expect(r?.data.course.notes).toHaveLength(1000);
    expect(r?.data.course.notes?.endsWith('…')).toBe(true);
    expect(r?.data.scheduleItems[0].notes).toHaveLength(300);
    expect(r?.notes).toContain('Some long text was shortened to fit.');
  });

  it('removes a bad list entry and keeps the others', () => {
    const r = salvageExtraction({
      course: {
        ...course,
        skipDates: ['2026-10-12', 'fall break', '2026-11-26'],
        materials: ['Textbook', 'z'.repeat(500)],
      },
      scheduleItems: [],
    });
    expect(r?.data.course.skipDates).toEqual(['2026-10-12', '2026-11-26']);
    // the long material is shortened, not removed
    expect(r?.data.course.materials).toHaveLength(2);
    expect(r?.notes.join(' ')).toContain('skipped dates');
  });

  it('drops an invalid optional field and says so', () => {
    const r = salvageExtraction({
      course: { ...course, suggestedColor: 'chartreuse', modality: 'sideways' },
      scheduleItems: [],
    });
    expect(r?.data.course.suggestedColor).toBeUndefined();
    expect(r?.data.course.modality).toBeUndefined();
    expect(r?.notes.join(' ')).toMatch(/a suggested color/);
    expect(r?.notes.join(' ')).toMatch(/how the class meets/);
  });

  it('keeps an item whose optional grade weight is nonsense, blank', () => {
    const r = salvageExtraction({ course, scheduleItems: [item({ gradeWeight: 'a lot' })] });
    expect(r?.data.scheduleItems).toHaveLength(1);
    expect(r?.data.scheduleItems[0].gradeWeight).toBeUndefined();
    expect(r?.notes.join(' ')).toContain('grade weights');
  });

  it('gives up only when the course itself has no usable code or title', () => {
    expect(salvageExtraction({ course: { title: 'No code' }, scheduleItems: [item()] })).toBeNull();
    expect(salvageExtraction({ course: { code: 'X 1' }, scheduleItems: [] })).toBeNull();
    expect(salvageExtraction({ scheduleItems: [] })).toBeNull();
    expect(salvageExtraction('not an object')).toBeNull();
    expect(salvageExtraction(null)).toBeNull();
  });

  it('tolerates a missing schedule list', () => {
    const r = salvageExtraction({ course: { ...course, notes: 'n'.repeat(2000) } });
    expect(r?.data.scheduleItems).toEqual([]);
  });

  it("puts what was lost ahead of the parser's own notes", () => {
    const r = salvageExtraction({
      course,
      scheduleItems: [item({ title: 'Lost', dueDate: '??' })],
      unresolved: ['Dates are on the LMS.'],
    });
    expect(r?.data.unresolved[0]).toContain('"Lost"');
    expect(r?.data.unresolved[r.data.unresolved.length - 1]).toBe('Dates are on the LMS.');
  });
});
