'use client';

import { useId, useState } from 'react';
import { daysBetween, memoryTier, recallOn, type MemoryTier } from '@/lib/flashcards/memory';
import { parseDayKey } from '@/lib/calendar/dates';
import { cn } from '@/lib/utils';
import type { Flashcard } from '@/types/flashcard';

/** Tier hues, validated in light and dark against card surfaces with the
 * dataviz palette checker. "Not started" is deliberately not a hue - an
 * outlined tile, since there's no memory there yet. */
export const TIER_COLOR: Record<Exclude<MemoryTier, 'new'>, string> = {
  strong: '#00a88c',
  learning: '#6d51fa',
  fading: '#d97706',
};

export const TIER_LABEL: Record<MemoryTier, string> = {
  strong: 'Locked in',
  learning: 'Learning',
  fading: 'Slipping',
  new: 'Not started',
};

/** Needs-attention first, so the eye lands on what to review. */
const TIER_ORDER: MemoryTier[] = ['fading', 'learning', 'strong', 'new'];

interface Tile {
  card: Flashcard;
  tier: MemoryTier;
  recall: number;
}

export interface MemoryTilesProps {
  cards: Flashcard[];
  /** What readiness is measured against, e.g. "Midterm". Null with no exam. */
  examTitle: string | null;
  today?: Date;
}

function dueLabel(dueDate: string, now: Date) {
  const days = daysBetween(now, parseDayKey(dueDate));
  if (days <= 0) return 'review today';
  if (days === 1) return 'next review tomorrow';
  return `next review ${parseDayKey(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function tileStatus(tile: Tile, now: Date) {
  if (tile.tier === 'new') return 'Not started yet';
  return `${TIER_LABEL[tile.tier]} · ${dueLabel(tile.card.dueDate, now)}`;
}

function summary(counts: Record<MemoryTier, number>, examTitle: string | null) {
  const when = examTitle ? `before the ${examTitle}` : 'soon';
  if (counts.fading > 0) {
    const n = counts.fading;
    return {
      tier: 'fading' as const,
      text: `${n} ${n === 1 ? 'card is' : 'cards are'} slipping — review ${n === 1 ? 'it' : 'them'} ${when}.`,
    };
  }
  if (counts.new > 0) {
    const n = counts.new;
    return {
      tier: 'new' as const,
      text: `${n} ${n === 1 ? 'card hasn’t' : 'cards haven’t'} been studied yet.`,
    };
  }
  if (counts.learning > 0) {
    return {
      tier: 'learning' as const,
      text: 'Nothing slipping — keep up with reviews to lock the rest in.',
    };
  }
  return { tier: 'strong' as const, text: 'Every card is locked in.' };
}

/**
 * A deck shown as what it is - a stack of cards - with each card a small
 * tile colored by how well it's remembered, sorted so the ones slipping
 * come first. One sentence on top says what to do about it.
 */
export function MemoryTiles({ cards, examTitle, today }: MemoryTilesProps) {
  const now = today ?? new Date();
  const labelId = useId();
  const [active, setActive] = useState<number | null>(null);

  const tiles: Tile[] = cards
    .map((card) => ({ card, tier: memoryTier(card, now), recall: recallOn(card, now) }))
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.recall - b.recall);

  const counts = Object.fromEntries(
    TIER_ORDER.map((t) => [t, tiles.filter((x) => x.tier === t).length]),
  ) as Record<MemoryTier, number>;
  const headline = summary(counts, examTitle);
  const current = active === null ? null : tiles[active];

  return (
    <div className="space-y-2.5">
      <p className="flex items-start gap-2 text-xs font-medium text-foreground">
        <span
          aria-hidden
          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
          style={
            headline.tier === 'new'
              ? { boxShadow: 'inset 0 0 0 1.25px hsl(var(--muted-foreground))' }
              : { background: TIER_COLOR[headline.tier] }
          }
        />
        {headline.text}
      </p>

      <div className="relative">
        <ul
          aria-labelledby={labelId}
          tabIndex={tiles.length ? 0 : -1}
          className="flex flex-wrap gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          onKeyDown={(e) => {
            if (!tiles.length) return;
            if (e.key === 'ArrowRight') setActive((a) => (a === null ? 0 : (a + 1) % tiles.length));
            if (e.key === 'ArrowLeft')
              setActive((a) =>
                a === null ? tiles.length - 1 : (a - 1 + tiles.length) % tiles.length,
              );
          }}
          onBlur={() => setActive(null)}
        >
          <span id={labelId} className="sr-only">
            {`Deck memory: ${TIER_ORDER.filter((t) => counts[t] > 0)
              .map((t) => `${counts[t]} ${TIER_LABEL[t].toLowerCase()}`)
              .join(', ')}. Use arrow keys to inspect each card.`}
          </span>
          {tiles.map((t, i) => {
            const color = t.tier === 'new' ? null : TIER_COLOR[t.tier];
            return (
              <li
                key={t.card.id}
                aria-label={`${t.card.front} — ${tileStatus(t, now)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                className={cn(
                  'h-7 w-5 rounded-[5px] transition-transform duration-150',
                  active === i && '-translate-y-1 scale-110',
                )}
                style={
                  color
                    ? {
                        background: `linear-gradient(160deg, ${color}, ${color}cc)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px -2px ${color}99`,
                      }
                    : { boxShadow: 'inset 0 0 0 1.5px hsl(var(--muted-foreground) / 0.6)' }
                }
              />
            );
          })}
        </ul>

        {current && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-full z-10 mt-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs shadow-card"
          >
            <p className="line-clamp-2 font-semibold leading-snug text-foreground">
              {current.card.front}
            </p>
            <p className="mt-1 text-muted-foreground">{tileStatus(current, now)}</p>
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {TIER_ORDER.map((tier) => (
          <li key={tier} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2 rounded-[2px]"
              style={
                tier === 'new'
                  ? { boxShadow: 'inset 0 0 0 1.25px hsl(var(--muted-foreground))' }
                  : { background: TIER_COLOR[tier] }
              }
            />
            <span className="font-semibold tabular-nums text-foreground">{counts[tier]}</span>
            {TIER_LABEL[tier]}
          </li>
        ))}
      </ul>
    </div>
  );
}
