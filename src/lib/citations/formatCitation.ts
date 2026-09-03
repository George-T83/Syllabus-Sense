import type { CitationStyle, Source, SourceAuthor } from '@/types/source';

/**
 * Rule-based citation formatting for the three styles the app supports.
 * This is a practical, common-case implementation of APA 7 / MLA 9 /
 * Chicago (author-date, 17th ed.) - it covers the fields a student
 * actually tracks (see Source), not every edge case of each style guide
 * (no corporate authors, no edited-volume chapters, no multi-volume
 * works). Missing optional fields are simply omitted rather than left as
 * broken punctuation.
 */

function trimmed(value: string | undefined): string {
  return (value ?? '').trim();
}

function hasName(a: SourceAuthor): boolean {
  return trimmed(a.firstName).length > 0 || trimmed(a.lastName).length > 0;
}

function lastFirst(a: SourceAuthor): string {
  const last = trimmed(a.lastName);
  const first = trimmed(a.firstName);
  if (last && first) return `${last}, ${first}`;
  return last || first;
}

function firstLast(a: SourceAuthor): string {
  const last = trimmed(a.lastName);
  const first = trimmed(a.firstName);
  if (last && first) return `${first} ${last}`;
  return last || first;
}

function initial(first: string): string {
  const t = trimmed(first);
  return t ? `${t[0].toUpperCase()}.` : '';
}

function lastInitial(a: SourceAuthor): string {
  const last = trimmed(a.lastName);
  const init = initial(a.firstName);
  if (last && init) return `${last}, ${init}`;
  return last || init;
}

function namedAuthors(source: Pick<Source, 'authors'>): SourceAuthor[] {
  return (source.authors ?? []).filter(hasName);
}

function formatAuthorsAPA(authors: SourceAuthor[]): string {
  if (authors.length === 0) return '';
  const names = authors.map(lastInitial);
  if (names.length === 1) return names[0];
  if (names.length <= 20) {
    return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  }
  // APA 7: 21+ authors - first 19, an ellipsis, then the final author.
  return `${names.slice(0, 19).join(', ')}, ... ${names[names.length - 1]}`;
}

