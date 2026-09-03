export interface PomodoroSession {
  startedAt: string;
  duration: number; // seconds
  taskId?: string;
}

export const POMODORO_SESSIONS_STORAGE_KEY = 'syllabus-sense:pomodoro-sessions';

export function loadSessions(): PomodoroSession[] {
  try {
    const raw =
      typeof window !== 'undefined' ? localStorage.getItem(POMODORO_SESSIONS_STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as PomodoroSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: PomodoroSession): void {
  try {
    const existing = loadSessions();
    localStorage.setItem(POMODORO_SESSIONS_STORAGE_KEY, JSON.stringify([...existing, session]));
  } catch {
    // Silently ignore — localStorage may be unavailable (SSR, privacy mode).
  }
}
