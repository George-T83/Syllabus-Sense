'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import { createQuiz, deleteQuiz } from '@/lib/firestore/quizzes';
import { generatedQuizQuestionsSchema } from '@/types/quiz';
import type { Quiz } from '@/types/quiz';
import type { Course } from '@/types/schedule';

export function QuizCard({ course, onTake }: { course: Course; onTake: (quiz: Quiz) => void }) {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const { showSuccess, showError } = useToast();
  const syllabi = useSyllabi(user?.uid, course.id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const latestSyllabus = syllabi
    .slice()
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];

  const quiz = state.quizzes.find((q) => q.courseId === course.id);
  const attempts = state.quizAttempts
    .filter((a) => a.courseId === course.id)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  const bestAttempt = attempts.reduce<(typeof attempts)[number] | null>((best, a) => {
    if (!best) return a;
    return a.score / a.total > best.score / best.total ? a : best;
  }, null);

  const handleGenerate = async () => {
    if (!user || !latestSyllabus) return;
    setGenerating(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/syllabus/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storagePath: latestSyllabus.storagePath,
          fileName: latestSyllabus.fileName,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Quiz generation failed.');

      const generated = generatedQuizQuestionsSchema.parse(body.questions);
      const newQuiz: Quiz = {
        id: crypto.randomUUID(),
        courseId: course.id,
        questions: generated,
        createdAt: new Date().toISOString(),
        sourceFileName: latestSyllabus.fileName,
      };
      if (quiz) {
        await deleteQuiz(user.uid, quiz, dispatch);
      }
      await createQuiz(user.uid, newQuiz, dispatch);
      showSuccess('Quiz generated', `${generated.length} questions ready for ${course.code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!user || !quiz) return;
    setDeleting(true);
    try {
      await deleteQuiz(user.uid, quiz, dispatch);
      setConfirmingDelete(false);
      showSuccess('Quiz deleted', `The quiz for ${course.code} was removed.`);
    } catch (err) {
      showError('Could not delete this quiz', err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  if (!latestSyllabus && !quiz) {
    return (
      <Card accent="none" className="rounded-2xl border-dashed p-5 opacity-90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">{course.code}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a syllabus on this course&apos;s page to generate a practice quiz.
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
            {quiz ? `${quiz.questions.length} questions` : 'No quiz yet'}
          </p>
        </div>
        {bestAttempt && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Best: {bestAttempt.score}/{bestAttempt.total}
          </span>
        )}
      </div>

      {attempts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Last attempt: {attempts[0].score}/{attempts[0].total} &middot; {attempts.length}{' '}
          {attempts.length === 1 ? 'attempt' : 'attempts'} total
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {quiz && (
          <button
            type="button"
            onClick={() => onTake(quiz)}
            className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Take Quiz
          </button>
        )}
        {latestSyllabus && (
          <CardActionButton
            variant={quiz ? 'ghost' : 'solid'}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : quiz ? 'Regenerate' : 'Generate Quiz'}
          </CardActionButton>
        )}
        {quiz &&
          (confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={handleDeleteQuiz}
                disabled={deleting}
                className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-destructive/10 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="inline-flex min-h-[36px] items-center justify-center rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex min-h-[36px] items-center justify-center rounded-full px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              Delete quiz
            </button>
          ))}
      </div>
    </Card>
  );
}
