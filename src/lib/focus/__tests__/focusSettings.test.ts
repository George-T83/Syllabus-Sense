import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_FOCUS_SETTINGS,
  FOCUS_SETTINGS_KEY,
  MIN_CREDIT_SECONDS,
  creditedSeconds,
  readFocusSettings,
  writeFocusSettings,
} from '../focusSettings';

beforeEach(() => window.localStorage.clear());

describe('focus settings storage', () => {
  it('defaults to 25 / 5 with the page hidden while focusing', () => {
    expect(readFocusSettings()).toEqual({ workMinutes: 25, breakMinutes: 5, dimPage: true });
  });

  it('round-trips a saved choice', () => {
    writeFocusSettings({ workMinutes: 45, breakMinutes: 10, dimPage: false });
    expect(readFocusSettings()).toEqual({ workMinutes: 45, breakMinutes: 10, dimPage: false });
  });

  it('falls back field by field when a stored value is not one of the options', () => {
    window.localStorage.setItem(
      FOCUS_SETTINGS_KEY,
      JSON.stringify({ workMinutes: 7, breakMinutes: 10, dimPage: 'yes' }),
    );
    expect(readFocusSettings()).toEqual({
      workMinutes: DEFAULT_FOCUS_SETTINGS.workMinutes,
      breakMinutes: 10,
      dimPage: true,
    });
  });

  it('survives corrupt storage', () => {
    window.localStorage.setItem(FOCUS_SETTINGS_KEY, '{not json');
    expect(readFocusSettings()).toEqual(DEFAULT_FOCUS_SETTINGS);
  });
});

describe('creditedSeconds', () => {
  const planned = 25 * 60;

  it('credits the time actually spent once it is at least five minutes', () => {
    expect(creditedSeconds(planned, planned - 12 * 60)).toBe(12 * 60);
    expect(creditedSeconds(planned, planned - MIN_CREDIT_SECONDS)).toBe(MIN_CREDIT_SECONDS);
  });

  it('credits nothing for a false start', () => {
    expect(creditedSeconds(planned, planned - 4 * 60)).toBe(0);
    expect(creditedSeconds(planned, planned)).toBe(0);
  });

  it('never credits more than the session was meant to last', () => {
    expect(creditedSeconds(planned, -30)).toBe(planned);
  });
});
