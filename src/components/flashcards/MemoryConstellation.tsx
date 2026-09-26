'use client';

import { useId, useState } from 'react';
import {
  hashUnit,
  memoryTier,
  recallOn,
  stabilityDays,
  type MemoryTier,
} from '@/lib/flashcards/memory';
import type { Flashcard } from '@/types/flashcard';

/** Tier hues, validated in light and dark against card surfaces with the
 * dataviz palette checker. "New" is deliberately not a hue - a hollow ring
 * in the muted ink, since it isn't a memory state yet. */
export const TIER_COLOR: Record<Exclude<MemoryTier, 'new'>, string> = {
  strong: '#00a88c',
  learning: '#6d51fa',
  fading: '#d97706',
};

export const TIER_LABEL: Record<MemoryTier, string> = {
  strong: 'Long-term',
  learning: 'Learning',
  fading: 'Fading',
  new: 'New',
};

const TIER_ORDER: MemoryTier[] = ['strong', 'learning', 'fading', 'new'];

const W = 320;
const H = 132;
const CX = W / 2;
const CY = H / 2;
/** Stability that maps to the outermost orbit - a month-long memory. */
const MAX_ORBIT_STABILITY = 30;

interface Star {
  card: Flashcard;
  tier: MemoryTier;
  recall: number;
  x: number;
  y: number;
}

/**
 * A deck drawn as a constellation: every card is a star. Distance from the
 * core is how long the memory lasts (stability) - long-term cards sit on
 * the outer orbits - and brightness is how likely it is to be recalled
 * right now. Fading stars are the ones to review.
 */
export function MemoryConstellation({ cards, today }: { cards: Flashcard[]; today?: Date }) {
  const now = today ?? new Date();
  const labelId = useId();
  const [active, setActive] = useState<number | null>(null);

  const stars: Star[] = cards.map((card) => {
    const tier = memoryTier(card, now);
    const recall = recallOn(card, now);
    const orbit =
      tier === 'new'
        ? 0.24
        : 0.3 +
          0.7 * Math.min(1, Math.log1p(stabilityDays(card)) / Math.log1p(MAX_ORBIT_STABILITY));
    const angle = hashUnit(card.id) * Math.PI * 2;
    const jitter = 0.9 + hashUnit(card.id, 3) * 0.2;
    return {
      card,
      tier,
      recall,
      x: CX + Math.cos(angle) * (W / 2 - 14) * orbit * jitter,
      y: CY + Math.sin(angle) * (H / 2 - 10) * orbit * jitter,
    };
  });

  const counts = TIER_ORDER.map((t) => [t, stars.filter((s) => s.tier === t).length] as const);
  const current = active === null ? null : stars[active];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.10),transparent_70%)] outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        role="img"
        aria-labelledby={labelId}
        tabIndex={stars.length ? 0 : -1}
        onKeyDown={(e) => {
          if (!stars.length) return;
          if (e.key === 'ArrowRight') setActive((a) => (a === null ? 0 : (a + 1) % stars.length));
          if (e.key === 'ArrowLeft')
            setActive((a) =>
              a === null ? stars.length - 1 : (a - 1 + stars.length) % stars.length,
            );
        }}
        onBlur={() => setActive(null)}
      >
        <title id={labelId}>
          {`Memory map: ${counts
            .filter(([, n]) => n > 0)
            .map(([t, n]) => `${n} ${TIER_LABEL[t].toLowerCase()}`)
            .join(', ')}`}
        </title>
        {[0.3, 0.65, 1].map((o) => (
          <ellipse
            key={o}
            cx={CX}
            cy={CY}
            rx={(W / 2 - 14) * o}
            ry={(H / 2 - 10) * o}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
        ))}
        <circle cx={CX} cy={CY} r={2} fill="hsl(var(--primary))" opacity={0.5} />

        {stars.map((s, i) => {
          const color = s.tier === 'new' ? null : TIER_COLOR[s.tier];
          const r = s.tier === 'new' ? 3 : 2.5 + s.recall * 2.5;
          return (
            <g
              key={s.card.id}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive((a) => (a === i ? null : a))}
            >
              <circle cx={s.x} cy={s.y} r={12} fill="transparent" />
              {color && (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={r * 2.6}
                  fill={color}
                  opacity={0.12 + s.recall * 0.18}
                  className="constellation-twinkle"
                  style={{ animationDelay: `${hashUnit(s.card.id, 11) * 3}s` }}
                />
              )}
              <circle
                cx={s.x}
                cy={s.y}
                r={r}
                fill={color ?? 'transparent'}
                stroke={color ? 'hsl(var(--card))' : 'hsl(var(--muted-foreground))'}
                strokeWidth={color ? 1.5 : 1.25}
                opacity={color ? 0.55 + s.recall * 0.45 : 0.8}
              />
              {active === i && (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={r + 4}
                  fill="none"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1}
                />
              )}
            </g>
          );
        })}
      </svg>

      {current && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 max-w-[220px] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card"
          style={{ left: `${(current.x / W) * 100}%`, top: `${(current.y / H) * 100 - 6}%` }}
        >
          <p className="font-bold tabular-nums text-foreground">
            {current.tier === 'new'
              ? 'Not studied yet'
              : `${Math.round(current.recall * 100)}% recall now`}
          </p>
          <p className="text-muted-foreground">{TIER_LABEL[current.tier]}</p>
          <p className="mt-1 line-clamp-2 text-foreground">{current.card.front}</p>
        </div>
      )}

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {counts.map(([tier, n]) => (
          <li key={tier} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={
                tier === 'new'
                  ? { boxShadow: 'inset 0 0 0 1.25px hsl(var(--muted-foreground))' }
                  : { background: TIER_COLOR[tier] }
              }
            />
            <span className="font-semibold tabular-nums text-foreground">{n}</span>{' '}
            {TIER_LABEL[tier]}
          </li>
        ))}
      </ul>
    </div>
  );
}
