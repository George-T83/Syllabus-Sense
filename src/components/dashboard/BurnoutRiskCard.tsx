'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { computeBurnoutRisk } from '@/lib/burnout/burnoutRisk';
import { getWorkloadBadgeTokens } from '@/lib/workload';
import type { MoodEntry } from '@/types/mood';
import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';

const COPY: Record<WorkloadLevel, { headline: string; subline: string }> = {
  low: {
    headline: "You're keeping a good pace",
    subline: 'No burnout warning signs right now.',
  },
  medium: {
    headline: 'Worth keeping an eye on',
    subline: 'A few signals are trending the wrong way.',
  },
  high: {
    headline: 'Elevated burnout risk',
    subline: 'Several signals suggest you might be running low.',
  },
  critical: {
    headline: 'High burnout risk',
    subline: 'Multiple strong signals at once - consider easing up where you can.',
  },
};

/** Same "Monday of this week" grouping WeeklyBriefingCard uses, so a
 * dismissal naturally clears out at the start of a new week. */
function weekStartKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/** Dismissal is keyed by level, not just week - unlike the weekly briefing,
 * silently staying hidden while risk climbs from "worth watching" to "high"
 * would defeat the point of an early-warning card. Dismissing a lower tier
 * doesn't suppress a later, more severe one. */
function dismissedStorageKey(uid: string, weekKey: string, level: WorkloadLevel): string {
  return `burnout-risk-dismissed:${uid}:${weekKey}:${level}`;
}

export interface BurnoutRiskCardProps {
  scheduleItems: ScheduleItem[];
  moodEntries: MoodEntry[];
}

/** A dismissible early-warning card combining objective workload signals
 * (heavy days ahead/behind, overdue items) with self-reported mood into one
 * indicator - entirely client-computed from data already loaded, no
 * notification backend required (same approach as WeeklyBriefingCard). */
export function BurnoutRiskCard({ scheduleItems, moodEntries }: BurnoutRiskCardProps) {
  const { user } = useAuth();
  const weekKey = useMemo(() => weekStartKey(new Date()), []);
  const risk = useMemo(
    () => computeBurnoutRisk(scheduleItems, moodEntries),
    [scheduleItems, moodEntries],
  );

  const [dismissedLevel, setDismissedLevel] = useState<WorkloadLevel | null>(() => {
    if (!user || typeof window === 'undefined') return null;
    try {
      for (const level of ['medium', 'high', 'critical'] as const) {
        if (window.localStorage.getItem(dismissedStorageKey(user.uid, weekKey, level)) === 'true') {
          return level;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  if (risk.level === 'low' || risk.level === dismissedLevel) {
    return null;
  }

  const tokens = getWorkloadBadgeTokens(risk.level, { solid: false });
  const copy = COPY[risk.level];

  const handleDismiss = () => {
    setDismissedLevel(risk.level);
    if (!user) return;
    try {
      window.localStorage.setItem(dismissedStorageKey(user.uid, weekKey, risk.level), 'true');
    } catch {
      // Non-fatal: worst case it reappears next visit.
    }
  };

  return (
    <Card accent="none" className={`rounded-2xl border p-5 ${tokens.chipClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${tokens.swatchClass}`}
              aria-hidden="true"
            />
            <h2 className={`text-sm font-bold ${tokens.textClass}`}>{copy.headline}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{copy.subline}</p>

          {risk.factors.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {risk.factors.map((factor) => (
                <li
                  key={factor.key}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={`h-1 w-1 rounded-full ${tokens.swatchClass}`}
                    aria-hidden="true"
                  />
                  {factor.label}
                </li>
              ))}
            </ul>
          )}

          {!risk.hasEnoughMoodData && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Log your mood a few more days this week for a fuller picture.
            </p>
          )}

          <Link
            href="/mood"
            className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${tokens.textClass} hover:underline`}
          >
            See your mood & workload recap →
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss this burnout warning"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
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
    </Card>
  );
}
