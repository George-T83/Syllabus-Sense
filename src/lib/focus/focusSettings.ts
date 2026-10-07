/**
 * How the focus timer is set up on this device: how long a focus stretch and
 * a break last, and whether the page dims while a session runs. Per device,
 * like the theme, so it lives in localStorage rather than the account.
 */
export interface FocusSettings {
  /** Length of a focus stretch, in minutes. */
  workMinutes: number;
  /** Length of a break, in minutes. */
  breakMinutes: number;
  /** Hide the rest of the page while a focus session runs. */
  dimPage: boolean;
}

export const FOCUS_SETTINGS_KEY = 'syllabus-sense-focus-settings';

export const WORK_MINUTE_OPTIONS = [15, 25, 45, 60] as const;
export const BREAK_MINUTE_OPTIONS = [5, 10, 15] as const;

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  workMinutes: 25,
  breakMinutes: 5,
  dimPage: true,
};

/** The "just 5 minutes" start: a session short enough to begin without
 * deciding anything. */
export const SPRINT_SECONDS = 5 * 60;

/** A stopped session counts toward the streak once this much of it was
 * spent focusing. Shorter than that is a false start, not a session. */
export const MIN_CREDIT_SECONDS = 5 * 60;

const isOption = (options: readonly number[], v: unknown): v is number =>
  typeof v === 'number' && options.includes(v);

export function readFocusSettings(): FocusSettings {
  try {
    const raw = window.localStorage.getItem(FOCUS_SETTINGS_KEY);
    if (!raw) return DEFAULT_FOCUS_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<FocusSettings>;
    return {
      workMinutes: isOption(WORK_MINUTE_OPTIONS, parsed.workMinutes)
        ? parsed.workMinutes
        : DEFAULT_FOCUS_SETTINGS.workMinutes,
      breakMinutes: isOption(BREAK_MINUTE_OPTIONS, parsed.breakMinutes)
        ? parsed.breakMinutes
        : DEFAULT_FOCUS_SETTINGS.breakMinutes,
      dimPage:
        typeof parsed.dimPage === 'boolean' ? parsed.dimPage : DEFAULT_FOCUS_SETTINGS.dimPage,
    };
  } catch {
    return DEFAULT_FOCUS_SETTINGS;
  }
}

export function writeFocusSettings(settings: FocusSettings): void {
  try {
    window.localStorage.setItem(FOCUS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing: the choice still applies for this page view.
  }
}

/**
 * How many seconds of a stopped session to credit, or 0 when it was too short
 * to count. `plannedSeconds` is the session's length, `remainingSeconds` what
 * was left on the clock when it stopped.
 */
export function creditedSeconds(plannedSeconds: number, remainingSeconds: number): number {
  const elapsed = Math.max(0, Math.min(plannedSeconds, plannedSeconds - remainingSeconds));
  return elapsed >= MIN_CREDIT_SECONDS ? elapsed : 0;
}
