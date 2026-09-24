import { describe, it, expect } from 'vitest';
import { summarizeConfirmations } from '../confirmationSummary';

describe('summarizeConfirmations', () => {
  it('returns an empty array for no confirmations', () => {
    expect(summarizeConfirmations([])).toEqual([]);
  });

  it('groups confirmations by date and counts them', () => {
    const result = summarizeConfirmations([
      { date: '2026-10-14', displayName: 'Alice' },
      { date: '2026-10-14', displayName: 'Bob' },
      { date: '2026-10-21', displayName: 'Carol' },
    ]);

    expect(result).toEqual([
      { date: '2026-10-14', count: 2, displayNames: ['Alice', 'Bob'] },
      { date: '2026-10-21', count: 1, displayNames: ['Carol'] },
    ]);
  });

  it('sorts by descending count first', () => {
    const result = summarizeConfirmations([
      { date: '2026-10-21', displayName: 'Carol' },
      { date: '2026-10-14', displayName: 'Alice' },
      { date: '2026-10-14', displayName: 'Bob' },
    ]);
    expect(result[0].date).toBe('2026-10-14');
    expect(result[0].count).toBe(2);
  });

  it('breaks a count tie by earliest date', () => {
    const result = summarizeConfirmations([
      { date: '2026-10-21', displayName: 'Carol' },
      { date: '2026-10-14', displayName: 'Alice' },
    ]);
    expect(result.map((r) => r.date)).toEqual(['2026-10-14', '2026-10-21']);
  });
});
