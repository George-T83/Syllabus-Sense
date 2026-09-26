'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ConfirmDeleteInline } from '@/components/ui/ConfirmDeleteInline';
import { CardActionButton } from '@/components/ui/CardAction';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import { createFlashcards, deleteFlashcard } from '@/lib/firestore/flashcards';
import { isCardDue } from '@/lib/flashcards/sm2';
import { SM2_DEFAULTS } from '@/lib/flashcards/sm2';
import { toDayKey } from '@/lib/calendar/dates';
import { nextExamForCourse, readiness, readinessTarget } from '@/lib/flashcards/memory';
import { MemoryTiles } from '@/components/flashcards/MemoryTiles';
import { generatedFlashcardsSchema } from '@/types/flashcard';
import type { Flashcard } from '@/types/flashcard';
import type { Course } from '@/types/schedule';

export function FlashcardDeckCard({
  course,
  onReview,
}: {
  course: Course;
  onReview: (cards: Flashcard[]) => void;
}) {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const { showSuccess } = useToast();
  const syllabi = useSyllabi(user?.uid, course.id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const latestSyllabus = syllabi
    .slice()
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];

  const deckCards = state.flashcards.filter((c) => c.courseId === course.id);
  const dueCards = deckCards.filter((c) => isCardDue(c));
  const exam = nextExamForCourse(course.id, state.scheduleItems);
  const deckReadiness = readiness(deckCards, readinessTarget(exam));

  const handleGenerate = async () => {
    if (!user || !latestSyllabus) return;
    setGenerating(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/syllabus/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storagePath: latestSyllabus.storagePath,
          fileName: latestSyllabus.fileName,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Flashcard generation failed.');

      const generated = generatedFlashcardsSchema.parse(body.cards);
      const today = toDayKey(new Date());
      const newCards: Flashcard[] = generated.map((g) => ({
        id: crypto.randomUUID(),
        courseId: course.id,
        front: g.front,
        back: g.back,
        ...SM2_DEFAULTS,
        dueDate: today,
        createdAt: new Date().toISOString(),
        sourceFileName: latestSyllabus.fileName,
      }));
      await createFlashcards(user.uid, newCards, dispatch);
      showSuccess('Flashcards generated', `${newCards.length} cards ready for ${course.code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteDeck = async () => {
    if (!user) return;
    setDeleting(true);
    setError(null);
    try {
      await Promise.all(deckCards.map((c) => deleteFlashcard(user.uid, c, dispatch)));
      setConfirmingDelete(false);
      showSuccess('Deck deleted', `The flashcard deck for ${course.code} was removed.`);
    } catch (err) {
      // Left the Confirm/Cancel pair up rather than silently closing it -
      // a partial failure here can leave some cards deleted and some not,
      // and closing as if it succeeded would hide that from the student.
      setError(
        err instanceof Error ? err.message : 'Failed to delete this deck. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!latestSyllabus && deckCards.length === 0) {
    return (
      <Card accent="none" className="rounded-2xl border-dashed p-5 opacity-90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">{course.code}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a syllabus on this course&apos;s page to generate flashcards.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{course.code}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {deckCards.length} {deckCards.length === 1 ? 'card' : 'cards'}
          </p>
        </div>
        {dueCards.length > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Due: {dueCards.length}
          </span>
        )}
      </div>

      {deckCards.length > 0 && (
        <>
          <MemoryTiles cards={deckCards} examTitle={exam ? exam.item.title : null} />
          <div>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {exam
                  ? `${exam.item.title} ${exam.daysAway === 0 ? 'today' : exam.daysAway === 1 ? 'tomorrow' : `in ${exam.daysAway} days`}`
                  : 'Readiness a week out'}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {Math.round(deckReadiness * 100)}% ready
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-brand transition-all"
                style={{ width: `${deckReadiness * 100}%` }}
              />
            </div>
          </div>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {dueCards.length > 0 && (
          <button
            type="button"
            onClick={() => onReview(dueCards)}
            className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Review {dueCards.length} due
          </button>
        )}
        {latestSyllabus && (
          <CardActionButton
            variant={deckCards.length === 0 ? 'solid' : 'ghost'}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : deckCards.length === 0 ? 'Generate Cards' : 'Add more'}
          </CardActionButton>
        )}
        {deckCards.length > 0 &&
          (confirmingDelete ? (
            <ConfirmDeleteInline
              deleting={deleting}
              onConfirm={handleDeleteDeck}
              onCancel={() => setConfirmingDelete(false)}
              size="md"
            />
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-destructive/10 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20"
            >
              Delete deck
            </button>
          ))}
      </div>
    </Card>
  );
}
