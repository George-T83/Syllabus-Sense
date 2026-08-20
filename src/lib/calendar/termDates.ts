/**
 * Courses only carry a free-text `term` label (e.g. "Fall 2026"), not real
 * start/end dates (#101 will add those). Until then, recurring class
 * meetings have no way to know they shouldn't render outside their own
 * term's actual months - a Spring course's MWF pattern kept showing up on
 * every single month of the calendar, including the following August.
 *
 * This parses the common season keywords out of the label and returns an
 * approximate date range for that season, with a couple weeks of slop on
 * each side so a real meeting near a term boundary doesn't get cut off.
 * Unparseable/absent terms return null, and callers should treat that as
 * "no bound available" (render as before) rather than "never show".
 */
export function estimateTermRange(term: string | undefined): { start: Date; end: Date } | null {
  if (!term) return null;
  const yearMatch = /\b(20\d{2})\b/.exec(term);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);
  const lower = term.toLowerCase();

  if (lower.includes('spring')) {
    return { start: new Date(year, 0, 1), end: new Date(year, 4, 31) };
  }
  if (lower.includes('summer')) {
    return { start: new Date(year, 4, 15), end: new Date(year, 7, 31) };
  }
  if (lower.includes('winter')) {
    return { start: new Date(year, 10, 15), end: new Date(year + 1, 1, 15) };
  }
  if (lower.includes('fall') || lower.includes('autumn')) {
    return { start: new Date(year, 7, 1), end: new Date(year, 11, 31) };
  }
  return null;
}

/** Whether `day` falls within `term`'s estimated range - courses with an
 * unparseable/absent term always pass, since there's no bound to check. */
export function isWithinEstimatedTerm(term: string | undefined, day: Date): boolean {
  const range = estimateTermRange(term);
  if (!range) return true;
  return day >= range.start && day <= range.end;
}
