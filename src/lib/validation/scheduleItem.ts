import { z } from 'zod';

export const scheduleItemFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150, 'Keep it under 150 characters'),
  type: z.enum(['assignment', 'exam', 'quiz', 'project', 'reading', 'other']),
  courseId: z.string().min(1, 'Select a course'),
  dueDate: z.string().min(1, 'Due date is required'),
  estimatedHours: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a positive number'),
  priority: z.enum(['low', 'medium', 'high']),
  notes: z.string().max(500, 'Keep it under 500 characters').optional(),
});

export type ScheduleItemFormValues = z.infer<typeof scheduleItemFormSchema>;
