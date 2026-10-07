'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FloatingActionPill } from '@/components/ui/FloatingActionPill';
import { saveSession } from '@/lib/focus/pomodoroSessions';
import { RingGauge } from '@/components/ui/RingGauge';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { usePlatform } from '@/hooks/usePlatformKey';
import { matchesShortcut } from '@/lib/shortcuts';
import {
  BREAK_MINUTE_OPTIONS,
  DEFAULT_FOCUS_SETTINGS,
  SPRINT_SECONDS,
  WORK_MINUTE_OPTIONS,
  creditedSeconds,
  readFocusSettings,
  writeFocusSettings,
  type FocusSettings,
} from '@/lib/focus/focusSettings';
import { usePillHidden } from '@/hooks/useDisplayPrefs';

/** Plays a brief 880 Hz beep using the Web Audio API to signal a timer end. */
function playBeep(): void {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  } catch {
    // Web Audio API may not be available in all environments.
  }
}

/** MM:SS under an hour, H:MM:SS from an hour on - the ring is sized to fit
 * the H:MM:SS case from the start so a longer future duration never needs
 * another resize. */
export function formatTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  const m = totalMinutes.toString().padStart(2, '0');
  return `${m}:${s}`;
}

export interface PomodoroTimerProps {
  /** Optional task ID to associate sessions with a specific task. */
  taskId?: string;
  /** Bump this (e.g. a counter) to force the widget open from outside -
   * the CommandPalette's "Start Pomodoro Focus Timer" action has no other
   * way to reach this component's local `visible` state. */
  openSignal?: number;
}

/**
 * Pomodoro Focus Timer (Item 41)
 *
 * A fixed-bottom-right floating widget that toggles via a keyboard shortcut
 * (Alt+P) or an external trigger. Implements the Pomodoro Technique with
 * 25-minute work sessions and 5-minute breaks. Persists session history to
 * localStorage for later analysis.
 */
