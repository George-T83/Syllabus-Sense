'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  GradeCategory,
  calculateCurrentWeightedGrade,
  calculateGradeFloorCeiling,
  calculateRequiredFinalScore,
  calculateSemesterGpa,
  deriveCategoriesFromScheduleItems,
  projectCourseGrade,
  remainingWorkFromScheduleItems,
  STANDARD_GRADE_SCALE,
} from '@/lib/academic/gradeMath';
import { GradeOutcomeDial, RemainingScoreSlider } from '@/components/courses/GradeOutcome';
import { useGradeScenarios } from '@/lib/firestore/useGradeScenarios';
import { saveGradeScenario, deleteGradeScenario } from '@/lib/firestore/gradeScenarios';
import type { ScheduleItem } from '@/types/schedule';

export interface GradeCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCourseId?: string;
}

/** A friendly, editable starting point for a course with no graded items on
 * record yet - distinct from `deriveCategoriesFromScheduleItems`'s real
 * data, which returns an empty array in that case. Labeled generically since
 * there's nothing course-specific to seed it with. */
const STARTER_CATEGORIES: GradeCategory[] = [
  { id: 'starter-1', name: 'Homework & Problem Sets', weight: 25, score: 90 },
  { id: 'starter-2', name: 'Midterm Exam', weight: 25, score: 90 },
  { id: 'starter-3', name: 'Projects & Labs', weight: 20, score: 90 },
];

const CATEGORY_BAR_COLORS = [
  'bg-primary',
  'bg-load-medium',
  'bg-load-low',
  'bg-load-high',
  'bg-accent',
  'bg-load-critical',
];

