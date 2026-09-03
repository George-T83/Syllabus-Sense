import { z } from 'zod';

/** Builds a schema requiring exactly `days` topic strings - the day count is
 * only known at request time (it depends on how far away the exam is), so
 * this can't be a single static schema the way flashcards/quiz schemas are. */
export function generatedCramPlanSchema(days: number) {
  return z.array(z.string().min(1)).length(days);
}
