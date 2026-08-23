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

export const courseFormSchema = z.object({
  code: z.string().trim().min(1, 'Course code is required').max(20, 'Keep it under 20 characters'),
  title: z
    .string()
    .trim()
    .min(1, 'Course title is required')
    .max(150, 'Keep it under 150 characters'),
  instructor: z.string().trim().max(100, 'Keep it under 100 characters').optional(),
  term: z.string().trim().max(50, 'Keep it under 50 characters').optional(),
  color: z.string().min(1),
  icon: z.string().min(1),
  modality: z.union([z.literal('in-person'), z.literal('online'), z.literal('hybrid')]).optional(),
  meetingTimes: z.array(meetingTimeSchema).optional(),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;
