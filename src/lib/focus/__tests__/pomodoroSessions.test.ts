import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSessions,
  saveSession,
  clearSessions,
  POMODORO_SESSIONS_STORAGE_KEY,
  sessionsKey,
} from '../pomodoroSessions';

const session = (startedAt: string) => ({ startedAt, duration: 1500 });

describe('pomodoro sessions are per account', () => {
  beforeEach(() => localStorage.clear());

  it("keeps one student's sessions out of another's streak", () => {
    saveSession('alice', session('2026-10-01T10:00:00Z'));
    expect(loadSessions('alice')).toHaveLength(1);
    expect(loadSessions('bob')).toEqual([]);
  });

  it('records nothing and shows nothing when nobody is signed in', () => {
    saveSession(undefined, session('2026-10-01T10:00:00Z'));
    expect(loadSessions(undefined)).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('hands sessions saved before scoping to the first account only, once', () => {
    localStorage.setItem(
      POMODORO_SESSIONS_STORAGE_KEY,
      JSON.stringify([session('2026-09-30T10:00:00Z')]),
    );
    expect(loadSessions('alice')).toHaveLength(1);
    expect(localStorage.getItem(POMODORO_SESSIONS_STORAGE_KEY)).toBeNull();
    expect(loadSessions('bob')).toEqual([]);
  });

  it("removes an account's sessions when asked", () => {
    saveSession('alice', session('2026-10-01T10:00:00Z'));
    clearSessions('alice');
    expect(localStorage.getItem(sessionsKey('alice'))).toBeNull();
    expect(loadSessions('alice')).toEqual([]);
  });

  it('survives corrupt stored data', () => {
    localStorage.setItem(sessionsKey('alice'), '{not json');
    expect(loadSessions('alice')).toEqual([]);
  });
});
