import type { ScheduleItem } from '@/types/schedule';

export type ChunkableType =
  | 'project'
  | 'exam'
  | 'quiz'
  | 'assignment'
  | 'paper'
  | 'presentation'
  | 'reading'
  | 'coding'
  | 'portfolio'
  | 'group'
  | 'flashcards'
  | 'case_study';

export type WorkloadIntensity = 'light' | 'moderate' | 'heavy';

export interface ProjectChunk {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  completedDate?: string;
  durationMinutes: number;
  completed: boolean;
  phase: string;
  type: ChunkableType;
  phaseIndex?: number;
  partNumber?: number;
  totalParts?: number;
}

export interface WorkloadTaskItem {
  id: string;
  title: string;
  courseId?: string;
  durationMinutes: number;
  isChunk?: boolean;
  type?: string;
  completed?: boolean;
  isRollover?: boolean;
}

export interface DailyWorkloadDay {
  dateStr: string; // YYYY-MM-DD
  dayName: string; // Mon, Tue, etc.
  formattedDate: string; // Jan 24
  items: WorkloadTaskItem[];
  totalMinutes: number;
  completedMinutes: number;
  intensity: WorkloadIntensity;
}

export interface WeeklyWorkloadSummary {
  weekLabel: string;
  startDateStr: string;
  endDateStr: string;
  totalMinutes: number;
  completedMinutes: number;
  itemCount: number;
  days: DailyWorkloadDay[];
}

export interface WorkloadBreakdown {
  today: DailyWorkloadDay;
  thisWeek: WeeklyWorkloadSummary;
  next7Days: DailyWorkloadDay[];
  rolledOverCount: number;
}

export const PHASE_TEMPLATES: Record<ChunkableType, string[]> = {
  project: [
    'Research & Architecture Outline',
    'Core Feature Implementation',
    'Testing, Bug Fixes & Refactoring',
    'Final Polish & Submission',
  ],
  exam: [
    'Lecture Notes & Key Concepts Review',
    'Practice Problems & Formula Drills',
    'Timed Mock Exam Run',
    'Weak Spot Refinement & Cheat Sheet',
  ],
  quiz: [
    'Flashcards & Key Term Definitions',
    'Concept Synthesis & Diagram Review',
    'Targeted Practice Quiz Questions',
    'Rapid-Fire Self-Test & Final Polish',
  ],
  assignment: [
    'Problem Breakdown & Initial Setup',
    'Core Solution Execution',
    'Data Analysis & Result Verification',
    'Report Write-up & Format Check',
  ],
  paper: [
    'Thesis Statement & Literature Outline',
    'Drafting Introduction & Main Argument',
    'Evidence Mapping & Discussion',
    'Citations, Proofreading & Final Edit',
  ],
  presentation: [
    'Topic Outline & Key Takeaway Points',
    'Slide Deck Design & Visual Asset Creation',
    'Script Writing & Rehearsal Run',
    'Q&A Prep & Final Presentation Polish',
  ],
  reading: [
    'Skim Headings & Chapter Summaries',
    'Deep Reading & Margin Annotations',
    'Synthesis Notes & Concept Mapping',
    'Self-Testing & Chapter Review Quiz',
  ],
  coding: [
    'Technical Architecture & API Design',
    'Core Algorithm & Feature Coding',
    'Unit Testing, Debugging & Edge Cases',
    'Code Cleanup, Documentation & Submission',
  ],
  portfolio: [
    'Asset Curation & Case Study Outlining',
    'Visual Layout & Responsive Polish',
    'Peer Feedback & Asset Refinement',
    'Final Export & Portfolio Deployment',
  ],
  group: [
    'Task Allocation & Team Alignment',
    'Individual Component Execution',
    'Team Integration & Cross-Review',
    'Final Group Review & Submission Prep',
  ],
  flashcards: [
    'Deck Creation & Definition Extraction',
    'First Pass Memorization Run',
    'Spaced Repetition & Weak Cards Drill',
    'Perfect Score Mastery Verification',
  ],
  case_study: [
    'Background Fact & Context Audit',
    'Core Problem Analysis & Frameworks',
    'Strategic Recommendations & Action Plan',
    'Executive Summary & Report Edit',
  ],
};

