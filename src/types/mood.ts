/**
 * A 1-4 daily mood scale, matching the four faces on the check-in button row
 * (rough / okay / good / great). Deliberately the same width as
 * WorkloadLevel (low/medium/high/critical) so a mood value and a workload
 * level can sit on the same visual scale when correlating the two.
 */
export type MoodValue = 1 | 2 | 3 | 4;

/**
 * One check-in per calendar day - `id` is the day key itself (YYYY-MM-DD),
 * so re-tapping the same day overwrites rather than accumulating duplicate
 * entries.
 */
export interface MoodEntry {
  id: string;
  dateKey: string;
  mood: MoodValue;
  createdAt: string;
}
