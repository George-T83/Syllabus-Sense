/**
 * RateMyProfessors lookup URL generator.
 *
 * We deliberately generate a *search* URL rather than a direct profile URL:
 * RMP profile URLs are keyed by an internal numeric professor ID that isn't
 * derivable from a name, and guessing/fabricating one would silently link
 * to the wrong professor (or a 404). A search results page is always
 * correct and lets the user pick the right match themselves.
 */

/**
 * Builds a RateMyProfessors search URL for the given instructor name.
 * Returns `undefined` when there's no usable name to search for, so
 * callers can skip rendering a link entirely rather than linking to an
 * empty search.
 */
export function generateRateMyProfessorUrl(instructorName: string | undefined): string | undefined {
  const trimmed = instructorName?.trim();
  if (!trimmed) return undefined;

  const params = new URLSearchParams({ q: trimmed });
  return `https://www.ratemyprofessors.com/search/professors?${params.toString()}`;
}
