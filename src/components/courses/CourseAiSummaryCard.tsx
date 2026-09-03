'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import { updateCourse } from '@/lib/firestore/courses';
import { courseSummarySchema, type CourseSummaryNote } from '@/types/courseSummary';
import type { Course } from '@/types/schedule';

const CATEGORY_LABEL: Record<CourseSummaryNote['category'], string> = {
  attendance: 'Attendance',
  grading: 'Grading',
  lateWork: 'Late work',
  academicIntegrity: 'Academic integrity',
  prerequisite: 'Prerequisite',
  highStakes: 'High-stakes',
  communication: 'Communication',
  other: 'Note',
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (Math.abs(diffDays) < 1) return 'today';
  return relativeTimeFormatter.format(diffDays, 'day');
}

export function CourseAiSummaryCard({ course }: { course: Course }) {
  const { user } = useAuth();
  const { dispatch } = useAppState();
  const syllabi = useSyllabi(user?.uid, course.id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Most recently uploaded syllabus - the one worth summarizing if there's
  // more than one on file.
  const latestSyllabus = syllabi
    .slice()
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];

  const handleGenerate = async () => {
    if (!user || !latestSyllabus) return;
    setGenerating(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/syllabus/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storagePath: latestSyllabus.storagePath,
          fileName: latestSyllabus.fileName,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Summarization failed.');

      const parsed = courseSummarySchema.parse(body.result);
      await updateCourse(
        user.uid,
        course,
        {
          ...course,
          aiSummary: {
            ...parsed,
            generatedAt: new Date().toISOString(),
            sourceFileName: latestSyllabus.fileName,
          },
        },
        dispatch,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setGenerating(false);
    }
  };

  const summary = course.aiSummary;
  // A summary generated from a since-deleted/replaced file is still shown -
  // it's better to have slightly stale info clearly labeled with its source
  // than to silently discard a real Anthropic result.
  const isStale =
    !!summary && !!latestSyllabus && summary.sourceFileName !== latestSyllabus.fileName;

  // CO-4: this card used to return null with no syllabus on file, so a fresh
  // course page showed nothing between the dropzone and Tasks - zero
  // indication that "read your syllabus and flag what to watch for" (the
  // app's namesake feature) exists at all. A locked/teaser state - visually
  // distinct (dashed, muted) from both the populated and the
  // ready-to-generate states below - reads as "not yet" instead of
  // "broken/missing".
  if (!latestSyllabus) {
    return (
      <Card accent="none" className="rounded-2xl border-dashed p-6 opacity-90">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-muted-foreground">AI Summary</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Upload a syllabus above to get an AI summary and a watch-out-for list.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-foreground">AI Summary</h2>
        </div>
        <CardActionButton variant="solid" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : summary ? 'Regenerate' : 'Generate'}
        </CardActionButton>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!summary && !generating && !error && (
        <p className="text-sm text-muted-foreground">
          Get a plain-English summary and a list of things to watch out for, generated from{' '}
          {latestSyllabus.fileName}.
        </p>
      )}

      {generating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Reading {latestSyllabus.fileName}…
        </div>
      )}

      {summary && !generating && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-foreground">{summary.summary}</p>

          {summary.importantNotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Watch out for
              </p>
              <ul className="space-y-2">
                {summary.importantNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="mt-0.5 shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABEL[note.category]}
                    </span>
                    <span className="leading-relaxed">{note.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Generated {formatRelativeTime(summary.generatedAt)} from {summary.sourceFileName}
            {isStale && ' (a newer syllabus has been uploaded since)'}
          </p>
        </div>
      )}
    </Card>
  );
}
