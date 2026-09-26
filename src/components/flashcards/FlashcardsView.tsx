'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { updateFlashcard } from '@/lib/firestore/flashcards';
import { applySM2, isCardDue, type ReviewRating } from '@/lib/flashcards/sm2';
import { FlashcardDeckCard } from '@/components/flashcards/FlashcardDeckCard';
import { FlashcardReviewSession } from '@/components/flashcards/FlashcardReviewSession';
import type { Flashcard } from '@/types/flashcard';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPageGuide } from '@/components/ui/EmptyPageGuide';
import { CardActionButton, CardActionLink, SyllabusIcon } from '@/components/ui/CardAction';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { SyllabusAutofillModal } from '@/components/syllabus/SyllabusAutofillModal';

export function FlashcardsView() {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const { showError } = useToast();
  const [reviewQueue, setReviewQueue] = useState<Flashcard[] | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);

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
        <PageHeader
          eyebrow="Coursework"
          title="Flashcards"
          description={
            <>
              Generated from your syllabi, reviewed with spaced repetition (SM-2) so the cards you
              keep forgetting come back sooner.
            </>
          }
        />

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
          <EmptyPageGuide
            title="Flashcards come from your syllabus"
            lead="Upload a syllabus and we'll turn it into a deck for the course, then bring each card back just before you'd forget it."
            actions={
              <>
                <CardActionButton variant="primary" onClick={() => setAutofillOpen(true)}>
                  <SyllabusIcon />
                  Upload a syllabus
                </CardActionButton>
                <CardActionLink href="/courses" withChevron>
                  Add a course
                </CardActionLink>
              </>
            }
            previews={[
              {
                icon: <SectionIcon icon="syllabus" />,
                title: 'A deck per course',
                detail:
                  'Key terms and ideas pulled from the syllabus, one card each, ready to review.',
              },
              {
                icon: <SectionIcon icon="clock" />,
                title: 'Review at the right time',
                detail:
                  'Cards you miss come back sooner and cards you know drift further out, so each session stays short.',
              },
              {
                icon: <SectionIcon icon="star" />,
                title: 'Ready for exam day',
                detail: "Each deck shows how ready you are for that course's next exam.",
              },
            ]}
          />
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
        allCards={state.flashcards}
        courses={state.courses}
        scheduleItems={state.scheduleItems}
        onClose={() => setReviewQueue(null)}
        onRate={handleRate}
      />
      <SyllabusAutofillModal open={autofillOpen} onClose={() => setAutofillOpen(false)} />
    </>
  );
}
