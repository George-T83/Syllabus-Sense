import { z } from 'zod';

/**
 * A single front/back study card, scheduled with the SM-2 spaced-repetition
 * algorithm (lib/flashcards/sm2.ts). `interval`/`repetitions`/`easeFactor`
 * are SM-2's own state, persisted so a review session picks up exactly
 * where the student left off.
 */
export interface Flashcard {
  id: string;
  courseId: string;
  front: string;
  back: string;
  /** Days until the next review, per SM-2. */
  interval: number;
  /** Consecutive correct ("Hard" or better) reviews in a row. */
  repetitions: number;
  /** SM-2 ease factor, starts at 2.5 and never drops below 1.3. */
  easeFactor: number;
  /** ISO date (YYYY-MM-DD) - the card is due for review on or after this date. */
  dueDate: string;
  lastReviewedAt?: string;
  createdAt: string;
  /** Which syllabus this card was generated from, if AI-generated. */
  sourceFileName?: string;
}

/** One card as returned by the flashcard-generation API, before SM-2 state
 * or IDs are attached. */
export const generatedFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});

export const generatedFlashcardsSchema = z.array(generatedFlashcardSchema).min(1);

export type GeneratedFlashcard = z.infer<typeof generatedFlashcardSchema>;
