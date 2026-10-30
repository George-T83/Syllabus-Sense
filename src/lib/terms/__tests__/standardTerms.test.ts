import { describe, it, expect } from 'vitest';
import {
  isUsableTerm,
  standardTermDates,
  suggestTermLabel,
  termLabelKey,
  validateTermDates,
} from '../standardTerms';

describe('standardTermDates', () => {
  it('suggests a first and last day for Spring, Summer and Fall labels', () => {
    expect(standardTermDates('Fall 2026')).toEqual({
      startDate: '2026-08-24',
      endDate: '2026-12-18',
    });
    expect(standardTermDates('Spring 2027')).toEqual({
      startDate: '2027-01-12',
      endDate: '2027-05-15',
    });
    expect(standardTermDates('  summer 2026 ')).toEqual({
      startDate: '2026-05-26',
      endDate: '2026-08-14',
    });
  });

  it('has nothing to suggest for Winter or an unrecognized label', () => {
    expect(standardTermDates('Winter 2027')).toBeNull();
    expect(standardTermDates('Block 3')).toBeNull();
    expect(standardTermDates('Fall 2026 (online)')).toBeNull();
    expect(standardTermDates('')).toBeNull();
  });
});

describe('suggestTermLabel', () => {
  it('names the standard term a day falls in', () => {
    expect(suggestTermLabel('2026-01-03')).toBe('Spring 2026');
    expect(suggestTermLabel('2026-06-01')).toBe('Summer 2026');
    expect(suggestTermLabel('2026-10-27')).toBe('Fall 2026');
  });
});

describe('termLabelKey', () => {
  it('ignores case and spacing', () => {
    expect(termLabelKey('  Fall   2026 ')).toBe(termLabelKey('fall 2026'));
  });
});

describe('validateTermDates', () => {
  it('accepts a normal range', () => {
    expect(validateTermDates('2026-08-24', '2026-12-18')).toBeNull();
  });
  it('rejects blanks, impossible dates, reversed ranges and ranges over a year', () => {
    expect(validateTermDates('', '2026-12-18')).toMatch(/both/);
    expect(validateTermDates('2026-02-30', '2026-12-18')).toMatch(/both/);
    expect(validateTermDates('2026-12-18', '2026-08-24')).toMatch(/after/);
    expect(validateTermDates('2026-01-01', '2027-02-01')).toMatch(/at most/);
  });
});

describe('isUsableTerm', () => {
  it('needs a label and a valid range', () => {
    expect(
      isUsableTerm({ label: 'Fall 2026', startDate: '2026-08-24', endDate: '2026-12-18' }),
    ).toBe(true);
    expect(isUsableTerm({ label: '  ', startDate: '2026-08-24', endDate: '2026-12-18' })).toBe(
      false,
    );
    expect(isUsableTerm({ label: 'Fall 2026', startDate: '', endDate: '' })).toBe(false);
  });
});
