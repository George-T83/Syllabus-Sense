'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { computeGpaGoalTarget, LetterGrade, GRADE_POINT_MAP } from '@/lib/gpa/gpaMath';
import type { GpaGoalCourse } from '@/lib/gpa/termCourses';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RingGauge, type RingGaugeLevel } from '@/components/ui/RingGauge';

export interface GpaGoalRadialProps {
  /** Earlier-terms history. Optional: left blank, the simulator treats this
   * as a first term rather than assuming a GPA the student never entered. */
  initialPriorGpa?: number;
  initialPriorCredits?: number;
  initialTargetGpa?: number;
  /** The student's real courses for the term being simulated. */
  courses?: GpaGoalCourse[];
  termLabel?: string;
}

interface RowOverride {
  grade?: LetterGrade | null;
  credits?: number;
}

export function GpaGoalRadial({
  initialPriorGpa,
  initialPriorCredits,
  initialTargetGpa = 3.6,
  courses = [],
  termLabel,
}: GpaGoalRadialProps) {
  const [priorGpaText, setPriorGpaText] = useState<string>(
    initialPriorGpa === undefined ? '' : String(initialPriorGpa),
  );
  const [priorCreditsText, setPriorCreditsText] = useState<string>(
    initialPriorCredits === undefined ? '' : String(initialPriorCredits),
  );
  const [targetGpa, setTargetGpa] = useState<number>(initialTargetGpa);
  // What-if edits only. The rows themselves come from `courses` on every
  // render, so grades and courses entered elsewhere show up here live.
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});

  const rows = useMemo<GpaGoalCourse[]>(
    () => courses.map((c) => ({ ...c, ...overrides[c.courseId] })),
    [courses, overrides],
  );

  const priorGpaNum = Number(priorGpaText);
  const priorCreditsNum = Number(priorCreditsText);
  const hasPrior =
    priorGpaText.trim() !== '' &&
    priorCreditsText.trim() !== '' &&
    Number.isFinite(priorGpaNum) &&
    Number.isFinite(priorCreditsNum) &&
    priorCreditsNum > 0;

  const goalResult = useMemo(() => {
    return computeGpaGoalTarget({
      priorCumulativeGpa: hasPrior ? priorGpaNum : 0,
      priorEarnedCredits: hasPrior ? priorCreditsNum : 0,
      currentCourses: rows,
      targetCumulativeGpa: targetGpa,
    });
  }, [hasPrior, priorGpaNum, priorCreditsNum, rows, targetGpa]);

  const hasGrades = goalResult.totalTermCredits > 0;
  const noCourses = courses.length === 0;
  const termGpaText = hasGrades ? goalResult.currentTermGpa.toFixed(2) : '—';
  const cumGpaText = hasGrades ? goalResult.projectedCumulativeGpa.toFixed(2) : '—';
  const advice = !hasGrades
    ? noCourses
      ? 'Add a course to start tracking your GPA.'
      : 'Enter a grade on one of your courses, or pick a what-if grade below, to see where your GPA lands.'
    : goalResult.advice;

  const handleGradeChange = (courseId: string, newGrade: LetterGrade | null) => {
    setOverrides((prev) => ({ ...prev, [courseId]: { ...prev[courseId], grade: newGrade } }));
  };

  const handleCreditsChange = (courseId: string, newCredits: number) => {
    setOverrides((prev) => ({
      ...prev,
      [courseId]: { ...prev[courseId], credits: Math.max(0, newCredits) },
    }));
  };

  // 4.0-scale fractions for the dual ring gauge below.
  const termGpaFraction = hasGrades ? Math.min(1, Math.max(0, goalResult.currentTermGpa / 4.0)) : 0;
  const cumGpaFraction = hasGrades
    ? Math.min(1, Math.max(0, goalResult.projectedCumulativeGpa / 4.0))
    : 0;

  // The cumulative ring carries the goal-tracking status as its color - the
  // term ring is just "how full is this term," the cumulative ring is
  // "are you on track," so it gets the semantic safe/warning/critical
  // treatment instead of an arbitrary second brand color.
  const cumulativeLevel: RingGaugeLevel = !hasGrades
    ? 'low'
    : goalResult.status === 'unreachable'
      ? 'critical'
      : goalResult.status === 'at_risk'
        ? 'medium'
        : 'low';
  const cumulativeTextClass =
    cumulativeLevel === 'critical'
      ? 'text-load-critical'
      : cumulativeLevel === 'medium'
        ? 'text-load-medium'
        : 'text-load-low';

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m-6 0V5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Semester GPA Goal & Quality Points Tracker
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Simulate term quality points and track progress toward your graduation GPA target.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="gpa-status-badge"
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
              !hasGrades
                ? 'bg-muted text-muted-foreground border-border'
                : goalResult.status === 'ahead'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : goalResult.status === 'on_track'
                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                    : goalResult.status === 'at_risk'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
            }`}
          >
            {!hasGrades
              ? 'No grades yet'
              : goalResult.status === 'ahead'
                ? 'Ahead of Goal'
                : goalResult.status === 'on_track'
                  ? 'On Track'
                  : goalResult.status === 'at_risk'
                    ? 'At Risk'
                    : 'Out of Reach'}
          </span>
        </div>
      </div>

      {/* Main Grid: Radial Gauge & Target Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Dual Radial Progress Rings (5 cols) */}
        <Card className="lg:col-span-5 p-6 flex flex-col items-center justify-center space-y-4">
          <div className="relative" style={{ width: 224, height: 224 }}>
            {/* Outer ring: current term GPA, brand gradient - just "how full
                is this term," no safe/warning framing needed. */}
            <div className="absolute inset-0 flex items-center justify-center">
              <RingGauge
                progress={termGpaFraction}
                variant="brand"
                size={224}
                radius={87}
                strokeWidth={10}
                aria-label={`Current term GPA: ${hasGrades ? `${termGpaText} of 4.0` : 'no grades yet'}`}
              />
            </div>
            {/* Inner ring: projected cumulative GPA, semantic - this is the
                number the goal-tracking status cares about, so it carries
                the safe/at-risk/out-of-reach color instead. */}
            <div className="absolute inset-0 flex items-center justify-center">
              <RingGauge
                progress={cumGpaFraction}
                level={cumulativeLevel}
                size={168}
                radius={65}
                strokeWidth={8}
                aria-label={`Projected cumulative GPA: ${hasGrades ? `${cumGpaText} of 4.0` : 'no grades yet'}`}
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-foreground tracking-tight">
                    {termGpaText}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gradient-brand">
                    Term GPA
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground mt-1">
                    Cumul: <strong className={cumulativeTextClass}>{cumGpaText}</strong>
                  </span>
                </div>
              </RingGauge>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-medium pt-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-brand" />
              <span>Term GPA ({termGpaText})</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  cumulativeLevel === 'critical'
                    ? 'bg-load-critical'
                    : cumulativeLevel === 'medium'
                      ? 'bg-load-medium'
                      : 'bg-load-low'
                }`}
              />
              <span>Projected Cumul ({cumGpaText})</span>
            </div>
          </div>

          {/* Advice callout */}
          <div className="w-full p-3.5 rounded-2xl bg-muted/50 border border-border text-xs text-foreground space-y-1">
            <div className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Goal Feasibility Advisor</span>
            </div>
            <p className="text-muted-foreground">{advice}</p>
          </div>
        </Card>

        {/* Right Side: Goal Configuration & Quality Point Sliders (7 cols) */}
        <Card className="lg:col-span-7 p-6 space-y-5">
          <h3 className="text-base font-bold text-foreground border-b border-border pb-3">
            Academic Profile & Cumulative Target
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Prior Cumulative GPA
              </label>
              <input
                type="number"
                step="0.01"
                min="0.0"
                max="4.0"
                value={priorGpaText}
                placeholder="None yet"
                onChange={(e) => setPriorGpaText(e.target.value)}
                aria-label="Prior cumulative GPA"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Prior Earned Credits
              </label>
              <input
                type="number"
                min="0"
                max="200"
                value={priorCreditsText}
                placeholder="None yet"
                onChange={(e) => setPriorCreditsText(e.target.value)}
                aria-label="Prior earned credits"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Target Cumulative Goal
              </label>
              <input
                type="number"
                step="0.01"
                min="2.0"
                max="4.0"
                value={targetGpa}
                onChange={(e) => setTargetGpa(Number(e.target.value))}
                aria-label="Target cumulative GPA"
                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <p className="-mt-2 text-[11px] text-muted-foreground">
            Optional. Fill in both prior fields to include earlier terms; leave them blank if this
            is your first term.
          </p>

          {/* Interactive Target Slider */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Goal Slider: {targetGpa.toFixed(2)}</span>
              <span>
                Needed Term GPA:{' '}
                <strong className="text-foreground">
                  {goalResult.targetTermGpaNeeded !== null
                    ? goalResult.targetTermGpaNeeded.toFixed(2)
                    : 'N/A'}
                </strong>
              </span>
            </div>
            <input
              type="range"
              min="2.5"
              max="4.0"
              step="0.05"
              value={targetGpa}
              onChange={(e) => setTargetGpa(Number(e.target.value))}
              aria-label="Target GPA Slider"
              className="w-full accent-indigo-500 cursor-pointer h-2 bg-muted rounded-lg"
            />
          </div>

          {/* Enrolled Courses Grade Simulator Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                {termLabel ? `${termLabel} courses` : 'Current term courses'} ({courses.length})
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {goalResult.totalTermCredits} Credits • {goalResult.totalTermQualityPoints} QP
              </span>
            </div>

            {noCourses ? (
              <div className="rounded-xl border border-border bg-muted/20">
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
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  }
                  title="No courses to simulate yet"
                  description="Add a course and enter some grades. Nothing here is estimated until you do."
                />
                <div className="pb-6 text-center">
                  <Link href="/courses" className="text-sm font-semibold text-primary underline">
                    Go to Courses
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-muted/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/80 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="px-3.5 py-2.5">Course</th>
                      <th className="px-3.5 py-2.5">Credits</th>
                      <th className="px-3.5 py-2.5">What-if Grade</th>
                      <th className="px-3.5 py-2.5 text-right">Quality Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {rows.map((course) => {
                      const points =
                        course.grade === null
                          ? null
                          : GRADE_POINT_MAP[course.grade] * course.credits;
                      return (
                        <tr key={course.courseId} className="hover:bg-muted/40 transition-colors">
                          <td className="px-3.5 py-2.5 font-medium text-foreground">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 block">
                              {course.courseCode}
                            </span>
                            <span className="text-muted-foreground text-[11px] truncate block max-w-[180px]">
                              {course.title}
                            </span>
                            <span className="text-muted-foreground text-[11px] block">
                              {course.standingNote ?? 'No grades entered yet'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={course.credits}
                              onChange={(e) =>
                                handleCreditsChange(course.courseId, Number(e.target.value))
                              }
                              aria-label={`${course.courseCode} credits`}
                              className="w-14 px-2 py-1 bg-background border border-border rounded-lg text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-3.5 py-2.5">
                            <select
                              value={course.grade ?? ''}
                              onChange={(e) =>
                                handleGradeChange(
                                  course.courseId,
                                  e.target.value === '' ? null : (e.target.value as LetterGrade),
                                )
                              }
                              aria-label={`${course.courseCode} grade`}
                              className="px-2 py-1 bg-background border border-border rounded-lg text-foreground font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-h-[36px]"
                            >
                              <option value="">Not graded yet</option>
                              <option value="A+">A+ (4.0)</option>
                              <option value="A">A (4.0)</option>
                              <option value="A-">A- (3.7)</option>
                              <option value="B+">B+ (3.3)</option>
                              <option value="B">B (3.0)</option>
                              <option value="B-">B- (2.7)</option>
                              <option value="C+">C+ (2.3)</option>
                              <option value="C">C (2.0)</option>
                              <option value="C-">C- (1.7)</option>
                              <option value="D+">D+ (1.3)</option>
                              <option value="D">D (1.0)</option>
                              <option value="F">F (0.0)</option>
                            </select>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {points === null ? '\u2014' : points.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
