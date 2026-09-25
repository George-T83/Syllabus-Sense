'use client';

import { useEffect, useRef } from 'react';

export interface SyllabusExtractionRevealProps {
  /** Short facts about what was found, in the order they should appear -
   * e.g. ["CS 301 · Data Structures & Algorithms", "Prof. Ada Lovelace",
   * "12 assignments & deadlines found"]. */
  facts: string[];
  /** Called once the reveal sequence finishes, so the caller can advance to
   * the full review step. */
  onDone: () => void;
}

const STEP_DELAY_MS = 140;
const TAIL_PAUSE_MS = 450;

/** Replaces the extraction step's bare spinner with a staged reveal of what
 * the AI actually found, once the (single, non-streaming) extraction result
 * has landed - the fields "materialize" in sequence instead of the review
 * screen appearing all at once. Respects prefers-reduced-motion by cutting
 * straight to `onDone` instead of pacing through the reveal. */
export function SyllabusExtractionReveal({ facts, onDone }: SyllabusExtractionRevealProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const totalMs = reducedMotion ? 0 : facts.length * STEP_DELAY_MS + TAIL_PAUSE_MS;
    const timer = setTimeout(() => onDoneRef.current(), totalMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts.length]);

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-white">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        {facts.map((fact, i) => (
          <p
            key={fact}
            className="review-reveal text-sm font-semibold text-foreground"
            style={{ animationDelay: `${i * STEP_DELAY_MS}ms` }}
          >
            {fact}
          </p>
        ))}
      </div>
    </div>
  );
}