export function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface DivideProjectParams {
  projectTitle?: string;
  title?: string;
  totalEstimatedHours?: number;
  estimatedTotalHours?: number;
  startDate?: Date | string;
  dueDate: Date | string;
  pace: 'daily' | 'weekly';
  type?: ChunkableType;
  targetType?: ChunkableType;
}

/**
 * Divides large projects, exams, quizzes, or assignments into bite-sized daily or weekly chunks of work.
 * Guarantees exact sum of chunk durations equals total requested minutes via remainder distribution math.
 */
export function divideProjectIntoChunks(params: DivideProjectParams): ProjectChunk[] {
  const cleanTitle = (params.projectTitle || params.title || 'Study Milestone').trim();
  const hours = params.totalEstimatedHours ?? params.estimatedTotalHours ?? 10;
  const chunkType = params.type || params.targetType || 'project';
  const startDate = params.startDate
    ? typeof params.startDate === 'string'
      ? new Date(params.startDate)
      : params.startDate
    : new Date();
  const dueDate = typeof params.dueDate === 'string' ? new Date(params.dueDate) : params.dueDate;
  const pace = params.pace || 'daily';

  const totalMinutes = Math.max(30, Math.round(hours * 60));

  const startMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const dueMs = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();

  const totalDays = Math.max(1, Math.ceil((dueMs - startMs) / (1000 * 60 * 60 * 24)));

  const chunkCount =
    pace === 'daily'
      ? Math.min(totalDays, Math.max(chunkType === 'quiz' || chunkType === 'flashcards' ? 2 : 4, Math.ceil(totalMinutes / 45)))
      : Math.min(Math.max(1, Math.ceil(totalDays / 7)), Math.max(2, Math.ceil(totalMinutes / 120)));

  const baseMinutes = Math.floor(totalMinutes / chunkCount);
  const remainder = totalMinutes % chunkCount;

  const chunks: ProjectChunk[] = [];
  const phases = PHASE_TEMPLATES[chunkType] || PHASE_TEMPLATES.project;

  for (let i = 0; i < chunkCount; i++) {
    const fraction = i / Math.max(1, chunkCount - 1);
    const chunkMs = startMs + Math.round(fraction * (dueMs - startMs));
    const chunkDate = new Date(chunkMs);
    const dateStr = toLocalDateStr(chunkDate);

    const phaseIndex = Math.min(phases.length - 1, Math.floor(fraction * phases.length));
    const phaseName = phases[phaseIndex];
    const durationMinutes = baseMinutes + (i < remainder ? 1 : 0);

    chunks.push({
      id: `chunk-${chunkType}-${i + 1}-${Date.now()}-${i}`,
      title: `${cleanTitle} — ${phaseName} (Part ${i + 1}/${chunkCount})`,
      targetDate: dateStr,
      durationMinutes,
      completed: false,
      phase: phaseName,
      type: chunkType,
      phaseIndex,
      partNumber: i + 1,
      totalParts: chunkCount,
    });
  }

  return chunks;
}

/**
 * Immutably shifts a task's due date to a new date string and returns the updated schedule item array.
 */
export function shiftTaskDate(
  itemId: string,
  newDateStr: string,
  scheduleItems: ScheduleItem[]
): ScheduleItem[] {
  return scheduleItems.map((item) =>
    item.id === itemId ? { ...item, dueDate: newDateStr } : item
  );
}

/**
 * Calculates daily and weekly workload breakdown with retroactive completion & dynamic rollover recalculation.
 */
