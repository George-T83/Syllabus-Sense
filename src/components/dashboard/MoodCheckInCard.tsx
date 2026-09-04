'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { upsertMoodEntry } from '@/lib/firestore/moodEntries';
import { toDayKey } from '@/lib/calendar/dates';
import { MOOD_OPTIONS } from '@/lib/mood/moodScale';
import { computeMoodStreak } from '@/lib/mood/moodStats';
import { cn } from '@/lib/utils';
import type { MoodValue } from '@/types/mood';

/**
 * The "Option A" design from the Wellness Check-in audit item: the lowest
 * possible friction, a single emoji tap on the Dashboard each day, chosen
 * over a richer weekly form specifically because a tiny daily habit
 * survives finals week and a form people mean to fill out later doesn't.
 */
export function MoodCheckInCard() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { showError } = useToast();
  const [saving, setSaving] = useState<MoodValue | null>(null);

  const todayKey = toDayKey(new Date());
  const todayEntry = state.moodEntries.find((e) => e.dateKey === todayKey);
  const streak = computeMoodStreak(state.moodEntries);

  const handleTap = async (mood: MoodValue) => {
    if (!user) return;
    setSaving(mood);
    const previousEntry = todayEntry;
    try {
      await upsertMoodEntry(
        user.uid,
        { id: todayKey, dateKey: todayKey, mood, createdAt: new Date().toISOString() },
        dispatch,
        previousEntry,
      );
    } catch {
      showError("Couldn't save your check-in", 'Try tapping again in a moment.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">How&apos;s today going?</h2>
          {streak > 1 && (
            <p className="mt-0.5 text-xs text-muted-foreground">🔥 {streak}-day check-in streak</p>
          )}
        </div>
        <Link
          href="/mood"
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          See your recap →
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {MOOD_OPTIONS.map((option) => {
          const isSelected = todayEntry?.mood === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTap(option.value)}
              disabled={saving !== null}
              aria-pressed={isSelected}
              aria-label={option.label}
              title={option.label}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all disabled:cursor-not-allowed disabled:opacity-60',
                isSelected
                  ? 'bg-primary/10 ring-2 ring-primary scale-110'
                  : 'hover:bg-accent hover:scale-105',
              )}
            >
              {option.emoji}
            </button>
          );
        })}
      </div>

      {todayEntry && (
        <p className="mt-3 text-xs text-muted-foreground">
          Logged as {getMoodOptionLabel(todayEntry.mood)} today - tap another face to change it.
        </p>
      )}
    </Card>
  );
}

function getMoodOptionLabel(mood: MoodValue): string {
  return MOOD_OPTIONS[mood - 1].label;
}
