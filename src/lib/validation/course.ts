import { z } from 'zod';

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const meetingTimeSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timePattern, 'Use HH:mm'),
    endTime: z.string().regex(timePattern, 'Use HH:mm'),
    location: z.string().trim().max(100, 'Keep it under 100 characters').optional(),
  })
  .refine((m) => m.endTime > m.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export const CREDITS_RANGE_MESSAGE = 'Enter 1-12';
export const CREDITS_REQUIRED_MESSAGE =
  'Enter credit hours (1-12) - they feed your GPA and degree progress.';

/** Whether `v` is a usable credit count: a number above 0 and at most 12. */
export function isValidCredits(v: string): boolean {
  return !Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 12;
}

/**
 * For flows that must record credits (the syllabus autofill): blank is an
 * error, and anything filled in follows the same 1-12 rule as the Add Course
 * dialog. Returns the message to show, or null when the value is fine.
 */
export function creditsProblem(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return CREDITS_REQUIRED_MESSAGE;
  return isValidCredits(v) ? null : CREDITS_RANGE_MESSAGE;
}

export const courseFormSchema = z.object({
  code: z.string().trim().min(1, 'Course code is required').max(20, 'Keep it under 20 characters'),
  title: z
    .string()
    .trim()
    .min(1, 'Course title is required')
    .max(150, 'Keep it under 150 characters'),
  instructor: z.string().trim().max(100, 'Keep it under 100 characters').optional(),
  /** A term id from the student's terms (see types/term.ts), or empty. */
  termId: z.string().optional(),
  credits: z
    .string()
    .optional()
    .refine((v) => !v || isValidCredits(v), CREDITS_RANGE_MESSAGE),
  color: z.string().min(1),
  icon: z.string().min(1),
  modality: z.union([z.literal('in-person'), z.literal('online'), z.literal('hybrid')]).optional(),
  meetingTimes: z.array(meetingTimeSchema).optional(),
  skipDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')).optional(),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;
