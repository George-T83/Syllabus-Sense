import { z } from 'zod';

/** A single thing a student should specifically watch out for - anything
 * that carries real consequences if missed (a hard deadline policy, a
 * mandatory session, a grade cliff) rather than routine syllabus content. */
export const courseSummaryNoteSchema = z.object({
  category: z.enum([
    'attendance',
    'grading',
    'lateWork',
    'academicIntegrity',
    'prerequisite',
    'highStakes',
    'communication',
    'other',
  ]),
  note: z.string(),
});

export const courseSummarySchema = z.object({
  summary: z.string(),
  importantNotes: z.array(courseSummaryNoteSchema),
});

export type CourseSummaryNote = z.infer<typeof courseSummaryNoteSchema>;
export type CourseSummaryResult = z.infer<typeof courseSummarySchema>;

/** What actually gets stored on Course.aiSummary - the model's output plus
 * bookkeeping about when/from-what it was generated. */
export interface CourseAiSummary extends CourseSummaryResult {
  generatedAt: string;
  sourceFileName: string;
}
