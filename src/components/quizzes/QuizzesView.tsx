'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { createQuizAttempt } from '@/lib/firestore/quizzes';
import { QuizCard } from '@/components/quizzes/QuizCard';
import { QuizSession } from '@/components/quizzes/QuizSession';
import type { Quiz } from '@/types/quiz';

export function QuizzesView() {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const { showError } = useToast();
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  const handleComplete = async (score: number, total: number) => {
    if (!user || !activeQuiz) return;
    try {
      await createQuizAttempt(
        user.uid,
        {
          id: crypto.randomUUID(),
          quizId: activeQuiz.id,
          courseId: activeQuiz.courseId,
          score,
          total,
          completedAt: new Date().toISOString(),
        },
        dispatch,
      );
    } catch (err) {
      showError('Could not save your score', err instanceof Error ? err.message : undefined);
      throw err;
    }
  };

  return (
    <>
      <div className="max-w-5xl space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Practice Quizzes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated multiple-choice quizzes from your syllabi, so you can check how well
            something actually stuck before it counts.
          </p>
        </div>

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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              title="No courses yet"
              description="Add a course and upload its syllabus to generate a practice quiz."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {state.courses.map((course) => (
              <QuizCard key={course.id} course={course} onTake={setActiveQuiz} />
            ))}
          </div>
        )}
      </div>

      <QuizSession
        quiz={activeQuiz}
        onClose={() => setActiveQuiz(null)}
        onComplete={handleComplete}
      />
    </>
  );
}