export function GradeCalculatorModal({
  isOpen,
  onClose,
  initialCourseId,
}: GradeCalculatorModalProps) {
  const { state } = useAppState();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [finalExamWeight, setFinalExamWeight] = useState<number>(30);
  const [targetPercentage, setTargetPercentage] = useState<number>(93.0); // Target 'A'
  /** The what-if: the average score on everything still ahead. */
  const [remainingScore, setRemainingScore] = useState<number>(85);
  const [activeTab, setActiveTab] = useState<'course' | 'semester'>('course');
  const [savingScenario, setSavingScenario] = useState(false);
  const [scenarioNameDraft, setScenarioNameDraft] = useState('');
  const [deletingScenarioId, setDeletingScenarioId] = useState<string | null>(null);

  const scenarios = useGradeScenarios(user?.uid, selectedCourseId);

  // Initialize course selection. Only reacts to `initialCourseId` actually
  // changing (e.g. opening the modal from a different course's page) or the
  // course list loading in - never to the user's own dropdown selection,
  // which would otherwise get immediately overwritten back to
  // `initialCourseId` on every change.
  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    } else if (state.courses.length > 0) {
      setSelectedCourseId((prev) => prev || state.courses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCourseId, state.courses.length]);

  /** A course's real standing, derived from its own graded schedule items -
   * the actual source of truth the simulator seeds itself from, and what
   * the Semester tab uses for every course, not just the one being edited. */
  const realCategoriesFor = (courseId: string): GradeCategory[] =>
    deriveCategoriesFromScheduleItems(
      state.scheduleItems.filter((i: ScheduleItem) => i.courseId === courseId),
    );

  const itemsFor = (courseId: string): ScheduleItem[] =>
    state.scheduleItems.filter((i: ScheduleItem) => i.courseId === courseId);

  /** What's still ahead for the selected course - its ungraded weighted
   * items - so the final's weight comes from the syllabus, not a guess. */
  const remainingWork = useMemo(
    () => remainingWorkFromScheduleItems(itemsFor(selectedCourseId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCourseId, state.scheduleItems],
  );

  const hasRealDataForSelectedCourse = useMemo(
    () => realCategoriesFor(selectedCourseId).length > 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCourseId, state.scheduleItems],
  );

  // Re-seed the working categories from real data whenever the selected
  // course changes - each course gets its own real starting point rather
  // than carrying over whatever was being simulated for the last one.
  useEffect(() => {
    if (!selectedCourseId) return;
    seedFromCourse(selectedCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  /** Real standing, the syllabus weight still ahead, and a slider that
   * starts at "keep doing what you're doing" (your current average). */
  function seedFromCourse(courseId: string) {
    const real = realCategoriesFor(courseId);
    const seeded = real.length > 0 ? real : STARTER_CATEGORIES;
    setCategories(seeded);
    const remaining = remainingWorkFromScheduleItems(itemsFor(courseId));
    setFinalExamWeight(real.length > 0 ? remaining.weight : 30);
    setRemainingScore(
      Math.round(Math.min(100, calculateCurrentWeightedGrade(seeded).currentPercentage)),
    );
  }

  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  // Math Calculations
  const currentGrade = useMemo(() => {
    return calculateCurrentWeightedGrade(categories);
  }, [categories]);

  const finalExamTarget = useMemo(() => {
    return calculateRequiredFinalScore(categories, finalExamWeight, targetPercentage);
  }, [categories, finalExamWeight, targetPercentage]);

  const floorCeiling = useMemo(() => {
    return calculateGradeFloorCeiling(categories, finalExamWeight);
  }, [categories, finalExamWeight]);

  const projectedGrade = useMemo(
    () => projectCourseGrade(categories, finalExamWeight, remainingScore),
    [categories, finalExamWeight, remainingScore],
  );
  const currentPace = Math.round(Math.min(100, currentGrade.currentPercentage));
  const goalScore =
    finalExamTarget.requiredFinalScore >= 0 && finalExamTarget.requiredFinalScore <= 100
      ? Math.ceil(finalExamTarget.requiredFinalScore)
      : null;
  const remainingLabel = hasRealDataForSelectedCourse
    ? remainingWork.titles.length === 1
      ? `the ${remainingWork.titles[0]}`
      : remainingWork.titles.length > 1
        ? `the remaining ${remainingWork.titles.length} graded items`
        : "what's left"
    : 'the Final Exam';

  // Total weight check
  const totalWeight = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.weight || 0), 0) + finalExamWeight;
  }, [categories, finalExamWeight]);

  // Semester GPA Calculation - every enrolled course's REAL current standing
  // from its own graded items, except the course being actively simulated,
  // which uses the live what-if numbers so adjusting it here is reflected
  // immediately in the semester projection too.
  const semesterGpaResult = useMemo(() => {
    const coursesList = state.courses.map((course) => {
      const cr = course.credits ?? 3;
      if (course.id === selectedCourseId) {
        return { credits: cr, percentage: projectedGrade };
      }
      const real = realCategoriesFor(course.id);
      if (real.length === 0) return { credits: cr, percentage: undefined };
      return { credits: cr, percentage: calculateCurrentWeightedGrade(real).currentPercentage };
    });
    return calculateSemesterGpa(coursesList.filter((c) => c.percentage !== undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courses, state.scheduleItems, selectedCourseId, projectedGrade]);

  // Category handlers
  const handleUpdateCategory = (
    index: number,
    field: keyof GradeCategory,
    value: string | number,
  ) => {
    setCategories((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: typeof value === 'string' ? Number(value) || 0 : value,
      };
      return next;
    });
  };

  const handleAddCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        id: `cat-${Date.now()}`,
        name: `Assignment Category ${prev.length + 1}`,
        weight: 10,
        score: 85,
      },
    ]);
  };

  const handleDeleteCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    seedFromCourse(selectedCourseId);
    setTargetPercentage(93.0);
  };

  /** Picking a goal swings the needle to the score that goal needs. */
  const handlePickTarget = (percentage: number) => {
    setTargetPercentage(percentage);
    const needed = calculateRequiredFinalScore(
      categories,
      finalExamWeight,
      percentage,
    ).requiredFinalScore;
    setRemainingScore(Math.max(0, Math.min(100, Math.ceil(needed))));
  };

  const handleSaveScenario = async () => {
    if (!user || !selectedCourseId || !scenarioNameDraft.trim()) return;
    setSavingScenario(true);
    try {
      await saveGradeScenario(user.uid, selectedCourseId, {
        name: scenarioNameDraft.trim(),
        categories,
        finalExamWeight,
        targetPercentage,
        remainingScore,
      });
      showSuccess('Scenario saved', `"${scenarioNameDraft.trim()}" is ready to reload anytime.`);
      setScenarioNameDraft('');
    } catch (err) {
      showError('Could not save this scenario', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingScenario(false);
    }
  };

  const handleLoadScenario = (scenarioId: string) => {
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setCategories(scenario.categories);
    setFinalExamWeight(scenario.finalExamWeight);
    setTargetPercentage(scenario.targetPercentage);
    if (typeof scenario.remainingScore === 'number') setRemainingScore(scenario.remainingScore);
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!user || !selectedCourseId) return;
    setDeletingScenarioId(scenarioId);
    try {
      await deleteGradeScenario(user.uid, selectedCourseId, scenarioId);
    } catch (err) {
      showError('Could not delete this scenario', err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingScenarioId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What-If Grade Simulator & Target GPA Calculator"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-opacity overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card
        ref={dialogRef}
        accent="none"
        opaque
        className="relative w-full max-w-2xl overflow-hidden transition-all my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
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
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                What-If Grade Simulator & GPA Solver
              </h2>
              <p className="text-xs text-muted-foreground">
                Model category weights & calculate required final exam scores
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close grade calculator"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab & Course Selection Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-5 py-2.5 bg-muted/10">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('course')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'course'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Course Target Solver
            </button>
            <button
              onClick={() => setActiveTab('semester')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'semester'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Semester GPA Impact
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="course-select" className="text-xs font-medium text-muted-foreground">
              Course:
            </label>
            <select
              id="course-select"
              aria-label="Select course"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              {state.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body Content */}
        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-5">
          {activeTab === 'course' ? (
            <>
              {/* Data provenance - is this the student's real standing, or a
                  starter template they haven't customized yet? */}
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  hasRealDataForSelectedCourse
                    ? 'border-load-low/30 bg-load-low/10 text-load-low'
                    : 'border-load-medium/30 bg-load-medium/10 text-load-medium'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    hasRealDataForSelectedCourse ? 'bg-load-low' : 'bg-load-medium'
                  }`}
                  aria-hidden="true"
                />
                {hasRealDataForSelectedCourse
                  ? 'Seeded from your actual graded work for this course - edit anything below to simulate a change.'
                  : "No graded scores on record for this course yet - showing an editable starter template. Enter scores on graded tasks and they'll appear here automatically."}
              </div>

              {/* Saved Scenarios */}
              <div className="rounded-xl border border-border/40 bg-muted/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Saved Scenarios
                  </span>
                </div>
                {scenarios.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {scenarios.map((scenario) => (
                      <div
                        key={scenario.id}
                        className="flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-1"
                      >
                        <button
                          onClick={() => handleLoadScenario(scenario.id)}
                          className="text-xs font-semibold text-foreground hover:text-primary"
                        >
                          {scenario.name}
                        </button>
                        <button
                          onClick={() => handleDeleteScenario(scenario.id)}
                          disabled={deletingScenarioId === scenario.id}
                          aria-label={`Delete scenario ${scenario.name}`}
                          className="rounded-full p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={scenarioNameDraft}
                    onChange={(e) => setScenarioNameDraft(e.target.value)}
                    placeholder='Name this scenario, e.g. "Best case"'
                    className="flex-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleSaveScenario}
                    disabled={!scenarioNameDraft.trim() || savingScenario}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingScenario ? 'Saving…' : 'Save current'}
                  </button>
                </div>
              </div>

              {/* The outcome: a dial whose needle follows the what-if slider,
                  over the span still reachable (floor to ceiling). */}
              <div className="relative overflow-hidden rounded-2xl border border-border surface-luminous p-5 shadow-card">
                <GradeOutcomeDial
                  floor={floorCeiling.floorPercentage}
                  ceiling={floorCeiling.ceilingPercentage}
                  projected={
                    floorCeiling.isLocked ? currentGrade.currentPercentage : projectedGrade
                  }
                  target={targetPercentage}
                  locked={floorCeiling.isLocked}
                />
                {!floorCeiling.isLocked && (
                  <div className="mt-4 space-y-3">
                    <RemainingScoreSlider
                      categories={categories}
                      remainingWeight={finalExamWeight}
                      value={remainingScore}
                      onChange={setRemainingScore}
                      goalScore={goalScore}
                      goalLetter={finalExamTarget.targetGrade}
                      remainingLabel={remainingLabel}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRemainingScore(currentPace)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        Keep my current pace · {currentPace}%
                      </button>
                      {goalScore !== null && (
                        <button
                          type="button"
                          onClick={() => setRemainingScore(goalScore)}
                          className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                          What {finalExamTarget.targetGrade} needs · {goalScore}%
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Current standing
                    </dt>
                    <dd className="mt-0.5 text-sm text-foreground">
                      <span className="font-semibold tabular-nums">
                        {currentGrade.currentPercentage}%
                      </span>{' '}
                      · {currentGrade.letterGrade}
                      <span className="block text-[11px] text-muted-foreground">
                        {currentGrade.totalCompletedWeight}% of the grade in
                      </span>
                    </dd>
                  </div>
                  {!floorCeiling.isLocked && (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Guaranteed range
                      </dt>
                      <dd className="mt-0.5 text-sm text-foreground">
                        <span className="font-semibold tabular-nums">
                          {floorCeiling.floorPercentage}%
                        </span>{' '}
                        –{' '}
                        <span className="font-semibold tabular-nums">
                          {floorCeiling.ceilingPercentage}%
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {floorCeiling.floorLetterGrade} if you score 0%,{' '}
                          {floorCeiling.ceilingLetterGrade} if you score 100%
                        </span>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Needed for {finalExamTarget.targetGrade}
                    </dt>
                    <dd
                      className={`mt-0.5 text-sm font-semibold tabular-nums ${
                        finalExamTarget.status === 'impossible'
                          ? 'text-destructive'
                          : finalExamTarget.status === 'already_achieved'
                            ? 'text-load-low'
                            : 'text-foreground'
                      }`}
                    >
                      {finalExamTarget.status === 'already_achieved'
                        ? 'Locked in'
                        : finalExamTarget.status === 'impossible'
                          ? `Out of reach (${finalExamTarget.requiredFinalScore}%)`
                          : `${finalExamTarget.requiredFinalScore}% on what's left`}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Target Grade Selector Pills */}
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 space-y-2">
                <span className="text-xs font-semibold text-foreground">
                  Target Letter Grade Goal:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STANDARD_GRADE_SCALE.slice(0, 8).map((grade) => (
                    <button
                      key={grade.letter}
                      onClick={() => handlePickTarget(grade.minPercentage)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                        targetPercentage === grade.minPercentage
                          ? 'bg-primary text-primary-foreground shadow-md scale-105'
                          : 'bg-card border border-border text-muted-foreground hover:border-primary hover:text-foreground'
                      }`}
                    >
                      {grade.letter} ({grade.minPercentage}%)
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {finalExamTarget.statusMessage}
                </p>
              </div>

              {/* Assessment Categories Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Grading Categories & Weights
                  </h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${totalWeight === 100 ? 'text-load-low' : 'text-load-medium'}`}
                    >
                      Total Weight: {totalWeight}% {totalWeight !== 100 && '(Adjust to 100%)'}
                    </span>
                    <CardActionButton variant="solid" withPlus onClick={handleAddCategory}>
                      Add Category
                    </CardActionButton>
                  </div>
                </div>

                {/* Segmented bar - each category's share of the grade
                    computed so far, at a glance before reading the table. */}
                {categories.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      {categories.map((cat, idx) => (
                        <div
                          key={cat.id || idx}
                          className={CATEGORY_BAR_COLORS[idx % CATEGORY_BAR_COLORS.length]}
                          style={{
                            width: `${totalWeight > 0 ? ((cat.weight || 0) / totalWeight) * 100 : 0}%`,
                          }}
                          title={`${cat.name}: ${cat.weight}% weight`}
                        />
                      ))}
                      <div
                        className="bg-border"
                        style={{
                          width: `${totalWeight > 0 ? (finalExamWeight / totalWeight) * 100 : 0}%`,
                        }}
                        title={`Final Exam: ${finalExamWeight}% weight`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {categories.map((cat, idx) => (
                        <span
                          key={cat.id || idx}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground"
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${CATEGORY_BAR_COLORS[idx % CATEGORY_BAR_COLORS.length]}`}
                          />
                          {cat.name}
                        </span>
                      ))}
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-border" />
                        Final Exam
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {categories.map((cat, idx) => (
                    <div
                      key={cat.id || idx}
                      className="space-y-2.5 rounded-xl border border-border/50 bg-card p-3 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <input
                          type="text"
                          value={cat.name}
                          aria-label={`Category ${idx + 1} Name`}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCategories((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], name: val };
                              return next;
                            });
                          }}
                          className="flex-1 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
                        />

                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="flex items-center gap-1.5">
                            <label
                              htmlFor={`weight-${idx}`}
                              className="text-xs text-muted-foreground"
                            >
                              Weight:
                            </label>
                            <input
                              id={`weight-${idx}`}
                              type="number"
                              min="0"
                              max="100"
                              value={cat.weight}
                              onChange={(e) => handleUpdateCategory(idx, 'weight', e.target.value)}
                              className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-center font-bold tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <label
                              htmlFor={`score-${idx}`}
                              className="text-xs text-muted-foreground"
                            >
                              Score:
                            </label>
                            <input
                              id={`score-${idx}`}
                              type="number"
                              min="0"
                              max="150"
                              value={cat.score}
                              onChange={(e) => handleUpdateCategory(idx, 'score', e.target.value)}
                              className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-center font-bold tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>

                          <button
                            onClick={() => handleDeleteCategory(idx)}
                            aria-label={`Delete ${cat.name}`}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors ml-auto"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.min(100, Math.max(0, cat.score || 0))}
                        onChange={(e) => handleUpdateCategory(idx, 'score', Number(e.target.value))}
                        aria-label={`${cat.name} score`}
                        aria-valuetext={`${cat.name}: ${cat.score}%`}
                        className="grade-slider grade-slider-thin w-full"
                        style={{
                          background: `linear-gradient(90deg, hsl(var(--primary)) ${Math.min(100, cat.score || 0)}%, hsl(var(--muted)) ${Math.min(100, cat.score || 0)}%)`,
                        }}
                      />
                    </div>
                  ))}

                  {/* Final Exam Category Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                        FINAL
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {hasRealDataForSelectedCourse && remainingWork.titles.length > 0
                          ? remainingWork.titles.join(', ')
                          : 'Final Exam / Capstone'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="final-weight" className="text-xs text-muted-foreground">
                          Weight:
                        </label>
                        <input
                          id="final-weight"
                          type="number"
                          min="1"
                          max="100"
                          value={finalExamWeight}
                          onChange={(e) => setFinalExamWeight(Number(e.target.value) || 0)}
                          className="w-14 rounded-lg border border-primary/40 bg-background px-2 py-1 text-xs text-center font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-primary">Required:</span>
                        <span className="text-xs font-extrabold text-primary">
                          {finalExamTarget.requiredFinalScore}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Semester GPA Projection Tab */
            <div className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Projected Semester GPA
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-primary">
                      {semesterGpaResult.gpa.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / 4.00 ({semesterGpaResult.totalCredits} total credits)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Quality Points</span>
                  <p className="text-sm font-bold text-foreground">
                    {semesterGpaResult.qualityPoints.toFixed(1)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Enrolled Course Projections
                </span>
                {state.courses.map((course) => {
                  const isCurrent = course.id === selectedCourseId;
                  const credits = (course as { credits?: number }).credits ?? 3;
                  const real = isCurrent ? null : realCategoriesFor(course.id);
                  const realGrade =
                    real && real.length > 0 ? calculateCurrentWeightedGrade(real) : null;
                  const hasData = isCurrent || realGrade !== null;
                  const percent = isCurrent
                    ? currentGrade.currentPercentage
                    : realGrade?.currentPercentage;
                  const letter = isCurrent ? currentGrade.letterGrade : realGrade?.letterGrade;
                  const gpaPts = isCurrent ? currentGrade.gpaPoints : realGrade?.gpaPoints;

                  return (
                    <div
                      key={course.id}
                      className={`flex items-center justify-between rounded-xl border p-3 ${
                        isCurrent
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/40 bg-card'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-bold text-foreground">{course.code}</span>
                        <p className="text-xs text-muted-foreground">
                          {course.title} • {credits} cr
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        {hasData ? (
                          <div>
                            <span className="text-sm font-extrabold text-foreground">
                              {percent}%
                            </span>
                            <p className="text-xs font-semibold text-primary">
                              {letter} ({gpaPts} pts)
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No grades yet</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Courses with no graded work yet are excluded from the GPA above rather than
                  guessed at.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-5 py-3 text-xs">
          <button
            onClick={handleReset}
            className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Reset to Syllabus Defaults
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </Card>
    </div>
  );
}

export default GradeCalculatorModal;
