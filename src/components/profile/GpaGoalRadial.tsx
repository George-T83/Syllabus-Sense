'use client';

import React, { useState, useMemo } from 'react';
import {
  computeGpaGoalTarget,
  CourseGradeEntry,
  LetterGrade,
  GRADE_POINT_MAP,
} from '@/lib/gpa/gpaMath';

export interface GpaGoalRadialProps {
  initialPriorGpa?: number;
  initialPriorCredits?: number;
  initialTargetGpa?: number;
  initialCourses?: CourseGradeEntry[];
}

const DEFAULT_COURSES: CourseGradeEntry[] = [
  { courseId: 'c-1', courseCode: 'CS 301', title: 'Data Structures & Algorithms', credits: 4, grade: 'A' },
  { courseId: 'c-2', courseCode: 'MATH 240', title: 'Linear Algebra', credits: 4, grade: 'A-' },
  { courseId: 'c-3', courseCode: 'PHYS 211', title: 'University Physics I', credits: 4, grade: 'B+' },
  { courseId: 'c-4', courseCode: 'ENGL 102', title: 'Academic Writing', credits: 3, grade: 'A' },
];

export function GpaGoalRadial({
  initialPriorGpa = 3.42,
  initialPriorCredits = 45,
  initialTargetGpa = 3.60,
  initialCourses = DEFAULT_COURSES,
}: GpaGoalRadialProps) {
  const [priorGpa, setPriorGpa] = useState<number>(initialPriorGpa);
  const [priorCredits, setPriorCredits] = useState<number>(initialPriorCredits);
  const [targetGpa, setTargetGpa] = useState<number>(initialTargetGpa);
  const [courses, setCourses] = useState<CourseGradeEntry[]>(initialCourses);

  const goalResult = useMemo(() => {
    return computeGpaGoalTarget({
      priorCumulativeGpa: priorGpa,
      priorEarnedCredits: priorCredits,
      currentCourses: courses,
      targetCumulativeGpa: targetGpa,
    });
  }, [priorGpa, priorCredits, targetGpa, courses]);

  const handleGradeChange = (courseId: string, newGrade: LetterGrade) => {
    setCourses((prev) =>
      prev.map((c) => (c.courseId === courseId ? { ...c, grade: newGrade } : c))
    );
  };

  const handleCreditsChange = (courseId: string, newCredits: number) => {
    setCourses((prev) =>
      prev.map((c) => (c.courseId === courseId ? { ...c, credits: Math.max(0, newCredits) } : c))
    );
  };

  // SVG Radial Ring Math
  const radiusOuter = 78;
  const radiusInner = 58;
  const circumferenceOuter = 2 * Math.PI * radiusOuter;
  const circumferenceInner = 2 * Math.PI * radiusInner;

  // 4.0 scale offset calculations
  const termGpaFraction = Math.min(1, Math.max(0, goalResult.currentTermGpa / 4.0));
  const strokeDashoffsetOuter = circumferenceOuter - termGpaFraction * circumferenceOuter;

  const cumGpaFraction = Math.min(1, Math.max(0, goalResult.projectedCumulativeGpa / 4.0));
  const strokeDashoffsetInner = circumferenceInner - cumGpaFraction * circumferenceInner;

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m-6 0V5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            Semester GPA Goal & Quality Points Tracker
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Simulate term quality points and track progress toward your graduation GPA target.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="gpa-status-badge"
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
              goalResult.status === 'ahead'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : goalResult.status === 'on_track'
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : goalResult.status === 'at_risk'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {goalResult.status === 'ahead'
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
        <div className="lg:col-span-5 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col items-center justify-center space-y-4 shadow-xl backdrop-blur-xl">
          <div className="relative flex items-center justify-center">
            {/* SVG Dual Concentric Gauge */}
            <svg
              className="w-56 h-56 transform -rotate-90"
              viewBox="0 0 200 200"
              role="img"
              aria-label={`Current Term GPA: ${goalResult.currentTermGpa}, Projected Cumulative: ${goalResult.projectedCumulativeGpa}`}
            >
              {/* Outer Track (Term GPA) */}
              <circle
                cx="100"
                cy="100"
                r={radiusOuter}
                className="stroke-slate-800"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Outer Progress (Term GPA) */}
              <circle
                cx="100"
                cy="100"
                r={radiusOuter}
                className="stroke-indigo-500 transition-all duration-700 ease-out"
                strokeWidth="10"
                strokeDasharray={circumferenceOuter}
                strokeDashoffset={strokeDashoffsetOuter}
                strokeLinecap="round"
                fill="transparent"
              />

              {/* Inner Track (Cumulative GPA) */}
              <circle
                cx="100"
                cy="100"
                r={radiusInner}
                className="stroke-slate-800"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Inner Progress (Cumulative GPA) */}
              <circle
                cx="100"
                cy="100"
                r={radiusInner}
                className="stroke-cyan-400 transition-all duration-700 ease-out"
                strokeWidth="8"
                strokeDasharray={circumferenceInner}
                strokeDashoffset={strokeDashoffsetInner}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Central GPA Typography */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {goalResult.currentTermGpa.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                Term GPA
              </span>
              <span className="text-xs font-semibold text-slate-400 mt-1">
                Cumul: <strong className="text-cyan-300">{goalResult.projectedCumulativeGpa.toFixed(2)}</strong>
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-medium pt-2">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Term GPA ({goalResult.currentTermGpa.toFixed(2)})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>Projected Cumul ({goalResult.projectedCumulativeGpa.toFixed(2)})</span>
            </div>
          </div>

          {/* Advice callout */}
          <div className="w-full p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Goal Feasibility Advisor</span>
            </div>
            <p>{goalResult.advice}</p>
          </div>
        </div>

        {/* Right Side: Goal Configuration & Quality Point Sliders (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-5 shadow-xl backdrop-blur-xl">
          <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
            Academic Profile & Cumulative Target
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Prior Cumulative GPA
              </label>
              <input
                type="number"
                step="0.01"
                min="0.0"
                max="4.0"
                value={priorGpa}
                onChange={(e) => setPriorGpa(Number(e.target.value))}
                aria-label="Prior cumulative GPA"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Prior Earned Credits
              </label>
              <input
                type="number"
                min="0"
                max="200"
                value={priorCredits}
                onChange={(e) => setPriorCredits(Number(e.target.value))}
                aria-label="Prior earned credits"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
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
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Interactive Target Slider */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Goal Slider: {targetGpa.toFixed(2)}</span>
              <span>Needed Term GPA: <strong className="text-white">{goalResult.targetTermGpaNeeded ? goalResult.targetTermGpaNeeded.toFixed(2) : 'N/A'}</strong></span>
            </div>
            <input
              type="range"
              min="2.5"
              max="4.0"
              step="0.05"
              value={targetGpa}
              onChange={(e) => setTargetGpa(Number(e.target.value))}
              aria-label="Target GPA Slider"
              className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Enrolled Courses Grade Simulator Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Current Term Enrolled Courses ({courses.length})
              </span>
              <span className="text-xs font-mono text-slate-400">
                {goalResult.totalTermCredits} Credits • {goalResult.totalTermQualityPoints} QP
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Course</th>
                    <th className="px-3.5 py-2.5">Credits</th>
                    <th className="px-3.5 py-2.5">Projected Grade</th>
                    <th className="px-3.5 py-2.5 text-right">Quality Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {courses.map((course) => {
                    const points = (GRADE_POINT_MAP[course.grade] || 0) * course.credits;
                    return (
                      <tr key={course.courseId} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-3.5 py-2.5 font-medium text-white">
                          <span className="font-bold text-indigo-300 block">{course.courseCode}</span>
                          <span className="text-slate-400 text-[11px] truncate block max-w-[180px]">
                            {course.title}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={course.credits}
                            onChange={(e) => handleCreditsChange(course.courseId, Number(e.target.value))}
                            aria-label={`${course.courseCode} credits`}
                            className="w-14 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3.5 py-2.5">
                          <select
                            value={course.grade}
                            onChange={(e) => handleGradeChange(course.courseId, e.target.value as LetterGrade)}
                            aria-label={`${course.courseCode} grade`}
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-h-[36px]"
                          >
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
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-indigo-300">
                          {points.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