function formatAuthorsMLA(authors: SourceAuthor[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return lastFirst(authors[0]);
  if (authors.length === 2) return `${lastFirst(authors[0])}, and ${firstLast(authors[1])}`;
  return `${lastFirst(authors[0])}, et al.`;
}

function formatAuthorsChicago(authors: SourceAuthor[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return lastFirst(authors[0]);
  const first = lastFirst(authors[0]);
  if (authors.length <= 10) {
    const rest = authors.slice(1).map(firstLast);
    if (rest.length === 1) return `${first}, and ${rest[0]}`;
    return `${first}, ${rest.slice(0, -1).join(', ')}, and ${rest[rest.length - 1]}`;
  }
  // Chicago: 11+ authors - list the first seven, then "et al."
  const firstSeven = [first, ...authors.slice(1, 7).map(firstLast)];
  return `${firstSeven.join(', ')}, et al.`;
}

/** Joins already-punctuated segments, dropping any that are empty. */
function join(segments: (string | undefined)[]): string {
  return segments
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Appends a trailing period, unless the string already ends in one (an
 * author list ending in an initial or "et al." already does) - avoids a
 * double period like "Fischer, D..".
 */
function endSentence(s: string): string {
  return s.endsWith('.') ? s : `${s}.`;
}

function formatAPA(source: Source): string {
  const authors = formatAuthorsAPA(namedAuthors(source));
  const year = trimmed(source.year);
  const title = trimmed(source.title);

  switch (source.type) {
    case 'book':
      return join([
        authors && endSentence(authors),
        year && `(${year}).`,
        title && `${title}.`,
        trimmed(source.publisher) && `${trimmed(source.publisher)}.`,
      ]);
    case 'website':
      return join([
        authors && endSentence(authors),
        year && `(${year}).`,
        title && `${title}.`,
        trimmed(source.siteName) && `${trimmed(source.siteName)}.`,
        trimmed(source.url),
      ]);
    case 'journal': {
      const volIssue = trimmed(source.volume)
        ? `${trimmed(source.volume)}${trimmed(source.issue) ? `(${trimmed(source.issue)})` : ''}`
        : '';
      return join([
        authors && endSentence(authors),
        year && `(${year}).`,
        title && `${title}.`,
        trimmed(source.journalName) &&
          `${trimmed(source.journalName)}${volIssue ? `, ${volIssue}` : ''}${
            trimmed(source.pages) ? `, ${trimmed(source.pages)}` : ''
          }.`,
      ]);
    }
    default:
      return join([authors && endSentence(authors), year && `(${year}).`, title && `${title}.`]);
  }
}

function formatMLA(source: Source): string {
  const authors = formatAuthorsMLA(namedAuthors(source));
  const year = trimmed(source.year);
  const title = trimmed(source.title);

  switch (source.type) {
    case 'book':
      return join([
        authors && endSentence(authors),
        title && `${title}.`,
        trimmed(source.publisher) && `${trimmed(source.publisher)},`,
        year && `${year}.`,
      ]);
    case 'website':
      return join([
        authors && endSentence(authors),
        title && `"${title}."`,
        trimmed(source.siteName) && `${trimmed(source.siteName)},`,
        year && `${year},`,
        trimmed(source.url) && `${trimmed(source.url)}.`,
      ]);
    case 'journal':
      return join([
        authors && endSentence(authors),
        title && `"${title}."`,
        trimmed(source.journalName) && `${trimmed(source.journalName)},`,
        trimmed(source.volume) && `vol. ${trimmed(source.volume)},`,
        trimmed(source.issue) && `no. ${trimmed(source.issue)},`,
        year && `${year},`,
        trimmed(source.pages) && `pp. ${trimmed(source.pages)}.`,
      ]);
    default:
      return join([authors && endSentence(authors), title && `${title}.`, year && `${year}.`]);
  }
}

function formatChicago(source: Source): string {
  const authors = formatAuthorsChicago(namedAuthors(source));
  const year = trimmed(source.year);
  const title = trimmed(source.title);

  switch (source.type) {
    case 'book':
      return join([
        authors && endSentence(authors),
        year && `${year}.`,
        title && `${title}.`,
        trimmed(source.publisher) && `${trimmed(source.publisher)}.`,
      ]);
    case 'website':
      return join([
        authors && endSentence(authors),
        year && `${year}.`,
        title && `"${title}."`,
        trimmed(source.siteName) && `${trimmed(source.siteName)}.`,
        trimmed(source.url) && `${trimmed(source.url)}.`,
      ]);
    case 'journal': {
      const volIssue = trimmed(source.volume)
        ? `${trimmed(source.volume)}${trimmed(source.issue) ? ` (${trimmed(source.issue)})` : ''}`
        : '';
      return join([
        authors && endSentence(authors),
        year && `${year}.`,
        title && `"${title}."`,
        trimmed(source.journalName) &&
          `${trimmed(source.journalName)}${volIssue ? ` ${volIssue}` : ''}${
            trimmed(source.pages) ? `: ${trimmed(source.pages)}` : ''
          }.`,
      ]);
    }
    default:
      return join([authors && endSentence(authors), year && `${year}.`, title && `${title}.`]);
  }
}

export function formatCitation(source: Source, style: CitationStyle): string {
  switch (style) {
    case 'apa':
      return formatAPA(source);
    case 'mla':
      return formatMLA(source);
    case 'chicago':
      return formatChicago(source);
  }
}

/**
 * Alphabetizes sources by first author's last name (falling back to title
 * when a source has no author), matching how each supported style's
 * works-cited page sorts. Shared by the on-screen list and the copied
 * bibliography so the two never disagree on order.
 */
export function sortSources(sources: Source[]): Source[] {
  const sortKey = (s: Source): string => {
    const first = namedAuthors(s)[0];
    return (
      first ? trimmed(first.lastName) || trimmed(first.firstName) : trimmed(s.title)
    ).toLowerCase();
  };
  return sources.slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/** A copy-pasteable bibliography: every source formatted in the given style. */
export function formatBibliography(sources: Source[], style: CitationStyle): string {
  return sortSources(sources)
    .map((s) => formatCitation(s, style))
    .join('\n\n');
}
