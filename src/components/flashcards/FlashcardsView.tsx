'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { updateFlashcard } from '@/lib/firestore/flashcards';
import { applySM2, isCardDue, type ReviewRating } from '@/lib/flashcards/sm2';
import { FlashcardDeckCard } from '@/components/flashcards/FlashcardDeckCard';
import { FlashcardReviewSession } from '@/components/flashcards/FlashcardReviewSession';
import type { Flashcard } from '@/types/flashcard';

export function FlashcardsView() {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const { showError } = useToast();
  const [reviewQueue, setReviewQueue] = useState<Flashcard[] | null>(null);

  const dueCards = state.flashcards.filter((c) => isCardDue(c));

  const handleRate = async (card: Flashcard, rating: ReviewRating) => {
    if (!user) return;
    const next = applySM2(card, rating);
    try {
      await updateFlashcard(
        user.uid,
        card,
        { ...card, ...next, lastReviewedAt: new Date().toISOString() },
        dispatch,
      );
    } catch (err) {
      showError("Couldn't save that rating", err instanceof Error ? err.message : undefined);
      throw err;
    }
  };

  return (
    <>
      <div className="max-w-5xl space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Flashcards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generated from your syllabi, reviewed with spaced repetition (SM-2) so the cards you
            keep forgetting come back sooner.
          </p>
        </div>

        {dueCards.length > 0 && (
          <Card accent="none" className="rounded-2xl border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-primary">
                  {dueCards.length} {dueCards.length === 1 ? 'card' : 'cards'} due across every
                  course
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Reviewing across courses interleaves material - the way spaced repetition actually
                  works.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewQueue(dueCards)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Review {dueCards.length} due cards →
              </button>
            </div>
          </Card>
        )}

        {state.courses.length === 0 ? (
          <Card className="rounded-2xl p-6">
            <EmptyState
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              }
              title="No courses yet"
              description="Add a course and upload its syllabus to generate flashcards."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {state.courses.map((course) => (
              <FlashcardDeckCard key={course.id} course={course} onReview={setReviewQueue} />
            ))}
          </div>
        )}
      </div>

      <FlashcardReviewSession
        cards={reviewQueue}
        onClose={() => setReviewQueue(null)}
        onRate={handleRate}
      />
    </>
  );
}
