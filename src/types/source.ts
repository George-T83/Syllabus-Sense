/**
 * A research source a student is tracking for a course, formatted into a
 * bibliography on demand. Deliberately scoped to the fields the three
 * supported citation styles actually need - not a general-purpose
 * bibliographic record.
 */
export type SourceType = 'book' | 'website' | 'journal' | 'other';

export interface SourceAuthor {
  firstName: string;
  lastName: string;
}

export interface Source {
  id: string;
  courseId: string;
  type: SourceType;
  title: string;
  authors: SourceAuthor[];
  /** Publication year, kept as free text to allow "n.d." or a range. */
  year?: string;
  /** Book only. */
  publisher?: string;
  /** Journal article only. */
  journalName?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  /** Website only. */
  siteName?: string;
  url?: string;
  /** Website only, ISO date string (YYYY-MM-DD). */
  accessedDate?: string;
  notes?: string;
}

export type CitationStyle = 'apa' | 'mla' | 'chicago';

export const CITATION_STYLE_LABEL: Record<CitationStyle, string> = {
  apa: 'APA',
  mla: 'MLA',
  chicago: 'Chicago',
};
