'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { Flashcard } from '@/types/flashcard';
import type { ReviewRating } from '@/lib/flashcards/sm2';

const RATING_BUTTONS: { rating: ReviewRating; label: string; className: string }[] = [
  {
    rating: 'again',
    label: 'Again',
    className: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  },
  {
    rating: 'hard',
    label: 'Hard',
    className: 'bg-load-medium/10 text-load-medium hover:bg-load-medium/20',
  },
  { rating: 'good', label: 'Good', className: 'bg-primary/10 text-primary hover:bg-primary/20' },
  { rating: 'easy', label: 'Easy', className: 'bg-load-low/10 text-load-low hover:bg-load-low/20' },
];

export interface FlashcardReviewSessionProps {
  /** Snapshot of the cards due when the session opened - frozen so a card
   * rescheduled mid-session doesn't reshuffle the queue out from under the
   * student. `null` means the session is closed. */
  cards: Flashcard[] | null;
  onClose: () => void;
  onRate: (card: Flashcard, rating: ReviewRating) => Promise<void>;
}

export function FlashcardReviewSession({ cards, onClose, onRate }: FlashcardReviewSessionProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);

  const open = !!cards;
  const dialogRef = useModalA11y<HTMLDivElement>(open, handleClose);

  function handleClose() {
    setIndex(0);
    setRevealed(false);
    onClose();
  }

  if (!cards) return null;

  const done = index >= cards.length;
  const card = done ? null : cards[index];

  const handleRate = async (r: ReviewRating) => {
    if (!card || rating) return;
    setRating(true);
    try {
      await onRate(card, r);
      setIndex((i) => i + 1);
      setRevealed(false);
    } catch {
      // onRate already surfaced an error toast - keep this card on screen
      // instead of advancing past a rating that was never saved.
    } finally {
      setRating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flashcard-review-title"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none" className="p-6">
          <div className="flex items-center justify-between">
            <h2 id="flashcard-review-title" className="text-sm font-bold text-foreground">
              {done ? 'Session complete' : `Card ${index + 1} of ${cards.length}`}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close review session"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent"
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

          {done ? (
            <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand text-white">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground">All caught up on this review.</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted/40 p-6 text-center transition-colors hover:border-primary/40"
              >
                <p className="text-base font-semibold leading-relaxed text-foreground">
                  {card!.front}
                </p>
                {revealed && (
                  <>
                    <div className="h-px w-16 bg-border" />
                    <p className="text-sm leading-relaxed text-muted-foreground">{card!.back}</p>
                  </>
                )}
                {!revealed && (
                  <span className="text-xs font-semibold text-primary">Tap to reveal answer</span>
                )}
              </button>

              {revealed ? (
                <div className="grid grid-cols-4 gap-2">
                  {RATING_BUTTONS.map(({ rating: r, label, className }) => (
                    <button
                      key={r}
                      type="button"
                      disabled={rating}
                      onClick={() => handleRate(r)}
                      className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${className}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Reveal the answer, then rate how well you remembered it.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
