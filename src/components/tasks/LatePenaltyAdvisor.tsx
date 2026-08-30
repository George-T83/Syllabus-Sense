'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
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

  // Same low/medium/critical severity vocabulary as AttendanceGauge's
  // safe/warning/critical status: full credit reads as "safe", a partial
  // deduction as a mid-level warning, and the hard cutoff (0 credit) as
  // critical - driving the load-* tokens everywhere below instead of an
  // invented red/amber/emerald scheme.
  const severity = useMemo<'safe' | 'warning' | 'critical'>(() => {
    if (result.isPastHardCutoff) return 'critical';
    if (result.penaltyPercentage === 0) return 'safe';
    return 'warning';
  }, [result]);

  const severityTextClass =
    severity === 'critical'
      ? 'text-load-critical'
      : severity === 'warning'
        ? 'text-load-medium'
        : 'text-load-low';

  const severityTintClass =
    severity === 'critical'
      ? 'bg-load-critical/10 text-load-critical border-load-critical/30'
      : severity === 'warning'
        ? 'bg-load-medium/10 text-load-medium border-load-medium/30'
        : 'bg-load-low/10 text-load-low border-load-low/30';

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
              {courseCode}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Late Submission Penalty & Grace Advisor
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {assignmentTitle} — Simulate late penalty decay and slip-day grace periods.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="penalty-status-badge"
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${severityTintClass}`}
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
        <Card className="md:col-span-6 p-6 space-y-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Submission Parameters
          </h3>

          {/* Hours Late Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">Late Duration</span>
              <span className="font-mono font-bold text-primary">
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
              className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>On Time (0h)</span>
              <span>24h (1d)</span>
              <span>48h (2d)</span>
              <span>72h (3d)</span>
              <span>96h (4d)</span>
            </div>
          </div>

          {/* Raw Score Slider */}
          <div className="space-y-2 pt-2 border-t border-border/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">Expected Raw Score</span>
              <span className="font-mono font-bold text-primary">{rawScore}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={rawScore}
              onChange={(e) => setRawScore(Number(e.target.value))}
              aria-label="Expected Raw Score Slider"
              className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
            />
          </div>

          {/* Slip Days Bank */}
          {policy.totalSlipDaysAllowed !== undefined && (
            <div className="p-3.5 rounded-2xl bg-muted/50 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Slip Days Used Prior:</span>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSlipDaysUsedSoFar(num)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        slipDaysUsedSoFar === num
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-background text-muted-foreground hover:text-foreground border border-border'
                      }`}
                    >
                      {num} Used
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {result.slipDaysRemaining} slip days remaining after this assignment.
              </p>
            </div>
          )}
        </Card>

        {/* Right Side: Grade Outcome & Decay Curve (6 cols) */}
        <Card className="md:col-span-6 p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Projected Final Recorded Grade
            </h3>

            {/* Score Comparison Display */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block">Raw Score</span>
                <span className="text-xl font-bold text-foreground">{rawScore}%</span>
              </div>
              <div className="text-primary font-bold">→</div>
              <div>
                <span className="text-xs text-muted-foreground block">Deduction</span>
                <span className={`text-lg font-bold ${severityTextClass}`}>
                  -{result.penaltyPercentage}%
                </span>
              </div>
              <div className="text-primary font-bold">→</div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Final Grade</span>
                <span
                  data-testid="final-recorded-score"
                  className="text-2xl font-extrabold text-foreground tracking-tight"
                >
                  {result.adjustedScore}%{' '}
                  <span className="text-sm font-bold text-primary">
                    ({result.finalLetterGrade})
                  </span>
                </span>
              </div>
            </div>

            {/* Advice Box */}
            <p className={`rounded-2xl border p-3 text-xs leading-relaxed ${severityTintClass}`}>
              {result.summary}
            </p>
          </div>

          {/* SVG Penalty Decay Curve Chart */}
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Score Decay Curve (0h–96h)</span>
              <span>
                Current: <strong className="text-foreground">{hoursLate}h</strong>
              </span>
            </div>
            <div className="rounded-xl bg-muted/30 p-2 border border-border">
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
                  className="stroke-border"
                  strokeWidth="1"
                />
                {/* Decay Path */}
                <path
                  d={svgPath}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Active Hour Marker */}
                {(() => {
                  const x = padding + (hoursLate / 96) * (chartWidth - 2 * padding);
                  const y =
                    chartHeight -
                    padding -
                    (result.adjustedScore / 100) * (chartHeight - 2 * padding);
                  return (
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      className="fill-primary stroke-muted"
                      strokeWidth="2"
                    />
                  );
                })()}
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Official Syllabus Policy Card */}
      {policy.rawPolicyText && (
        <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-1.5 text-xs text-foreground">
          <div className="font-bold text-primary flex items-center gap-1.5">
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
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <span>Official Syllabus Late Policy</span>
          </div>
          <p className="font-mono leading-relaxed">&ldquo;{policy.rawPolicyText}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
