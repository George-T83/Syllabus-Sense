import { z } from 'zod';

export const courseFormSchema = z.object({
  code: z.string().trim().min(1, 'Course code is required').max(20, 'Keep it under 20 characters'),
  title: z
    .string()
    .trim()
    .min(1, 'Course title is required')
    .max(100, 'Keep it under 100 characters'),
  instructor: z.string().trim().max(100, 'Keep it under 100 characters').optional(),
  term: z.string().trim().max(50, 'Keep it under 50 characters').optional(),
  color: z.string().min(1),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;
