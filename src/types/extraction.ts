import { z } from 'zod';
import { COURSE_COLOR_PRESETS } from '@/lib/courseColors';

const courseColorValues = COURSE_COLOR_PRESETS.map((p) => p.value) as [string, ...string[]];

/**
 * Schema for what Claude extracts from a syllabus PDF (Epic 6). Shared
 * between the API route (validates the model's tool-call output before
 * trusting it) and the review UI (typed draft the user edits before it's
 * committed to Firestore via the normal createCourse/createScheduleItem
 * calls - nothing here is written directly).
 *
 * Design notes, from reading 8 real syllabi before building this:
 * - Not every syllabus has an explicit due date for every item (some post
 *   dates on the LMS instead, some grade purely on attendance). `dueDate`
 *   is nullable and `dateConfidence` is honest about how sure the
 *   resolution is, rather than silently guessing.
 * - Class meetings vs. office hours are easy to conflate; `meetingTimes`
 *   should only be the actual class/lecture/rehearsal schedule.
 * - Holidays/breaks called out in a weekly schedule table go in
 *   `skipDates` so the calendar's recurring-meeting renderer can skip them,
 *   distinct from `scheduleItems` (real deadlines never disappear).
 * - Grading isn't always percentage-based (points totals, attendance-only,
 *   completion contracts all show up) - `gradeWeight`/`gradeCategory` stay
 *   optional.
 */

const assignmentTypeSchema = z.enum(['assignment', 'exam', 'quiz', 'project', 'reading', 'other']);

const modalitySchema = z.enum(['in-person', 'online', 'hybrid']);

export const extractedMeetingTimeSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  location: z.string().max(100).nullable().optional(),
});

export const extractedScheduleItemSchema = z.object({
  title: z.string().min(1).max(200),
  type: assignmentTypeSchema,
  /** ISO date YYYY-MM-DD, or null when the syllabus gives no basis to
   * compute one at all (e.g. "dates posted on Blackboard"). */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  dateConfidence: z.enum(['exact', 'approximate', 'unknown']),
  gradeWeight: z.number().min(0).max(100).nullable().optional(),
  gradeCategory: z.string().max(60).nullable().optional(),
  /** Short free-text context, e.g. "counts as unexcused absence if missed". */
  notes: z.string().max(300).nullable().optional(),
  highStakes: z.boolean().optional(),
});

export const extractedCourseSchema = z.object({
  code: z.string().min(1).max(20),
  title: z.string().min(1).max(150),
  instructor: z.string().max(100).nullable().optional(),
  term: z.string().max(50).nullable().optional(),
  modality: modalitySchema.nullable().optional(),
  meetingTimes: z.array(extractedMeetingTimeSchema).default([]),
  /** General materials/resources not tied to a specific date - textbook
   * (required or optional), supplies, dress code, etc. */
  materials: z.array(z.string().max(400)).default([]),
  /** ISO dates within the term where meetings don't happen (holidays,
   * breaks) called out in the syllabus's own schedule. */
  skipDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  /** Free-text catch-all for things worth keeping but not worth modeling
   * structurally: footnotes on meeting times, "no comprehensive final",
   * grading-dispute windows, etc. */
  notes: z.string().max(1000).nullable().optional(),
  /** A course-color preset (one of COURSE_COLOR_PRESETS) that Claude judges
   * to fit the subject's common academic color convention, e.g. green for
   * a natural science, red/blue for math - a nicer starting point than
   * round-robin assignment. Still just a suggestion: the review screen
   * lets the user override it, and it's ignored if it collides with a
   * color an existing course already uses. */
  suggestedColor: z.enum(courseColorValues).nullable().optional(),
  /** A clean, human-readable file name (no extension) for the uploaded
   * syllabus, built from the actual course code/term rather than whatever
   * the source file happened to be named, e.g. "ECON 201 - Fall 2026
   * Syllabus" instead of "scan0042.pdf". */
  suggestedFileName: z.string().min(1).max(80).nullable().optional(),
});

export const syllabusExtractionSchema = z.object({
  course: extractedCourseSchema,
  scheduleItems: z.array(extractedScheduleItemSchema).default([]),
  /** Things the parser noticed but couldn't confidently extract, in plain
   * language for the review screen, e.g. "Exam dates aren't in this
   * syllabus - your professor posts them on Blackboard." */
  unresolved: z.array(z.string().max(300)).default([]),
});

export type ExtractedMeetingTime = z.infer<typeof extractedMeetingTimeSchema>;
export type ExtractedScheduleItem = z.infer<typeof extractedScheduleItemSchema>;
export type ExtractedCourse = z.infer<typeof extractedCourseSchema>;
export type SyllabusExtractionResult = z.infer<typeof syllabusExtractionSchema>;
