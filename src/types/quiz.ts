import { z } from 'zod';

/**
 * A single AI-generated multiple-choice question. `correctIndex` points into
 * `choices` (always length 4) - kept as an index rather than the answer text
 * so shuffling/re-rendering never has to re-match strings.
 */
export interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  questions: QuizQuestion[];
  createdAt: string;
  sourceFileName?: string;
}

/** One completed run through a quiz - kept even after the quiz itself is
 * regenerated/deleted, so a course's score history survives a "make me a
 * fresh quiz" click. */
export interface QuizAttempt {
  id: string;
  quizId: string;
  courseId: string;
  score: number;
  total: number;
  completedAt: string;
}

export const generatedQuizQuestionSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
});

export const generatedQuizQuestionsSchema = z.array(generatedQuizQuestionSchema).min(1);

export type GeneratedQuizQuestion = z.infer<typeof generatedQuizQuestionSchema>;
