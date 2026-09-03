import { describe, it, expect } from 'vitest';
import { applySM2, isCardDue, SM2_DEFAULTS, type SM2State } from '../sm2';

describe('applySM2', () => {
  it('sets a 1-day interval on the first "good" review', () => {
    const result = applySM2(SM2_DEFAULTS, 'good', new Date('2026-09-03'));
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.dueDate).toBe('2026-09-04');
  });

  it('sets a 6-day interval on the second consecutive "good" review', () => {
    const first = applySM2(SM2_DEFAULTS, 'good', new Date('2026-09-03'));
    const second = applySM2(first, 'good', new Date('2026-09-04'));
    expect(second.interval).toBe(6);
    expect(second.repetitions).toBe(2);
    expect(second.dueDate).toBe('2026-09-10');
  });

  it('multiplies the interval by the ease factor from the third review onward', () => {
    const first = applySM2(SM2_DEFAULTS, 'good', new Date('2026-09-03'));
    const second = applySM2(first, 'good', new Date('2026-09-04'));
    const third = applySM2(second, 'good', new Date('2026-09-10'));
    expect(third.interval).toBe(Math.round(6 * second.easeFactor));
    expect(third.repetitions).toBe(3);
  });

  it('resets repetitions and interval to 1 day on "again" (a lapse)', () => {
    const first = applySM2(SM2_DEFAULTS, 'good', new Date('2026-09-03'));
    const second = applySM2(first, 'good', new Date('2026-09-04'));
    const lapsed = applySM2(second, 'again', new Date('2026-09-10'));
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.interval).toBe(1);
    expect(lapsed.dueDate).toBe('2026-09-11');
  });

  it('treats "hard" as a lapse too (quality below the SM-2 pass threshold)', () => {
    const result = applySM2(SM2_DEFAULTS, 'hard', new Date('2026-09-03'));
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  it('increases the ease factor on "easy" reviews', () => {
    const result = applySM2(SM2_DEFAULTS, 'easy', new Date('2026-09-03'));
    expect(result.easeFactor).toBeCloseTo(2.6);
  });

  it('keeps the ease factor unchanged on "good" reviews', () => {
    const result = applySM2(SM2_DEFAULTS, 'good', new Date('2026-09-03'));
    expect(result.easeFactor).toBeCloseTo(2.5);
  });

  it('never lets the ease factor drop below 1.3, even after repeated lapses', () => {
    let state: SM2State = SM2_DEFAULTS;
    for (let i = 0; i < 5; i++) {
      state = applySM2(state, 'again', new Date('2026-09-03'));
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('isCardDue', () => {
  it('is due when the due date is today', () => {
    expect(isCardDue({ dueDate: '2026-09-03' }, new Date('2026-09-03'))).toBe(true);
  });

  it('is due when the due date is in the past', () => {
    expect(isCardDue({ dueDate: '2026-09-01' }, new Date('2026-09-03'))).toBe(true);
  });

  it('is not due when the due date is in the future', () => {
    expect(isCardDue({ dueDate: '2026-09-10' }, new Date('2026-09-03'))).toBe(false);
  });
});
