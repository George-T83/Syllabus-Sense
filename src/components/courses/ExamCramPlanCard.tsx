'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import { createScheduleItem } from '@/lib/firestore/scheduleItems';
import { toDayKey, parseDayKey, addDays, startOfDay } from '@/lib/calendar/dates';
import {
  daysUntilExam as computeDaysUntilExam,
  cramPlanLength,
  MAX_CRAM_DAYS,
} from '@/lib/planner/cramPlan';
import { generatedCramPlanSchema } from '@/types/cramPlan';
import type { Course } from '@/types/schedule';

export function ExamCramPlanCard({ course }: { course: Course }) {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const syllabi = useSyllabi(user?.uid, course.id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const latestSyllabus = syllabi
    .slice()
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];

  const today = startOfDay(new Date());
  const nearestExam = state.scheduleItems
    .filter((item) => item.courseId === course.id && item.type === 'exam')
    .filter((item) => parseDayKey(item.dueDate).getTime() >= today.getTime())
    .sort((a, b) => parseDayKey(a.dueDate).getTime() - parseDayKey(b.dueDate).getTime())[0];

  const daysUntilExam = nearestExam ? computeDaysUntilExam(nearestExam.dueDate, today) : 0;
  const planDays = cramPlanLength(daysUntilExam);

  const handleGenerate = async () => {
    if (!user || !latestSyllabus || !nearestExam || planDays < 1) return;
    setGenerating(true);
    setError(null);
    setAddedCount(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/syllabus/cram-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storagePath: latestSyllabus.storagePath,
          fileName: latestSyllabus.fileName,
          examTitle: nearestExam.title,
          days: planDays,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Cram plan generation failed.');

      const topics = generatedCramPlanSchema(planDays).parse(body.topics);
      await Promise.all(
        topics.map((topic, i) => {
          const dueDate = addDays(today, i + 1);
          return createScheduleItem(
            user.uid,
            {
              id: crypto.randomUUID(),
              courseId: course.id,
              title: `Cram Day ${i + 1}: ${topic}`,
              type: 'reading',
              dueDate: toDayKey(dueDate),
              completed: false,
              notes: `Auto-generated review plan for ${nearestExam.title}.`,
            },
            dispatch,
          );
        }),
      );
      setAddedCount(topics.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setGenerating(false);
    }
  };

  if (!nearestExam) return null;

  return (
    <Card className="rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Exam Cram Plan</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {nearestExam.title} in {daysUntilExam} {daysUntilExam === 1 ? 'day' : 'days'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
          {daysUntilExam}d
        </span>
      </div>

      {!latestSyllabus && (
        <p className="text-xs text-muted-foreground">
          Upload a syllabus on this course to generate a day-by-day review plan.
        </p>
      )}

      {latestSyllabus && daysUntilExam > MAX_CRAM_DAYS && (
        <p className="text-xs text-muted-foreground">
          This exam is more than {MAX_CRAM_DAYS} days out — a cram plan covers the {MAX_CRAM_DAYS}{' '}
          days starting today; check back closer to the exam for a plan reaching all the way to it.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {addedCount !== null && !generating && (
        <p className="text-xs text-load-low">
          Added {addedCount} {addedCount === 1 ? 'task' : 'tasks'} to your Planner, one per day.
        </p>
      )}

      {latestSyllabus && (
        <CardActionButton variant="solid" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : `Generate ${planDays}-Day Cram Plan`}
        </CardActionButton>
      )}
    </Card>
  );
}
