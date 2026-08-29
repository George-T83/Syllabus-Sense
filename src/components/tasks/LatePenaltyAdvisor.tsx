'use client';

import React, { useState, useMemo } from 'react';
import {
  calculateLatePenalty,
  LatePolicyConfig,
  LatePenaltyResult,
} from '@/lib/policy/latePenalty';

export interface LatePenaltyAdvisorProps {
  courseCode?: string;
  assignmentTitle?: string;
  defaultRawScore?: number;
  policy?: LatePolicyConfig;
}

const DEFAULT_POLICY: LatePolicyConfig = {
  type: 'slip_days_grace',
  totalSlipDaysAllowed: 2,
  dailyDeductionPercent: 10,
  hardCutoffHours: 72,
  rawPolicyText:
    'Students are granted 2 free 24-hour slip days per semester. Subsequent late submissions incur a 10% penalty per day up to 72 hours, after which no credit is awarded.',
};

export function LatePenaltyAdvisor({
  courseCode = 'CS 301',
  assignmentTitle = 'Project 2: Graph Algorithms',
  defaultRawScore = 95,
  policy = DEFAULT_POLICY,
}: LatePenaltyAdvisorProps) {
  const [hoursLate, setHoursLate] = useState<number>(18);
  const [rawScore, setRawScore] = useState<number>(defaultRawScore);
  const [slipDaysUsedSoFar, setSlipDaysUsedSoFar] = useState<number>(0);

  const result: LatePenaltyResult = useMemo(() => {
    return calculateLatePenalty({
      rawScore,
      hoursLate,
      policy,
      slipDaysUsedSoFar,
    });
  }, [rawScore, hoursLate, policy, slipDaysUsedSoFar]);

  // Generate SVG curve points across 0 to 96 hours
  const curvePoints = useMemo(() => {
    const points: { hour: number; score: number }[] = [];
    for (let h = 0; h <= 96; h += 4) {
      const res = calculateLatePenalty({
        rawScore,
        hoursLate: h,
        policy,
        slipDaysUsedSoFar,
      });
      points.push({ hour: h, score: res.adjustedScore });
    }
    return points;
  }, [rawScore, policy, slipDaysUsedSoFar]);

  // SVG Chart Dimensions
  const chartWidth = 360;
  const chartHeight = 120;
  const padding = 20;

  const svgPath = useMemo(() => {
    if (curvePoints.length === 0) return '';
    return curvePoints
      .map((p, idx) => {
        const x = padding + (p.hour / 96) * (chartWidth - 2 * padding);
        const y = chartHeight - padding - (p.score / 100) * (chartHeight - 2 * padding);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [curvePoints]);

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {courseCode}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Late Submission Penalty & Grace Advisor
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {assignmentTitle} — Simulate late penalty decay and slip-day grace periods.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="penalty-status-badge"
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
              result.isPastHardCutoff
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : result.penaltyPercentage === 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {result.isPastHardCutoff
              ? 'Hard Cutoff (0 Credit)'
              : result.penaltyPercentage === 0
              ? '100% Full Credit'
              : `-${result.penaltyPercentage}% Late Penalty`}
          </span>
        </div>
      </div>

      {/* Main Grid: Interactive Sliders & Live Results */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Side: Interactive Sliders (6 cols) */}
        <div className="md:col-span-6 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-5 shadow-xl backdrop-blur-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Submission Parameters
          </h3>

          {/* Hours Late Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Late Duration</span>
              <span className="font-mono font-bold text-indigo-300">
                {hoursLate} hours ({result.daysLate} days)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="96"
              step="1"
              value={hoursLate}
              onChange={(e) => setHoursLate(Number(e.target.value))}
              aria-label="Hours Late Slider"
              className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>On Time (0h)</span>
              <span>24h (1d)</span>
              <span>48h (2d)</span>
              <span>72h (3d)</span>
              <span>96h (4d)</span>
            </div>
          </div>

          {/* Raw Score Slider */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Expected Raw Score</span>
              <span className="font-mono font-bold text-cyan-300">{rawScore}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={rawScore}
              onChange={(e) => setRawScore(Number(e.target.value))}
              aria-label="Expected Raw Score Slider"
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Slip Days Bank */}
          {policy.totalSlipDaysAllowed !== undefined && (
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Slip Days Used Prior:</span>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSlipDaysUsedSoFar(num)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        slipDaysUsedSoFar === num
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {num} Used
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                {result.slipDaysRemaining} slip days remaining after this assignment.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Grade Outcome & Decay Curve (6 cols) */}
        <div className="md:col-span-6 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Projected Final Recorded Grade
            </h3>

            {/* Score Comparison Display */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Raw Score</span>
                <span className="text-xl font-bold text-slate-300">{rawScore}%</span>
              </div>
              <div className="text-indigo-400 font-bold">→</div>
              <div>
                <span className="text-xs text-slate-400 block">Deduction</span>
                <span
                  className={`text-lg font-bold ${
                    result.penaltyPercentage > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  -{result.penaltyPercentage}%
                </span>
              </div>
              <div className="text-indigo-400 font-bold">→</div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Final Grade</span>
                <span
                  data-testid="final-recorded-score"
                  className="text-2xl font-extrabold text-white tracking-tight"
                >
                  {result.adjustedScore}%{' '}
                  <span className="text-sm font-bold text-indigo-400">({result.finalLetterGrade})</span>
                </span>
              </div>
            </div>

            {/* Advice Box */}
            <p className="text-xs text-slate-300 leading-relaxed">{result.summary}</p>
          </div>

          {/* SVG Penalty Decay Curve Chart */}
          <div className="space-y-1 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Score Decay Curve (0h–96h)</span>
              <span>Current: <strong className="text-white">{hoursLate}h</strong></span>
            </div>
            <div className="rounded-xl bg-slate-950 p-2 border border-slate-800">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-24"
                role="img"
                aria-label="Late penalty decay curve chart"
              >
                {/* Axes */}
                <line
                  x1={padding}
                  y1={chartHeight - padding}
                  x2={chartWidth - padding}
                  y2={chartHeight - padding}
                  stroke="#334155"
                  strokeWidth="1"
                />
                {/* Decay Path */}
                <path
                  d={svgPath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Active Hour Marker */}
                {(() => {
                  const x = padding + (hoursLate / 96) * (chartWidth - 2 * padding);
                  const y =
                    chartHeight - padding - (result.adjustedScore / 100) * (chartHeight - 2 * padding);
                  return (
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="#38bdf8"
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Official Syllabus Policy Card */}
      {policy.rawPolicyText && (
        <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-1.5 text-xs text-slate-300">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Official Syllabus Late Policy</span>
          </div>
          <p className="font-mono text-slate-200 leading-relaxed">&ldquo;{policy.rawPolicyText}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
