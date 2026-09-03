import { describe, it, expect } from 'vitest';
import { getSessionDateSet, computeCurrentStreak, computeHeatmapDays } from '../studyStreak';
import type { PomodoroSession } from '../pomodoroSessions';

function session(dateKey: string): PomodoroSession {
  return { startedAt: `${dateKey}T14:30:00.000Z`, duration: 1500 };
}

describe('getSessionDateSet', () => {
  it('collapses multiple sessions on the same day to one entry', () => {
    const sessions = [session('2026-09-01'), session('2026-09-01'), session('2026-09-02')];
    const set = getSessionDateSet(sessions);
    expect(set.size).toBe(2);
    expect(set.has('2026-09-01')).toBe(true);
    expect(set.has('2026-09-02')).toBe(true);
  });

  it('returns an empty set for no sessions', () => {
    expect(getSessionDateSet([]).size).toBe(0);
  });
});

describe('computeCurrentStreak', () => {
  it('counts consecutive days ending today', () => {
    const dateSet = new Set(['2026-09-01', '2026-09-02', '2026-09-03']);
    const today = new Date(2026, 8, 3); // Sep 3 2026, local
    expect(computeCurrentStreak(dateSet, today)).toBe(3);
  });

  it('does not reset the streak just because today has no session yet', () => {
    const dateSet = new Set(['2026-09-01', '2026-09-02']);
    const today = new Date(2026, 8, 3); // today itself has no session
    expect(computeCurrentStreak(dateSet, today)).toBe(2);
  });

  it('stops counting at the first gap', () => {
    const dateSet = new Set(['2026-08-28', '2026-09-01', '2026-09-02', '2026-09-03']);
    const today = new Date(2026, 8, 3);
    // Aug 30/31 are missing, so the streak only reaches back to Sep 1
    expect(computeCurrentStreak(dateSet, today)).toBe(3);
  });

  it('returns 0 when there is no session today or yesterday', () => {
    const dateSet = new Set(['2026-08-20']);
    const today = new Date(2026, 8, 3);
    expect(computeCurrentStreak(dateSet, today)).toBe(0);
  });

  it('returns 0 for an empty history', () => {
    expect(computeCurrentStreak(new Set(), new Date(2026, 8, 3))).toBe(0);
  });
});

describe('computeHeatmapDays', () => {
  it('returns the requested number of days, oldest first, ending today', () => {
    const dateSet = new Set(['2026-09-03']);
    const today = new Date(2026, 8, 3);
    const days = computeHeatmapDays(dateSet, today, 5);
    expect(days).toHaveLength(5);
    expect(days.map((d) => d.dateKey)).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
    expect(days[days.length - 1].isToday).toBe(true);
    expect(days[days.length - 1].active).toBe(true);
    expect(days[0].active).toBe(false);
  });

  it('marks only days present in the date set as active', () => {
    const dateSet = new Set(['2026-09-01', '2026-09-03']);
    const today = new Date(2026, 8, 3);
    const days = computeHeatmapDays(dateSet, today, 3);
    expect(days.map((d) => d.active)).toEqual([true, false, true]);
  });
});
