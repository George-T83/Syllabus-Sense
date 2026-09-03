import { describe, it, expect } from 'vitest';
import { formatCitation, formatBibliography, sortSources } from '../formatCitation';
import type { Source } from '@/types/source';

function makeSource(overrides: Partial<Source>): Source {
  return {
    id: 's1',
    courseId: 'c1',
    type: 'book',
    title: 'Historians’ Fallacies',
    authors: [{ firstName: 'David', lastName: 'Fischer' }],
    year: '1970',
    publisher: 'Harper & Row',
    ...overrides,
  };
}

describe('formatCitation', () => {
  it('formats a single-author book in APA', () => {
    const source = makeSource({});
    expect(formatCitation(source, 'apa')).toBe(
      'Fischer, D. (1970). Historians’ Fallacies. Harper & Row.',
    );
  });

  it('formats a single-author book in MLA', () => {
    const source = makeSource({});
    expect(formatCitation(source, 'mla')).toBe(
      'Fischer, David. Historians’ Fallacies. Harper & Row, 1970.',
    );
  });

  it('formats a single-author book in Chicago', () => {
    const source = makeSource({});
    expect(formatCitation(source, 'chicago')).toBe(
      'Fischer, David. 1970. Historians’ Fallacies. Harper & Row.',
    );
  });

  it('joins two authors with an ampersand in APA', () => {
    const source = makeSource({
      authors: [
        { firstName: 'David', lastName: 'Fischer' },
        { firstName: 'Jane', lastName: 'Carr' },
      ],
    });
    expect(formatCitation(source, 'apa')).toBe(
      'Fischer, D., & Carr, J. (1970). Historians’ Fallacies. Harper & Row.',
    );
  });

  it('collapses three or more authors to "et al." in MLA', () => {
    const source = makeSource({
      authors: [
        { firstName: 'David', lastName: 'Fischer' },
        { firstName: 'Jane', lastName: 'Carr' },
        { firstName: 'John', lastName: 'Tuchman' },
      ],
    });
    expect(formatCitation(source, 'mla')).toBe(
      'Fischer, David, et al. Historians’ Fallacies. Harper & Row, 1970.',
    );
  });

  it('lists three authors with an Oxford comma and "and" in Chicago', () => {
    const source = makeSource({
      authors: [
        { firstName: 'David', lastName: 'Fischer' },
        { firstName: 'Jane', lastName: 'Carr' },
        { firstName: 'John', lastName: 'Tuchman' },
      ],
    });
    expect(formatCitation(source, 'chicago')).toBe(
      'Fischer, David, Jane Carr, and John Tuchman. 1970. Historians’ Fallacies. Harper & Row.',
    );
  });

  it('formats a website with a URL in APA', () => {
    const source = makeSource({
      type: 'website',
      title: 'Understanding Historiography',
      siteName: 'JSTOR Daily',
      url: 'https://daily.jstor.org/example',
      publisher: undefined,
    });
    expect(formatCitation(source, 'apa')).toBe(
      'Fischer, D. (1970). Understanding Historiography. JSTOR Daily. https://daily.jstor.org/example',
    );
  });

  it('quotes the title and uses "pp." for a journal article in MLA', () => {
    const source = makeSource({
      type: 'journal',
      title: 'The Braided Narrative',
      journalName: 'Journal of American History',
      volume: '58',
      issue: '2',
      pages: '210-234',
      publisher: undefined,
    });
    expect(formatCitation(source, 'mla')).toBe(
      'Fischer, David. "The Braided Narrative." Journal of American History, vol. 58, no. 2, 1970, pp. 210-234.',
    );
  });

  it('formats a journal article with volume(issue): pages in Chicago', () => {
    const source = makeSource({
      type: 'journal',
      title: 'The Braided Narrative',
      journalName: 'Journal of American History',
      volume: '58',
      issue: '2',
      pages: '210-234',
      publisher: undefined,
    });
    expect(formatCitation(source, 'chicago')).toBe(
      'Fischer, David. 1970. "The Braided Narrative." Journal of American History 58 (2): 210-234.',
    );
  });

  it('omits missing optional fields instead of leaving stray punctuation', () => {
    const source = makeSource({ year: undefined, publisher: undefined });
    expect(formatCitation(source, 'apa')).toBe('Fischer, D. Historians’ Fallacies.');
  });

  it('falls back to the title when a source has no author', () => {
    const source = makeSource({ authors: [] });
    expect(formatCitation(source, 'apa')).toBe('(1970). Historians’ Fallacies. Harper & Row.');
  });
});

describe('sortSources', () => {
  it('matches the order formatBibliography uses, so the on-screen list and the copied text agree', () => {
    const sources: Source[] = [
      makeSource({ id: 's1', authors: [{ firstName: 'Jane', lastName: 'Tuchman' }] }),
      makeSource({ id: 's2', authors: [{ firstName: 'Ada', lastName: 'Carr' }] }),
    ];
    expect(sortSources(sources).map((s) => s.id)).toEqual(['s2', 's1']);
  });
});

describe('formatBibliography', () => {
  it('sorts sources alphabetically by first author last name', () => {
    const sources: Source[] = [
      makeSource({ id: 's1', authors: [{ firstName: 'Jane', lastName: 'Tuchman' }] }),
      makeSource({ id: 's2', authors: [{ firstName: 'Ada', lastName: 'Carr' }] }),
    ];
    const bibliography = formatBibliography(sources, 'apa');
    const carrIndex = bibliography.indexOf('Carr');
    const tuchmanIndex = bibliography.indexOf('Tuchman');
    expect(carrIndex).toBeGreaterThanOrEqual(0);
    expect(tuchmanIndex).toBeGreaterThan(carrIndex);
  });

  it('separates entries with a blank line', () => {
    const sources: Source[] = [
      makeSource({ id: 's1', title: 'First Work' }),
      makeSource({
        id: 's2',
        title: 'Second Work',
        authors: [{ firstName: 'Zed', lastName: 'Zephyr' }],
      }),
    ];
    expect(formatBibliography(sources, 'apa').split('\n\n')).toHaveLength(2);
  });
});