export function PomodoroTimer({ taskId, openSignal }: PomodoroTimerProps = {}) {
  const { state } = useAppState();
  const focusedTask = taskId ? state.scheduleItems.find((i) => i.id === taskId) : undefined;
  const [settings, setSettings] = useState<FocusSettings>(DEFAULT_FOCUS_SETTINGS);
  const [visible, setVisible] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  // Whether the dimmed, page-hiding view is up. Escape or "Show page" drops
  // back to the small panel without stopping the clock.
  const [focusView, setFocusView] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  // How long the current focus stretch is meant to last: the chosen length, or
  // five minutes for a "just 5 minutes" start.
  const [plannedWork, setPlannedWork] = useState(DEFAULT_FOCUS_SETTINGS.workMinutes * 60);
  const [remaining, setRemaining] = useState(DEFAULT_FOCUS_SETTINGS.workMinutes * 60);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const sessionStartRef = useRef<Date | null>(null);
  // The clock is read from this wall-clock end time, not counted down by
  // interval ticks: a background tab throttles timers, and a focus timer in
  // another tab is the usual case.
  const endAtRef = useRef<number | null>(null);
  const breakSeconds = settings.breakMinutes * 60;

  // Per-device settings, read after mount so the server and first client
  // render agree.
  useEffect(() => {
    setSettings(readFocusSettings());
  }, []);

  // A new length applies straight away while nothing has started.
  useEffect(() => {
    if (running || sessionStartRef.current) return;
    if (isBreak) {
      setRemaining(settings.breakMinutes * 60);
    } else {
      setPlannedWork(settings.workMinutes * 60);
      setRemaining(settings.workMinutes * 60);
    }
    // Only a change to the settings should do this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const updateSettings = (patch: Partial<FocusSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeFocusSettings(next);
  };

  // External open trigger (CommandPalette's "Start Pomodoro" action) - opens
  // only when the signal actually changes value, not on every effect run.
  // A "skip the first run" ref is not enough here: React Strict Mode's dev-
  // only double-invoke of effects re-fires this effect once immediately
  // after mount with the ref already flipped, which read `openSignal={0}`
  // (always defined, never `undefined`) as a real trigger and force-opened
  // the widget on every page load. Comparing against the previous value
  // instead only opens on a genuine increment, which a duplicate effect run
  // with an unchanged value can't produce.
  const previousOpenSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== undefined && openSignal !== previousOpenSignal.current) {
      setVisible(true);
    }
    previousOpenSignal.current = openSignal;
  }, [openSignal]);

  // Alt+P keyboard shortcut to toggle the widget
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (matchesShortcut(e, 'timer')) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const { user } = useAuth();
  const { alt } = usePlatform();
  const [pillHidden, setPillHidden] = usePillHidden('focus');
  const userId = user?.uid;

  const creditSession = useCallback(
    (seconds: number) => {
      if (seconds <= 0 || !sessionStartRef.current) return;
      saveSession(userId, {
        startedAt: sessionStartRef.current.toISOString(),
        duration: seconds,
        taskId,
      });
      setSessionCount((c) => c + 1);
    },
    [taskId, userId],
  );

  // Read the clock once a second while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (endAtRef.current === null) return;
      setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // The clock ran out: sound, record a finished focus stretch, and move on.
  useEffect(() => {
    if (!running || remaining > 0) return;
    playBeep();
    setRunning(false);
    endAtRef.current = null;
    if (!isBreak) creditSession(plannedWork);
    sessionStartRef.current = null;
    setFocusView(false);
    setPlannedWork(settings.workMinutes * 60);
    setIsBreak(!isBreak);
    setRemaining(isBreak ? settings.workMinutes * 60 : breakSeconds);
  }, [running, remaining, isBreak, plannedWork, creditSession, settings.workMinutes, breakSeconds]);

  const begin = (workSeconds?: number) => {
    // Resuming keeps the original start time; a fresh focus stretch gets one.
    if (!isBreak && !sessionStartRef.current) sessionStartRef.current = new Date();
    let left = remaining;
    if (workSeconds !== undefined && !isBreak) {
      setPlannedWork(workSeconds);
      setRemaining(workSeconds);
      left = workSeconds;
    }
    endAtRef.current = Date.now() + left * 1000;
    setRunning(true);
    if (!isBreak && settings.dimPage) setFocusView(true);
  };

  const handleStart = () => begin();
  const handleSprint = () => begin(SPRINT_SECONDS);

  const handlePause = () => {
    setRunning(false);
    endAtRef.current = null;
  };

  // Stopping or skipping a focus stretch part-way still counts, once enough of
  // it was spent: stopping at minute 12 is 12 minutes of focus, not none.
  const stopSession = () => {
    if (!isBreak) creditSession(creditedSeconds(plannedWork, remaining));
    setRunning(false);
    endAtRef.current = null;
    sessionStartRef.current = null;
    setFocusView(false);
  };

  const handleReset = () => {
    stopSession();
    setPlannedWork(settings.workMinutes * 60);
    setRemaining(isBreak ? breakSeconds : settings.workMinutes * 60);
  };

  const handleSkip = () => {
    stopSession();
    const nextIsBreak = !isBreak;
    setIsBreak(nextIsBreak);
    setPlannedWork(settings.workMinutes * 60);
    setRemaining(nextIsBreak ? breakSeconds : settings.workMinutes * 60);
  };

  const total = isBreak ? breakSeconds : plannedWork;
  const progress = total > 0 ? (total - remaining) / total : 0;

  // Escape leaves the focus view, not the session.
  useEffect(() => {
    if (!focusView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusView(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusView]);

  if (!visible) {
    // A dismissed pill stays dismissed - except while a session is running,
    // when it is the only way back to the countdown, so it shows (without a
    // close button) until the session ends.
    if (pillHidden && !running) return null;
    return (
      <FloatingActionPill
        onClick={() => setVisible(true)}
        ariaLabel={`Open Pomodoro focus timer (${alt}+P)`}
        title={`Focus Timer (${alt}+P)`}
        positionClassName="bottom-20 left-4 z-50 md:bottom-6 md:left-6"
        colorClassName="border-amber-400/30 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 shadow-[0_8px_25px_rgba(245,158,11,0.4)] hover:shadow-[0_12px_30px_rgba(245,158,11,0.6)] focus:ring-amber-400 dark:from-slate-900 dark:to-slate-800 dark:text-amber-400 dark:border-amber-500/40 dark:shadow-2xl"
        icon={
          <svg
            className="h-4 w-4 text-amber-100 dark:text-amber-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        label="Focus Timer"
        labelClassName="text-white dark:text-amber-300"
        shortcut={`${alt}+P`}
        shortcutClassName="dark:bg-amber-500/20 dark:text-amber-300"
        onDismiss={running ? undefined : () => setPillHidden(true)}
        dismissLabel={`Hide the Focus Timer button (${alt}+P still opens it; Profile > Appearance brings it back)`}
      />
    );
  }

  if (visible && focusView && !isBreak) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Focus session"
        data-testid="focus-view"
        className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-8 bg-background px-6 text-center"
      >
        <button
          onClick={() => setFocusView(false)}
          className="absolute right-4 top-4 rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Show page (Esc)
        </button>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Focus</p>
          <h2 className="max-w-xl font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {focusedTask ? focusedTask.title : 'One thing at a time'}
          </h2>
        </div>
        <RingGauge
          progress={progress}
          variant="brand"
          level="low"
          size={260}
          radius={116}
          strokeWidth={8}
          aria-label={`${formatTime(remaining)} remaining`}
        >
          <span className="text-5xl font-mono font-bold text-foreground tabular-nums">
            {formatTime(remaining)}
          </span>
        </RingGauge>
        <div className="flex items-center gap-3">
          {running ? (
            <button
              autoFocus
              onClick={handlePause}
              aria-label="Pause timer"
              className="min-h-[44px] rounded-full border border-border px-6 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Pause
            </button>
          ) : (
            <button
              autoFocus
              onClick={handleStart}
              aria-label="Start timer"
              className="min-h-[44px] rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Resume
            </button>
          )}
          <button
            onClick={handleReset}
            aria-label="Stop session"
            className="min-h-[44px] rounded-full border border-border px-6 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
          >
            Stop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Pomodoro focus timer"
      className={cn(
        'fixed bottom-20 left-5 z-50 rounded-2xl bg-card p-4 shadow-2xl w-64 md:bottom-6 md:left-6',
        // Neon Edge "actively processing" sweep - only while genuinely
        // counting down. Paused or idle, this is just a plain bordered
        // card; running is the one state where "time is passing" is true.
        running ? 'spin-border' : 'border border-border',
      )}
    >
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isBreak ? 'Break' : 'Focus'}
          </span>
          <button
            onClick={() => setVisible(false)}
            aria-label="Close focus timer"
            className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Focus Mode Deep Link: only present when this session was opened
            scoped to a specific task (Calendar's "Focus" action) - a
            generic Alt+P/CommandPalette open has no taskId and renders
            nothing extra here, unchanged from before this feature. */}
        {focusedTask && (
          <p className="w-full truncate text-center text-xs text-muted-foreground">
            Focusing on <span className="font-medium text-foreground">{focusedTask.title}</span>
          </p>
        )}

        {/* Focus ring - the arc is always the brand gradient (Neon Edge
            identity, visible even while paused); a break switches to the
            semantic "low" (calm green) arc so "resting" never reads as
            "focusing." No needle: the countdown text already shows the
            value, so a needle pointing at the same thing is just noise. */}
        <RingGauge
          progress={progress}
          variant={isBreak ? 'semantic' : 'brand'}
          level="low"
          size={140}
          radius={60}
          strokeWidth={6}
          aria-label={`${formatTime(remaining)} remaining`}
        >
          <span
            aria-live="polite"
            aria-label={`${formatTime(remaining)} remaining`}
            className="text-2xl font-mono font-bold text-foreground tabular-nums"
          >
            {formatTime(remaining)}
          </span>
        </RingGauge>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {running ? (
            <button
              onClick={handlePause}
              aria-label="Pause timer"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={handleStart}
              aria-label="Start timer"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start
            </button>
          )}
          <button
            onClick={handleReset}
            aria-label="Reset timer"
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
          >
            Reset
          </button>
          <button
            onClick={handleSkip}
            aria-label={`Skip to ${isBreak ? 'work' : 'break'}`}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
          >
            Skip
          </button>
        </div>

        {!running && !isBreak && (
          <button
            onClick={handleSprint}
            className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Just 5 minutes
          </button>
        )}

        {/* Lengths and the dimmed view. Fixed while a session runs, so a
            length can't change under the clock. */}
        <div className="w-full">
          <button
            onClick={() => setOptionsOpen((o) => !o)}
            aria-expanded={optionsOpen}
            aria-controls="focus-options"
            className="w-full rounded-md py-0.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {optionsOpen ? 'Hide options' : 'Options'}
          </button>
          {optionsOpen && (
            <div id="focus-options" className="mt-2 space-y-3 border-t border-border pt-3">
              <fieldset disabled={running} className="space-y-1.5 disabled:opacity-50">
                <legend className="text-xs font-semibold text-muted-foreground">
                  Focus length
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {WORK_MINUTE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => updateSettings({ workMinutes: m })}
                      aria-pressed={settings.workMinutes === m}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                        settings.workMinutes === m
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={running} className="space-y-1.5 disabled:opacity-50">
                <legend className="text-xs font-semibold text-muted-foreground">
                  Break length
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {BREAK_MINUTE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => updateSettings({ breakMinutes: m })}
                      aria-pressed={settings.breakMinutes === m}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                        settings.breakMinutes === m
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={settings.dimPage}
                  onChange={(e) => updateSettings({ dimPage: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Hide the page while I focus
              </label>
            </div>
          )}
        </div>

        {/* Session counter */}
        {sessionCount > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {sessionCount} session{sessionCount !== 1 ? 's' : ''} today
          </p>
        )}
      </div>
    </div>
  );
}
