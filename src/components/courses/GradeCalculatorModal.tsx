'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import {
  GradeCategory,
  calculateCurrentWeightedGrade,
  calculateRequiredFinalScore,
  calculateSemesterGpa,
  STANDARD_GRADE_SCALE,
} from '@/lib/academic/gradeMath';

export interface GradeCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCourseId?: string;
}

const DEFAULT_CATEGORIES: GradeCategory[] = [
  { id: 'cat-1', name: 'Homework & Problem Sets', weight: 25, score: 92 },
  { id: 'cat-2', name: 'Midterm Exam', weight: 25, score: 86 },
  { id: 'cat-3', name: 'Projects & Labs', weight: 20, score: 95 },
];

export function GradeCalculatorModal({
  isOpen,
  onClose,
  initialCourseId,
}: GradeCalculatorModalProps) {
  const { state } = useAppState();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
  const [categories, setCategories] = useState<GradeCategory[]>(DEFAULT_CATEGORIES);
  const [finalExamWeight, setFinalExamWeight] = useState<number>(30);
  const [targetPercentage, setTargetPercentage] = useState<number>(93.0); // Target 'A'
  const [activeTab, setActiveTab] = useState<'course' | 'semester'>('course');

  // Initialize course selection
  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    } else if (state.courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(state.courses[0].id);
    }
  }, [initialCourseId, state.courses, selectedCourseId]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Math Calculations
  const currentGrade = useMemo(() => {
    return calculateCurrentWeightedGrade(categories);
  }, [categories]);

  const finalExamTarget = useMemo(() => {
    return calculateRequiredFinalScore(categories, finalExamWeight, targetPercentage);
  }, [categories, finalExamWeight, targetPercentage]);

  // Total weight check
  const totalWeight = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.weight || 0), 0) + finalExamWeight;
  }, [categories, finalExamWeight]);

  // Semester GPA Calculation
  const semesterGpaResult = useMemo(() => {
    const coursesList = state.courses.map((course) => {
      const cr = (course as { credits?: number }).credits ?? 3;
      if (course.id === selectedCourseId) {
        return { credits: cr, percentage: currentGrade.currentPercentage };
      }
      return { credits: cr, percentage: 88 }; // baseline estimated
    });
    return calculateSemesterGpa(coursesList);
  }, [state.courses, selectedCourseId, currentGrade.currentPercentage]);

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
    setCategories(DEFAULT_CATEGORIES);
    setFinalExamWeight(30);
    setTargetPercentage(93.0);
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
      <Card accent="none" className="relative w-full max-w-2xl overflow-hidden transition-all my-8">
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
              {/* Current Standing & Target Result Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Current Standing Card */}
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Standing
                    </span>
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                      {currentGrade.letterGrade} ({currentGrade.gpaPoints} GPA)
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {currentGrade.currentPercentage}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({currentGrade.totalCompletedWeight}% weight evaluated)
                    </span>
                  </div>
                </div>

                {/* Final Exam Target Required Card */}
                <div
                  className={`rounded-xl border p-4 shadow-sm flex flex-col justify-between ${
                    finalExamTarget.status === 'already_achieved'
                      ? 'border-load-low/40 bg-load-low/10'
                      : finalExamTarget.status === 'impossible'
                        ? 'border-destructive/40 bg-destructive/10'
                        : finalExamTarget.status === 'challenging'
                          ? 'border-load-medium/40 bg-load-medium/10'
                          : 'border-primary/40 bg-primary/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Final Exam Target Score
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                        finalExamTarget.status === 'already_achieved'
                          ? 'bg-load-low/20 text-load-low'
                          : finalExamTarget.status === 'impossible'
                            ? 'bg-destructive/20 text-destructive'
                            : finalExamTarget.status === 'challenging'
                              ? 'bg-load-medium/20 text-load-medium'
                              : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {finalExamTarget.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {finalExamTarget.requiredFinalScore}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      needed on Final ({finalExamWeight}% weight)
                    </span>
                  </div>
                </div>
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
                      onClick={() => setTargetPercentage(grade.minPercentage)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
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

                <div className="space-y-2">
                  {categories.map((cat, idx) => (
                    <div
                      key={cat.id || idx}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-sm"
                    >
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
                            className="w-14 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-center font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`score-${idx}`} className="text-xs text-muted-foreground">
                            Score:
                          </label>
                          <input
                            id={`score-${idx}`}
                            type="number"
                            min="0"
                            max="150"
                            value={cat.score}
                            onChange={(e) => handleUpdateCategory(idx, 'score', e.target.value)}
                            className="w-14 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-center font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                  ))}

                  {/* Final Exam Category Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                        FINAL
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        Final Exam / Capstone
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
                  const percent = isCurrent ? currentGrade.currentPercentage : 88;
                  const letter = isCurrent ? currentGrade.letterGrade : 'B+';
                  const gpaPts = isCurrent ? currentGrade.gpaPoints : 3.3;

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
                        <div>
                          <span className="text-sm font-extrabold text-foreground">{percent}%</span>
                          <p className="text-xs font-semibold text-primary">
                            {letter} ({gpaPts} pts)
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
