import { describe, it, expect } from 'vitest';
import { enumerateDays, MAX_ENUMERATED_DAYS } from '../dateUtils';

describe('enumerateDays', () => {
  it('lists every day inclusive of both ends', () => {
    const days = enumerateDays(new Date(Date.UTC(2026, 8, 1)), new Date(Date.UTC(2026, 8, 3)));
    expect(days.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
  });

  it('caps the run for a far-future end date', () => {
    const days = enumerateDays(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(9999, 11, 31)));
    expect(days).toHaveLength(MAX_ENUMERATED_DAYS);
  });
});
