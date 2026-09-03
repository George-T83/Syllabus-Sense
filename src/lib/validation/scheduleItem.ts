import { z } from 'zod';

export const scheduleItemFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Keep it under 200 characters'),
  type: z.enum(['assignment', 'exam', 'quiz', 'project', 'reading', 'other']),
  courseId: z.string().min(1, 'Select a course'),
  dueDate: z.string().min(1, 'Due date is required'),
  estimatedHours: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a positive number'),
  priority: z.enum(['low', 'medium', 'high']),
  notes: z.string().max(500, 'Keep it under 500 characters').optional(),
  progress: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
      'Enter 0-100',
    ),
  gradeWeight: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
      'Enter 0-100',
    ),
  gradeCategory: z.string().max(60, 'Keep it under 60 characters').optional(),
});

export type ScheduleItemFormValues = z.infer<typeof scheduleItemFormSchema>;