export function calculateWorkloadBreakdown(
  scheduleItems: ScheduleItem[],
  customChunks: ProjectChunk[] = [],
  referenceDate: Date | string = new Date()
): WorkloadBreakdown {
  const refDate = typeof referenceDate === 'string' ? new Date(referenceDate) : (referenceDate || new Date());
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth();
  const refDay = refDate.getDate();
  const refDateObj = new Date(refYear, refMonth, refDay);
  const todayStr = toLocalDateStr(refDateObj);

  const daysMap = new Map<string, DailyWorkloadDay>();

  // Initialize past 2 days + next 7 days for retroactive logging & upcoming forecast
  for (let i = -2; i < 7; i++) {
    const d = new Date(refYear, refMonth, refDay + i);
    const dateStr = toLocalDateStr(d);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
    const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);

    daysMap.set(dateStr, {
      dateStr,
      dayName,
      formattedDate,
      items: [],
      totalMinutes: 0,
      completedMinutes: 0,
      intensity: 'light',
    });
  }

  let rolledOverCount = 0;

  // Aggregate schedule items
  for (const item of scheduleItems) {
    if (!item.dueDate) continue;
    const itemDate = new Date(item.dueDate);
    const dateStr = toLocalDateStr(itemDate);
    const duration = item.estimatedHours ? Math.round(item.estimatedHours * 60) : (item.type === 'exam' ? 120 : 60);

    // Retroactive completion: if completed, count on original due date regardless of age
    if (item.completed) {
      if (daysMap.has(dateStr)) {
        const day = daysMap.get(dateStr)!;
        day.items.push({
          id: item.id,
          title: item.title,
          courseId: item.courseId,
          durationMinutes: duration,
          isChunk: false,
          type: item.type,
          completed: true,
        });
        day.totalMinutes += duration;
        day.completedMinutes += duration;
      }
      continue;
    }

    // Uncompleted past items roll over to today for recalculation
    if (dateStr < todayStr) {
      rolledOverCount++;
      const todayDay = daysMap.get(todayStr)!;
      todayDay.items.push({
        id: item.id,
        title: `${item.title} (Rollover)`,
        courseId: item.courseId,
        durationMinutes: duration,
        isChunk: false,
        type: item.type,
        completed: false,
        isRollover: true,
      });
      todayDay.totalMinutes += duration;
    } else if (daysMap.has(dateStr)) {
      const day = daysMap.get(dateStr)!;
      day.items.push({
        id: item.id,
        title: item.title,
        courseId: item.courseId,
        durationMinutes: duration,
        isChunk: false,
        type: item.type,
        completed: false,
      });
      day.totalMinutes += duration;
    }
  }

  // Aggregate unpersisted preview chunks if provided
  for (const chunk of customChunks) {
    if (chunk.completed) continue;
    if (daysMap.has(chunk.targetDate)) {
      const day = daysMap.get(chunk.targetDate)!;
      day.items.push({
        id: chunk.id,
        title: chunk.title,
        durationMinutes: chunk.durationMinutes,
        isChunk: true,
        type: chunk.type,
        completed: false,
      });
      day.totalMinutes += chunk.durationMinutes;
    }
  }

  // Calculate intensity dynamically per day based on relative load
  for (const day of daysMap.values()) {
    if (day.totalMinutes > 300) {
      day.intensity = 'heavy';
    } else if (day.totalMinutes > 150) {
      day.intensity = 'moderate';
    } else {
      day.intensity = 'light';
    }
  }

  const allDays = Array.from(daysMap.values());
  const next7Days = allDays.filter((d) => d.dateStr >= todayStr);
  const today = daysMap.get(todayStr) || next7Days[0];

  const thisWeekMinutes = next7Days.reduce((acc, d) => acc + d.totalMinutes, 0);
  const thisWeekCompleted = next7Days.reduce((acc, d) => acc + d.completedMinutes, 0);
  const thisWeekItems = next7Days.reduce((acc, d) => acc + d.items.length, 0);

  const startDateStr = next7Days[0].formattedDate;
  const endDateStr = next7Days[next7Days.length - 1].formattedDate;

  return {
    today,
    thisWeek: {
      weekLabel: `Week of ${startDateStr}`,
      startDateStr,
      endDateStr,
      totalMinutes: thisWeekMinutes,
      completedMinutes: thisWeekCompleted,
      itemCount: thisWeekItems,
      days: next7Days,
    },
    next7Days,
    rolledOverCount,
  };
}
