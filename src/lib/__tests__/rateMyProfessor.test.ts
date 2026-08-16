import { describe, it, expect } from 'vitest';
import { generateRateMyProfessorUrl } from '@/lib/export/rateMyProfessor';

describe('generateRateMyProfessorUrl', () => {
  it('builds a search URL with the instructor name as the query', () => {
    const url = generateRateMyProfessorUrl('Jane Smith');
    const parsed = new URL(url as string);

    expect(parsed.origin + parsed.pathname).toBe(
      'https://www.ratemyprofessors.com/search/professors',
    );
    expect(parsed.searchParams.get('q')).toBe('Jane Smith');
  });

  it('encodes special characters and spaces in the instructor name', () => {
    const url = generateRateMyProfessorUrl("Dr. O'Malley & Smith, Jr.") as string;
    expect(url).not.toContain(' '); // raw spaces must be encoded
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q')).toBe("Dr. O'Malley & Smith, Jr.");
  });

  it('trims surrounding whitespace before searching', () => {
    const url = generateRateMyProfessorUrl('  Jane Smith  ') as string;
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q')).toBe('Jane Smith');
  });

  it('returns undefined for a missing instructor name', () => {
    expect(generateRateMyProfessorUrl(undefined)).toBeUndefined();
  });

  it('returns undefined for a blank/whitespace-only instructor name', () => {
    expect(generateRateMyProfessorUrl('   ')).toBeUndefined();
  });
});
