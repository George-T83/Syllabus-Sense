import { describe, it, expect } from 'vitest';
import {
  calibrate,
  recordReview,
  flowLevel,
  calibrationPct,
  isRecalled,
  EMPTY_STATS,
} from '../session';

describe('session scoring', () => {
  it('only counts Good and Easy as a recall, matching SM-2', () => {
    expect(isRecalled('again')).toBe(false);
    expect(isRecalled('hard')).toBe(false);
    expect(isRecalled('good')).toBe(true);
    expect(isRecalled('easy')).toBe(true);
  });

  it('calibrates confident and unsure calls against the outcome', () => {
    expect(calibrate('know', 'good')).toBe('called-it');
    expect(calibrate('know', 'again')).toBe('overconfident');
    expect(calibrate('unsure', 'easy')).toBe('underconfident');
    expect(calibrate('unsure', 'hard')).toBe('honest-miss');
    expect(calibrate('think', 'good')).toBe('neutral');
    expect(calibrate(null, 'again')).toBe('neutral');
  });

  it('builds a combo on recalls, resets it on a lapse, and keeps the best run', () => {
    let s = EMPTY_STATS;
    s = recordReview(s, null, 'good').stats;
    s = recordReview(s, null, 'easy').stats;
    s = recordReview(s, null, 'good').stats;
    expect(s.combo).toBe(3);
    s = recordReview(s, null, 'hard').stats;
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(3);
    expect(s.reviewed).toBe(4);
    expect(s.recalled).toBe(3);
  });

  it('scores recalls with a growing combo bonus and rewards calibrated calls', () => {
    const first = recordReview(EMPTY_STATS, null, 'good');
    expect(first.pointsEarned).toBe(10);
    const second = recordReview(first.stats, 'know', 'good');
    expect(second.outcome).toBe('called-it');
    expect(second.pointsEarned).toBe(10 + 2 + 15);
    const honest = recordReview(second.stats, 'unsure', 'again');
    expect(honest.pointsEarned).toBe(5);
    expect(honest.stats.points).toBe(10 + 27 + 5);
  });

  it('tracks calibration only over Know-it and No-idea calls', () => {
    let s = EMPTY_STATS;
    expect(calibrationPct(s)).toBeNull();
    s = recordReview(s, 'know', 'good').stats;
    s = recordReview(s, 'know', 'again').stats;
    s = recordReview(s, 'unsure', 'again').stats;
    s = recordReview(s, 'think', 'good').stats;
    expect(s.calls).toBe(3);
    expect(s.callsRight).toBe(2);
    expect(calibrationPct(s)).toBeCloseTo(2 / 3);
  });

  it('maps combo to a 0-1 flow level that caps at an 8-card run', () => {
    expect(flowLevel(0)).toBe(0);
    expect(flowLevel(4)).toBe(0.5);
    expect(flowLevel(20)).toBe(1);
  });
});
