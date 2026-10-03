export interface PomodoroSession {
  startedAt: string;
  duration: number; // seconds
  taskId?: string;
}

/** Before sessions were scoped to a user, they all lived under this one key. */
export const POMODORO_SESSIONS_STORAGE_KEY = 'syllabus-sense:pomodoro-sessions';

/**
 * Sessions are per account. One shared key meant a second student on the same
 * browser inherited the first student's streak, and a deleted account's
 * sessions outlived the account.
 */
export function sessionsKey(userId: string): string {
  return `${POMODORO_SESSIONS_STORAGE_KEY}:${userId}`;
}

function read(key: string): PomodoroSession[] | null {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as PomodoroSession[]) : null;
}

export function loadSessions(userId: string | undefined): PomodoroSession[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const own = read(sessionsKey(userId));
    if (own) return own;
    // One-time migration: sessions saved before scoping have no owner. The
    // first account to open the app afterwards adopts them, which is right
    // for the usual one-student browser, and they are then removed so no
    // later account can inherit them.
    const legacy = read(POMODORO_SESSIONS_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(sessionsKey(userId), JSON.stringify(legacy));
      localStorage.removeItem(POMODORO_SESSIONS_STORAGE_KEY);
      return legacy;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveSession(userId: string | undefined, session: PomodoroSession): void {
  if (!userId) return;
  try {
    const existing = loadSessions(userId);
    localStorage.setItem(sessionsKey(userId), JSON.stringify([...existing, session]));
  } catch {
    // Silently ignore — localStorage may be unavailable (SSR, privacy mode).
  }
}

export function clearSessions(userId: string): void {
  try {
    localStorage.removeItem(sessionsKey(userId));
  } catch {
    // localStorage may be unavailable.
  }
}
