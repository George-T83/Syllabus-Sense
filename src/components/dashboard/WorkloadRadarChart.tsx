'use client';

import React, { useMemo, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { WORKLOAD_BADGE_CLASS } from '@/lib/workload/uiClasses';
import type { Course, ScheduleItem } from '@/types/schedule';

export interface RadarDimension {
  key: string;
  label: string;
  shortLabel: string;
  value: number; // 0 to 100
  description: string;
}

export interface WorkloadRadarChartProps {
  timeframe?: 'current_week' | 'next_week' | 'finals_season';
  courseFilter?: string; // course ID or 'all'
  className?: string;
}

const RADAR_AXES: { key: string; label: string; shortLabel: string; description: string }[] = [
  {
    key: 'exams',
    label: 'Exam Weight & Stakes',
    shortLabel: 'Exams',
    description: 'Impact of upcoming midterms, finals, and high-stakes tests',
  },
  {
    key: 'volume',
    label: 'Deliverables Volume',
    shortLabel: 'Volume',
    description: 'Total number of pending assignments and tasks',
  },
  {
    key: 'reading',
    label: 'Reading & Prep Density',
    shortLabel: 'Reading',
    description: 'Estimated textbook chapters, papers, and preparatory reading',
  },
  {
    key: 'meetings',
    label: 'Meeting & Class Hours',
    shortLabel: 'Class Hours',
    description: 'Weekly recurring lecture, recitation, and lab attendance',
  },
  {
    key: 'projects',
    label: 'Project Complexity',
    shortLabel: 'Projects',
    description: 'Multi-week term projects, codebases, and group work',
  },
  {
    key: 'urgency',
    label: 'Deadline Proximity',
    shortLabel: 'Urgency',
    description: 'Runway pressure of deliverables due within 48-72 hours',
  },
];

/**
 * Converts polar coordinates to SVG Cartesian (x, y) coordinates.
 */
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInRadians: number,
) {
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

export function WorkloadRadarChart({
  timeframe: initialTimeframe = 'current_week',
  courseFilter: initialCourseFilter = 'all',
  className = '',
}: WorkloadRadarChartProps) {
  const { state } = useAppState();
  const [timeframe, setTimeframe] = useState<'current_week' | 'next_week' | 'finals_season'>(
    initialTimeframe,
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseFilter);
  const [showDataTable, setShowDataTable] = useState(false);
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  // Compute cognitive dimensions dynamically based on AppState
  const dimensions = useMemo<RadarDimension[]>(() => {
    const items: ScheduleItem[] = state.scheduleItems.filter((item) => {
      if (item.completed) return false;
      if (selectedCourseId !== 'all' && item.courseId !== selectedCourseId) return false;
      return true;
    });

    const courses: Course[] =
      selectedCourseId === 'all'
        ? state.courses
        : state.courses.filter((c) => c.id === selectedCourseId);

    // 1. Exam Weight
    const examItems = items.filter((i) => i.type === 'exam' || i.type === 'quiz');
    const examScore = Math.min(100, Math.max(15, examItems.length * 35));

    // 2. Deliverables Volume
    const totalPending = items.length;
    const volumeScore = Math.min(100, Math.max(10, totalPending * 12));

    // 3. Reading & Prep Density
    const readingItems = items.filter(
      (i) => i.type === 'reading' || (i.notes && i.notes.toLowerCase().includes('read')),
    );
    const readingScore = Math.min(100, Math.max(20, readingItems.length * 25 + courses.length * 8));

    // 4. Meeting & Lecture Hours
    const totalMeetings = courses.reduce((acc, c) => acc + (c.meetingTimes?.length || 2), 0);
    const meetingScore = Math.min(100, Math.max(25, totalMeetings * 14));

    // 5. Project Complexity
    const projectItems = items.filter(
      (i) => i.type === 'project' || i.title.toLowerCase().includes('project'),
    );
    const projectScore = Math.min(100, Math.max(15, projectItems.length * 30));

    // 6. Urgency & Proximity (< 72 hours)
    const now = Date.now();
    const urgentItems = items.filter((i) => {
      if (!i.dueDate) return false;
      const diff = new Date(i.dueDate).getTime() - now;
      return diff > 0 && diff <= 72 * 60 * 60 * 1000;
    });
    const urgencyScore = Math.min(
      100,
      Math.max(15, urgentItems.length * 28 + (items.some((i) => i.priority === 'high') ? 20 : 0)),
    );

    const scoreMap: Record<string, number> = {
      exams: Math.round(examScore),
      volume: Math.round(volumeScore),
      reading: Math.round(readingScore),
      meetings: Math.round(meetingScore),
      projects: Math.round(projectScore),
      urgency: Math.round(urgencyScore),
    };

    return RADAR_AXES.map((axis) => ({
      key: axis.key,
      label: axis.label,
      shortLabel: axis.shortLabel,
      value: scoreMap[axis.key] || 30,
      description: axis.description,
    }));
  }, [state.scheduleItems, state.courses, selectedCourseId]);

  // Overall Burnout & Stress Evaluation
  const stressAssessment = useMemo(() => {
    const avgScore = dimensions.reduce((acc, d) => acc + d.value, 0) / dimensions.length;
    const maxDimension = [...dimensions].sort((a, b) => b.value - a.value)[0];

    if (avgScore >= 75 || maxDimension.value >= 88) {
      return {
        level: 'HIGH_BURNOUT_RISK' as const,
        label: 'High Burnout Warning',
        badgeColor: WORKLOAD_BADGE_CLASS.critical,
        advice: `Heavy cognitive spike in ${maxDimension.label} (${maxDimension.value}%). Stagger study sessions 2-3 days early to avoid cognitive overload.`,
      };
    }
    if (avgScore >= 50 || maxDimension.value >= 70) {
      return {
        level: 'MODERATE_INTENSITY' as const,
        label: 'Optimal High Intensity',
        badgeColor: WORKLOAD_BADGE_CLASS.medium,
        advice: `Balanced workload runway with moderate pressure in ${maxDimension.shortLabel}. Maintain structured daily review blocks.`,
      };
    }
    return {
      level: 'BALANCED' as const,
      label: 'Balanced Cognitive Load',
      badgeColor: WORKLOAD_BADGE_CLASS.low,
      advice:
        'Workload is well-distributed across all courses. Excellent opportunity to read ahead or complete backlog projects.',
    };
  }, [dimensions]);

  // SVG Geometry Settings
  const size = 320;
  const center = size / 2;
  const radius = 110;
  const numAxes = dimensions.length;
  const angleStep = (2 * Math.PI) / numAxes;
  const angleOffset = -Math.PI / 2; // Start from top 12 o'clock

  // Polygon Points
  const polygonPoints = useMemo(() => {
    return dimensions
      .map((dim, i) => {
        const angle = angleOffset + i * angleStep;
        const r = (dim.value / 100) * radius;
        const pt = polarToCartesian(center, center, r, angle);
        return `${pt.x},${pt.y}`;
      })
      .join(' ');
  }, [dimensions, center, radius, angleStep, angleOffset]);

  return (
    <div
      role="region"
      aria-label="Cognitive Workload Radar Chart"
      className={`rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-5 shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              Weekly Cognitive Workload Radar
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${stressAssessment.badgeColor}`}
            >
              {stressAssessment.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Multi-dimensional stress heatmap across 6 cognitive load vectors
          </p>
        </div>

        {/* Timeframe & Filter controls */}
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter radar by timeframe"
            value={timeframe}
            onChange={(e) =>
              setTimeframe(e.target.value as 'current_week' | 'next_week' | 'finals_season')
            }
            className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="current_week">This Week</option>
            <option value="next_week">Next 7 Days</option>
            <option value="finals_season">Finals Season</option>
          </select>

          <select
            aria-label="Filter radar by course"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="all">All Enrolled Courses</option>
            {state.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Radar Display Grid */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* SVG Radar Spider Web (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
          <svg
            width="100%"
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="max-w-[340px] overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
              </radialGradient>
              <filter id="radarGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Concentric Web Rings (25%, 50%, 75%, 100%) */}
            {[0.25, 0.5, 0.75, 1.0].map((level, lvlIdx) => {
              const r = radius * level;
              const ringPoints = dimensions
                .map((_, i) => {
                  const angle = angleOffset + i * angleStep;
                  const pt = polarToCartesian(center, center, r, angle);
                  return `${pt.x},${pt.y}`;
                })
                .join(' ');

              return (
                <g key={lvlIdx}>
                  <polygon
                    points={ringPoints}
                    fill={lvlIdx === 3 ? 'hsl(var(--muted))' : 'none'}
                    fillOpacity={lvlIdx === 3 ? 0.4 : undefined}
                    stroke="currentColor"
                    className="text-border/40"
                    strokeWidth={1}
                    strokeDasharray={lvlIdx < 3 ? '2 2' : 'none'}
                  />
                  <text
                    x={center + 4}
                    y={center - r + 3}
                    fontFamily="sans-serif"
                    fontSize="8"
                    className="fill-muted-foreground/60 font-mono"
                  >
                    {Math.round(level * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Spoke Axis Lines */}
            {dimensions.map((dim, i) => {
              const angle = angleOffset + i * angleStep;
              const edgePt = polarToCartesian(center, center, radius, angle);
              const labelPt = polarToCartesian(center, center, radius + 22, angle);
              const isHovered = hoveredAxis === dim.key;

              return (
                <g key={dim.key}>
                  <line
                    x1={center}
                    y1={center}
                    x2={edgePt.x}
                    y2={edgePt.y}
                    stroke="currentColor"
                    className={isHovered ? 'text-primary' : 'text-border/50'}
                    strokeWidth={isHovered ? 2 : 1}
                  />
                  {/* Axis Label */}
                  <text
                    x={labelPt.x}
                    y={labelPt.y + 4}
                    textAnchor="middle"
                    className={`text-[10px] font-bold transition-colors cursor-pointer ${
                      isHovered ? 'fill-primary' : 'fill-muted-foreground'
                    }`}
                    onMouseEnter={() => setHoveredAxis(dim.key)}
                    onMouseLeave={() => setHoveredAxis(null)}
                  >
                    {dim.shortLabel}
                  </text>
                </g>
              );
            })}

            {/* Workload Data Polygon */}
            <polygon
              points={polygonPoints}
              fill="url(#radarFillGrad)"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              filter="url(#radarGlow)"
              className="transition-all duration-300"
            />

            {/* Data Point Knots */}
            {dimensions.map((dim, i) => {
              const angle = angleOffset + i * angleStep;
              const r = (dim.value / 100) * radius;
              const pt = polarToCartesian(center, center, r, angle);
              const isHovered = hoveredAxis === dim.key;

              return (
                <circle
                  key={dim.key}
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4}
                  fill={
                    dim.value >= 80
                      ? 'hsl(var(--load-critical))'
                      : dim.value >= 60
                        ? 'hsl(var(--load-medium))'
                        : 'hsl(var(--load-low))'
                  }
                  stroke="hsl(var(--card))"
                  strokeWidth={1.5}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredAxis(dim.key)}
                  onMouseLeave={() => setHoveredAxis(null)}
                >
                  <title>{`${dim.label}: ${dim.value}%`}</title>
                </circle>
              );
            })}
          </svg>
        </div>

        {/* Cognitive Metric Breakdown & Burnout Advice (5 Cols) */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Burnout Mitigation Advice Card */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <span>⚡</span> Burnout Defense Recommendation
            </span>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {stressAssessment.advice}
            </p>
          </div>

          {/* Metric Rows */}
          <div className="space-y-2">
            {dimensions.map((dim) => {
              const isHovered = hoveredAxis === dim.key;
              const isHigh = dim.value >= 75;

              return (
                <div
                  key={dim.key}
                  onMouseEnter={() => setHoveredAxis(dim.key)}
                  onMouseLeave={() => setHoveredAxis(null)}
                  className={`flex items-center justify-between rounded-xl border p-2.5 transition-all ${
                    isHovered
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border/40 bg-card hover:bg-muted/30'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-foreground">{dim.label}</span>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                      {dim.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isHigh
                            ? 'bg-load-critical'
                            : dim.value >= 50
                              ? 'bg-load-medium'
                              : 'bg-load-low'
                        }`}
                        style={{ width: `${dim.value}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground w-8 text-right">
                      {dim.value}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Screen Reader Table Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowDataTable((p) => !p)}
              aria-expanded={showDataTable}
              aria-controls="radar-data-table"
              className="text-xs font-semibold text-primary hover:underline"
            >
              {showDataTable ? 'Hide accessible data table' : 'View accessible workload data table'}
            </button>

            {showDataTable && (
              <table
                id="radar-data-table"
                className="mt-2 w-full text-xs text-left border border-border/40 rounded-lg overflow-hidden"
              >
                <thead className="bg-muted/40 text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-2">Dimension</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Load Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-foreground">
                  {dimensions.map((d) => (
                    <tr key={d.key}>
                      <td className="p-2 font-medium">{d.label}</td>
                      <td className="p-2 font-mono">{d.value}%</td>
                      <td className="p-2">
                        {d.value >= 75 ? 'High Stress' : d.value >= 50 ? 'Moderate' : 'Optimal'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkloadRadarChart;
