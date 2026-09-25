'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FloatingActionPill } from '@/components/ui/FloatingActionPill';
import { saveSession } from '@/lib/focus/pomodoroSessions';
import { RingGauge } from '@/components/ui/RingGauge';
import { useAppState } from '@/context/AppStateContext';

const WORK_DURATION = 25 * 60; // 25 minutes
const BREAK_DURATION = 5 * 60; //  5 minutes

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
  const [visible, setVisible] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [remaining, setRemaining] = useState(WORK_DURATION);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const sessionStartRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const tick = useCallback(() => {
    setRemaining((prev) => {
      if (prev <= 1) {
        // Timer completed — play beep and auto-switch mode
        playBeep();
        setRunning(false);

        if (!isBreak && sessionStartRef.current) {
          // Save work session
          saveSession({
            startedAt: sessionStartRef.current.toISOString(),
            duration: WORK_DURATION,
            taskId,
          });
          setSessionCount((c) => c + 1);
        }

        setIsBreak((b) => !b);
        return isBreak ? WORK_DURATION : BREAK_DURATION;
      }
      return prev - 1;
    });
  }, [isBreak, taskId]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [running, tick]);

  const handleStart = () => {
    if (!running && !isBreak) {
      sessionStartRef.current = new Date();
    }
    setRunning(true);
  };

  const handlePause = () => setRunning(false);

  const handleReset = () => {
    setRunning(false);
    setRemaining(isBreak ? BREAK_DURATION : WORK_DURATION);
    sessionStartRef.current = null;
  };

  const handleSkip = () => {
    setRunning(false);
    const nextIsBreak = !isBreak;
    setIsBreak(nextIsBreak);
    setRemaining(nextIsBreak ? BREAK_DURATION : WORK_DURATION);
    sessionStartRef.current = null;
  };

  const progress = isBreak
    ? (BREAK_DURATION - remaining) / BREAK_DURATION
    : (WORK_DURATION - remaining) / WORK_DURATION;

  if (!visible) {
    return (
      <FloatingActionPill
        onClick={() => setVisible(true)}
        ariaLabel="Open Pomodoro focus timer (Alt+P)"
        title="Focus Timer (Alt+P)"
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
        shortcut="Alt+P"
        shortcutClassName="dark:bg-amber-500/20 dark:text-amber-300"
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Pomodoro focus timer"
      className={cn(
        'fixed bottom-20 left-5 z-50 rounded-2xl bg-card p-4 shadow-2xl w-60 md:bottom-6 md:left-6',
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
            {isBreak ? '☕ Break' : '🍅 Focus'}
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

        {/* Session counter */}
        {sessionCount > 0 && (
          <p className="text-center text-[10px] text-muted-foreground">
            {sessionCount} session{sessionCount !== 1 ? 's' : ''} today 🎉
          </p>
        )}
      </div>
    </div>
  );
}
