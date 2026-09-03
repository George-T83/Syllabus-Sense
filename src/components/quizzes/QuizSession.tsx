'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { Quiz } from '@/types/quiz';

export interface QuizSessionProps {
  quiz: Quiz | null;
  onClose: () => void;
  onComplete: (score: number, total: number) => Promise<void>;
}

export function QuizSession({ quiz, onClose, onComplete }: QuizSessionProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const open = !!quiz;
  const dialogRef = useModalA11y<HTMLDivElement>(open, handleClose);

  function handleClose() {
    setIndex(0);
    setSelected(null);
    setScore(0);
    onClose();
  }

  if (!quiz) return null;

  const done = index >= quiz.questions.length;
  const question = done ? null : quiz.questions[index];

  const handleSelect = (choiceIndex: number) => {
    if (selected !== null) return;
    setSelected(choiceIndex);
    if (choiceIndex === question!.correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = async () => {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setSelected(null);
    if (nextIndex >= quiz.questions.length) {
      setSubmitting(true);
      try {
        await onComplete(score, quiz.questions.length);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-session-title"
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
            <h2 id="quiz-session-title" className="text-sm font-bold text-foreground">
              {done ? 'Quiz complete' : `Question ${index + 1} of ${quiz.questions.length}`}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close quiz"
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
              <p className="text-lg font-bold text-foreground">
                {score} / {quiz.questions.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {submitting ? 'Saving your score…' : 'Score saved to this course.'}
              </p>
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
              <p className="text-base font-semibold leading-relaxed text-foreground">
                {question!.question}
              </p>
              <div className="space-y-2">
                {question!.choices.map((choice, choiceIndex) => {
                  const isSelected = selected === choiceIndex;
                  const isCorrect = choiceIndex === question!.correctIndex;
                  const revealed = selected !== null;
                  const stateClass = !revealed
                    ? 'border-border hover:border-primary/40'
                    : isCorrect
                      ? 'border-load-low bg-load-low/10 text-load-low'
                      : isSelected
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-border opacity-60';
                  return (
                    <button
                      key={choiceIndex}
                      type="button"
                      onClick={() => handleSelect(choiceIndex)}
                      disabled={revealed}
                      className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed ${stateClass}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              {selected !== null && (
                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  {question!.explanation}
                </div>
              )}

              {selected !== null && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {index + 1 >= quiz.questions.length ? 'Finish' : 'Next question →'}
                </button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
