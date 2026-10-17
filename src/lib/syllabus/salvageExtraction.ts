import type { ZodType } from 'zod';
import {
  extractedCourseSchema,
  extractedScheduleItemSchema,
  syllabusExtractionSchema,
  type SyllabusExtractionResult,
} from '@/types/extraction';

/**
 * The extraction tool's output is validated strictly, and one bad field used to
 * fail the whole syllabus: a note a few characters over its limit, a date in an
 * odd shape on a single assignment, and the student saw "malformed, try again"
 * for a result that was 98% usable.
 *
 * This keeps what is usable and says what was left out, so the review screen
 * (which already lists `unresolved` notes) can tell the student exactly what to
 * add by hand.
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

interface FixResult<T> {
  value: T | null;
  /** Top-level fields (or list entries) that had to be dropped. */
  dropped: string[];
  /** Text that was cut to fit its limit. */
  clipped: number;
}

/**
 * Validates `input` against `schema`, repairing what can be repaired: an
 * over-long string is cut to its limit, a bad list entry is removed, any other
 * bad optional field is dropped. A problem in one of `required` fields makes the
 * whole object unusable (null).
 */
function repair<T>(schema: ZodType<T>, input: unknown, required: string[]): FixResult<T> {
  const dropped: string[] = [];
  let clipped = 0;
  if (!isObject(input)) return { value: null, dropped, clipped };
  const working: Json = JSON.parse(JSON.stringify(input));

  for (let pass = 0; pass < 12; pass++) {
    const result = schema.safeParse(working);
    if (result.success) return { value: result.data, dropped, clipped };

    let changed = false;
    const removals: Array<{ key: string; index: number }> = [];
    for (const issue of result.error.issues) {
      const path = issue.path as Array<string | number>;
      const key = path[0];
      if (typeof key !== 'string') return { value: null, dropped, clipped };
      if (required.includes(key)) return { value: null, dropped, clipped };

      // Too-long text: keep it, shortened.
      if (issue.code === 'too_big' && 'maximum' in issue && typeof issue.maximum === 'number') {
        let target: unknown = working;
        for (let i = 0; i < path.length - 1; i++) target = (target as Json)[path[i] as string];
        const last = path[path.length - 1] as string | number;
        const current = (target as Json)[last as string];
        if (typeof current === 'string') {
          (target as Json)[last as string] = current.slice(0, Math.max(0, issue.maximum - 1)) + '…';
          clipped++;
          changed = true;
          continue;
        }
      }
      // A bad entry in a list: remove just that entry.
      if (path.length >= 2 && typeof path[1] === 'number' && Array.isArray(working[key])) {
        removals.push({ key, index: path[1] });
        continue;
      }
      // Anything else optional: drop the field.
      if (key in working) {
        delete working[key];
        dropped.push(key);
        changed = true;
      }
    }
    // Remove list entries from the end so earlier indexes stay valid.
    removals
      .sort((a, b) => b.index - a.index)
      .forEach(({ key, index }, i, all) => {
        const list = working[key] as unknown[];
        // Skip duplicates when one entry raised several issues.
        if (i > 0 && all[i - 1].key === key && all[i - 1].index === index) return;
        if (index < list.length) {
          list.splice(index, 1);
          dropped.push(key);
          changed = true;
        }
      });
    if (!changed) return { value: null, dropped, clipped };
  }
  return { value: null, dropped, clipped };
}

const FIELD_LABELS: Record<string, string> = {
  notes: 'course notes',
  materials: 'materials',
  skipDates: 'skipped dates',
  contacts: 'contacts',
  learningObjectives: 'learning objectives',
  meetingTimes: 'meeting times',
  instructor: 'the instructor',
  term: 'the term',
  modality: 'how the class meets',
  suggestedColor: 'a suggested color',
  suggestedIcon: 'a suggested icon',
  suggestedFileName: 'a suggested file name',
};

const list = (items: string[]) =>
  items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export interface SalvagedExtraction {
  data: SyllabusExtractionResult;
  /** Plain-language notes for the review screen; empty when nothing was lost. */
  notes: string[];
  /** True when nothing needed repairing. */
  clean: boolean;
}

/** Keeps what is usable from an extraction, or null when the course itself is not. */
export function salvageExtraction(input: unknown): SalvagedExtraction | null {
  const strict = syllabusExtractionSchema.safeParse(input);
  if (strict.success) return { data: strict.data, notes: [], clean: true };
  if (!isObject(input)) return null;

  const course = repair(extractedCourseSchema, input.course, ['code', 'title']);
  if (!course.value) return null;

  const rawItems = Array.isArray(input.scheduleItems) ? input.scheduleItems : [];
  const items: SyllabusExtractionResult['scheduleItems'] = [];
  const skippedTitles: string[] = [];
  let clipped = course.clipped;
  const droppedItemFields = new Set<string>();
  for (const raw of rawItems) {
    const fixed = repair(extractedScheduleItemSchema, raw, [
      'title',
      'type',
      'dueDate',
      'dateConfidence',
    ]);
    if (fixed.value) {
      items.push(fixed.value);
      clipped += fixed.clipped;
      fixed.dropped.forEach((d) => droppedItemFields.add(d));
    } else {
      const title = isObject(raw) && typeof raw.title === 'string' ? raw.title.trim() : '';
      skippedTitles.push(title || 'an untitled item');
    }
  }

  const rawUnresolved = Array.isArray(input.unresolved) ? input.unresolved : [];
  const unresolved = rawUnresolved
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => (u.length > 1000 ? u.slice(0, 999) + '…' : u));

  const notes: string[] = [];
  if (skippedTitles.length > 0) {
    const shown = skippedTitles.slice(0, 3).map((t) => `"${t}"`);
    const more = skippedTitles.length > 3 ? ` and ${skippedTitles.length - 3} more` : '';
    notes.push(
      `${skippedTitles.length === 1 ? '1 item' : `${skippedTitles.length} items`} in the schedule couldn't be read and ${
        skippedTitles.length === 1 ? 'was' : 'were'
      } left out: ${list(shown)}${more}. Check the syllabus and add ${skippedTitles.length === 1 ? 'it' : 'them'} by hand.`,
    );
  }
  const droppedCourse = [...new Set(course.dropped)].map((k) => FIELD_LABELS[k] ?? k);
  if (droppedCourse.length > 0) {
    notes.push(`Some course details couldn't be read and were left blank: ${list(droppedCourse)}.`);
  }
  if (droppedItemFields.size > 0) {
    notes.push(
      `Some details on schedule items couldn't be read and were left blank: ${list(
        [...droppedItemFields].map((k) =>
          k === 'gradeWeight' ? 'grade weights' : (FIELD_LABELS[k] ?? k),
        ),
      )}.`,
    );
  }
  if (clipped > 0) {
    notes.push('Some long text was shortened to fit.');
  }

  return {
    data: { course: course.value, scheduleItems: items, unresolved: [...notes, ...unresolved] },
    notes,
    clean: false,
  };
}
