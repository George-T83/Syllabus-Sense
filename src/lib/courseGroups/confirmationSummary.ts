export interface ConfirmationTally {
  date: string;
  count: number;
  displayNames: string[];
}

/** Groups a checkpoint's confirmations by date into the "3 people confirmed
 * Oct 14" summary shown next to it - most-confirmed date first, ties broken
 * by earliest date so a genuine split doesn't jump around between renders. */
export function summarizeConfirmations(
  confirmations: { date: string; displayName: string }[],
): ConfirmationTally[] {
  const byDate = new Map<string, string[]>();
  for (const confirmation of confirmations) {
    const names = byDate.get(confirmation.date) ?? [];
    names.push(confirmation.displayName);
    byDate.set(confirmation.date, names);
  }

  return Array.from(byDate.entries())
    .map(([date, displayNames]) => ({ date, count: displayNames.length, displayNames }))
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));
}
