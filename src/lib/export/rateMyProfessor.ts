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
 * Strips academic titles, honorifics, and single middle initials from an
 * instructor name so the RMP search query is as clean as possible.
 *
 * Examples:
 *   "Dr. Ada Lovelace"    → "Ada Lovelace"
 *   "Prof. John A. Smith" → "John Smith"
 *   "Professor Jane Doe"  → "Jane Doe"
 *   "Instructor Kim Lee"  → "Kim Lee"
 *   "O'Malley, Patrick"   → "O'Malley, Patrick"  (unchanged — comma-last format is left as-is)
 */
export function normalizeInstructorName(name: string): string {
  // Remove leading titles (case-insensitive, whole-word match)
  const titlePattern = /^(dr\.?|prof\.?|professor|instructor)\s+/i;
  let normalized = name.trim().replace(titlePattern, '').trim();

  // Remove single middle initials: a lone capital letter followed by a period
  // and a space, but only when sandwiched between two multi-character words
  // to avoid stripping meaningful abbreviations.
  normalized = normalized.replace(/\b([A-Z])\.\s+(?=[A-Z][a-z])/g, '');

  return normalized.trim();
}

/**
 * Builds a RateMyProfessors search URL for the given instructor name.
 * Returns `undefined` when there's no usable name to search for, so
 * callers can skip rendering a link entirely rather than linking to an
 * empty search.
 */
export function generateRateMyProfessorUrl(instructorName: string | undefined): string | undefined {
  const trimmed = instructorName?.trim();
  if (!trimmed) return undefined;

  const normalized = normalizeInstructorName(trimmed);
  const params = new URLSearchParams({ q: normalized });
  return `https://www.ratemyprofessors.com/search/professors?${params.toString()}`;
}
