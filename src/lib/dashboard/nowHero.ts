import { isCardDue } from '@/lib/flashcards/sm2';
import { buildWeekBriefing, type BriefingItem } from '@/lib/dashboard/weekBriefing';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';

/**
 * What the dashboard's single top call to action is about:
 * - `urgent`: something is overdue or due today - do it now.
 * - `next`: nothing is on fire, so this is what to start on.
 * - `cards`: no deadlines this week, but flashcards are due for review.
 * - `clear`: nothing to do right now.
 */
export type NowHero =
  | { kind: 'urgent'; entry: BriefingItem; others: number }
  | { kind: 'next'; entry: BriefingItem; others: number }
  | { kind: 'cards'; dueCards: number }
  | { kind: 'clear'; upcoming?: ScheduleItem };

/**
 * Picks the one thing to put first. Reuses the weekly briefing's ranking
 * (grade weight first, then due date) within each tier. Urgent work beats
 * everything: anything overdue in the last week or due today outranks a
 * bigger item due later in the week, so the hero can differ from row 1 of
 * the weekly list, which stays ordered by grade stakes alone.
 */
export function pickNowHero(
  scheduleItems: ScheduleItem[],
  courses: Course[],
  flashcards: Flashcard[],
  today: Date = new Date(),
): NowHero {
  const { ranked } = buildWeekBriefing(scheduleItems, courses, flashcards, today);

  const urgent = ranked.filter((b) => b.daysUntilDue <= 0);
  if (urgent.length > 0) {
    return { kind: 'urgent', entry: urgent[0], others: ranked.length - 1 };
  }
  if (ranked.length > 0) {
    return { kind: 'next', entry: ranked[0], others: ranked.length - 1 };
  }

  const dueCards = flashcards.filter((c) => isCardDue(c, today)).length;
  if (dueCards > 0) return { kind: 'cards', dueCards };

  const upcoming = scheduleItems
    .filter((i) => !i.completed && i.dueDate && new Date(i.dueDate).getTime() >= today.getTime())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  return { kind: 'clear', upcoming };
}
