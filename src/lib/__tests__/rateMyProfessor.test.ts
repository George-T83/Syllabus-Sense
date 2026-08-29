import { describe, it, expect } from 'vitest';
import { generateRateMyProfessorUrl, normalizeInstructorName } from '@/lib/export/rateMyProfessor';

describe('normalizeInstructorName', () => {
  it('strips "Dr." prefix', () => {
    expect(normalizeInstructorName('Dr. Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('strips "Prof." prefix', () => {
    expect(normalizeInstructorName('Prof. John Smith')).toBe('John Smith');
  });

  it('strips "Professor" prefix', () => {
    expect(normalizeInstructorName('Professor Jane Doe')).toBe('Jane Doe');
  });

  it('strips "Instructor" prefix', () => {
    expect(normalizeInstructorName('Instructor Kim Lee')).toBe('Kim Lee');
  });

  it('strips middle initials between first and last name', () => {
    expect(normalizeInstructorName('John A. Smith')).toBe('John Smith');
  });

  it('strips title AND middle initial together', () => {
    expect(normalizeInstructorName('Prof. John A. Smith')).toBe('John Smith');
  });

  it('leaves names without titles unchanged', () => {
    expect(normalizeInstructorName('Jane Smith')).toBe('Jane Smith');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeInstructorName('  Dr. Ada Lovelace  ')).toBe('Ada Lovelace');
  });
});

describe('generateRateMyProfessorUrl', () => {
  it('normalizes title before building search URL', () => {
    const url = generateRateMyProfessorUrl('Dr. Ada Lovelace');
    const parsed = new URL(url as string);
    expect(parsed.searchParams.get('q')).toBe('Ada Lovelace');
  });

  it('builds a search URL with the instructor name as the query', () => {
    const url = generateRateMyProfessorUrl('Jane Smith');
    const parsed = new URL(url as string);

    expect(parsed.origin + parsed.pathname).toBe(
      'https://www.ratemyprofessors.com/search/professors',
    );
    expect(parsed.searchParams.get('q')).toBe('Jane Smith');
  });

  it('encodes special characters and spaces in the instructor name', () => {
    const url = generateRateMyProfessorUrl("O'Malley Smith") as string;
    expect(url).not.toContain(' '); // raw spaces must be encoded
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q')).toBe("O'Malley Smith");
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
