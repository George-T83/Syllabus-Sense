# Specification & Domain Architecture Report: Study & Project Chunking & Workload Center

**Author**: Spec Miner 2  
**Date**: 2026-08-24  
**Status**: Authoritative Technical Specification  
**Scope**: R1 (Bite-Sized Chunking Engine), R2 (Interactive 7-Day Forecast & Date Shifter), R3 (Retroactive Completion Anchoring & Rollover Recalculation), Type System & Service Contracts

---

## 1. Executive Summary

The **Study & Project Chunking & Workload Center** provides students with an intelligent, cognitive-load-aware engine to decompose large, intimidating academic milestones (capstones, exams, lab reports, essays, quizzes) into bite-sized daily or weekly sessions. It couples this decomposition with a dynamic **7-day workload forecast grid**, **1-click day inspection and manual date shifting**, and an **authoritative retroactive completion & rollover recalculation engine**.

This specification outlines the mathematical models, exact 4-phase curricula for all 5 study target types, state transition rules, Firestore synchronization protocols, and comprehensive TypeScript definitions required for implementation.

---

## 2. Features Discovered & Probed

### Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Chunking Engine (R1) | 5 Distinct Study Target Types | Multi-modal chunking templates for Project, Exam, Quiz, Assignment/Lab, and Paper | `ChunkableType`: `'project' \| 'exam' \| 'quiz' \| 'assignment' \| 'paper'` | Type-specific configuration (icon, default hours, 4-phase templates) | Fallback to `'project'` configuration | `ORIGINAL_REQUEST.md`, `projectChunker.ts`, `ProjectChunkerModal.tsx` |
| 2 | Chunking Engine (R1) | Specialized 4-Phase Curricula | Domain-driven 4-phase progression mapped across each target type | `type`, `totalMinutes`, `pace`, `dateSpan` | Array of `ProjectChunk` items assigned to sequential 4 phases | Clamps phase index $0 \le i \le 3$ safely | `ORIGINAL_REQUEST.md` R1 |
| 3 | Chunking Engine (R1) | Linear Temporal Chunking Algorithm | Calculates chunk count, duration, and distributes dates across available window | `projectTitle`, `totalEstimatedHours`, `startDate`, `dueDate`, `pace`, `type` | `ProjectChunk[]` with exact dates, durations, and phase labels | Enforces minimum 30 min duration, minimum 1 day runway | `projectChunker.ts:92-147` |
| 4 | Persistence & Sync (R1) | 1-Click Firestore Batch Persistence | Persists previewed chunks into `users/{uid}/scheduleItems` with optimistic state update | `userId`, `ProjectChunk[]`, `selectedCourseId`, `dispatch` | Emits `ADD_SCHEDULE_ITEM` dispatches + writes to Firestore subcollection | Rollback local state via `REMOVE_SCHEDULE_ITEM` on network failure | `ProjectChunkerModal.tsx:68-97`, `scheduleItems.ts:132-146` |
| 5 | Workload Forecast (R2) | 7-Day Horizon Grid | Aggregates daily study minutes, task counts, and completed minutes for $D_0 \dots D_6$ | `ScheduleItem[]`, `ProjectChunk[]`, `referenceDate` | `DailyWorkloadDay[]` (7 items), `thisWeek` summary | Omits invalid dates; defaults empty days to 0 mins | `projectChunker.ts:152-294`, `WorkloadOverviewDashboard.tsx` |
| 6 | Workload Forecast (R2) | Relative Load Intensity Classifier | Classifies daily cognitive load into Light, Moderate, and Heavy Peak | `totalMinutes` per day | `intensity`: `'light' \| 'moderate' \| 'heavy'` | Non-finite values resolve to `'light'` | `projectChunker.ts:259-267`, `constants.ts:107-137` |
| 7 | Date Shifting (R2) | 1-Click Day Inspection | Expands day metrics and lists all scheduled tasks for selected forecast day | `selectedDayDate` (YYYY-MM-DD) | Active `DailyWorkloadDay` object with item list | Defaults to `today` if key not found | `WorkloadOverviewDashboard.tsx:23-29` |
| 8 | Date Shifting (R2) | Manual Date Shifter Controls | Allows students to shift tasks between days via date picker or quick buttons to resolve peaks | `taskId`, `newDateStr` (YYYY-MM-DD), `userId` | Dispatches `UPDATE_SCHEDULE_ITEM` + persists `dueDate` update | Reverts optimistic state on write failure | `WorkloadOverviewDashboard.tsx:46-57`, `scheduleItems.ts:148-163` |
| 9 | History & Rollover (R3) | Retroactive Completion Anchoring | Preserves historical study load by anchoring completed tasks to their original target dates | `ScheduleItem.completed === true`, `dueDate` | Historical day `totalMinutes` & `completedMinutes` incremented; 0 rollover | Excluded from current/future day rollover counts | `projectChunker.ts:192-209` |
| 10 | History & Rollover (R3) | Dynamic Past-Due Rollover Recalculation | Automatically rolls uncompleted past-due tasks into today's load with badge and recalculation | `ScheduleItem.completed === false`, `dueDate < today` | Transferred into `today.items` with `isRollover: true`; `rolledOverCount` increments | Does not overwrite underlying Firestore `dueDate` | `projectChunker.ts:211-225` |

---

## 3. Edge Cases & Boundary Conditions

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | Chunking Engine | Same-day deadline ($StartMs = DueMs$, 0 days runway) | Clamps $TotalDays = 1$. Generates minimum chunks all anchored to the same due date without NaN division. |
| 2 | Chunking Engine | Due date in the past ($DueMs < StartMs$) | $TotalDays = \max(1, \dots) = 1$. Generates overdue chunks anchored to the due date, triggering immediate rollover to today. |
| 3 | Chunking Engine | Fractional / non-integer hours (e.g. 2.75 hours) | Rounds $TotalMinutes = \text{round}(2.75 \times 60) = 165\text{ mins}$. Minutes per chunk evenly distributed with remainder preservation. |
| 4 | Chunking Engine | Very small hour estimate (e.g. 0.1 hours / 6 mins) | Enforces minimum session threshold of 30 minutes ($TotalMinutes = \max(30, \dots) = 30$). |
| 5 | Chunking Engine | Massive project (e.g. 100 hours over 60 days) | Caps daily chunks to reasonable limits ($ChunkCount = \min(60, \text{ceil}(6000 / 45)) = 60$). Each session is 100 mins. |
| 6 | Workload Intensity | Boundary values: exactly 150 mins (2.5h) | $TotalMinutes \le 150 \implies$ `'light'`. At 151 mins $\implies$ `'moderate'`. |
| 7 | Workload Intensity | Boundary values: exactly 300 mins (5.0h) | $TotalMinutes \le 300 \implies$ `'moderate'`. At 301 mins $\implies$ `'heavy'`. |
| 8 | Date Shifting | Shifting a rolled-over task to a future date | Updating `dueDate` to a future date removes the `isRollover` status on the next recalculation, shifting load to that target date. |
| 9 | Retroactive Anchoring | Multiple completed tasks in past window (-2 to -1 days) | Correctly increments `completedMinutes` and `totalMinutes` on historical days; does not push any past completed minutes into today. |
| 10 | Firestore Sync | Network offline during 1-click persistence | Optimistic dispatches immediately reflect chunks in UI; Firestore offline persistence queues writes; local state is preserved. |

---

## 4. Deep-Dive Specification: R1 Bite-Sized Chunking Engine

### 4.1 The 5 Distinct Study Target Types & Specialized 4-Phase Schedules

Each target type is designed to match real-world collegiate cognitive learning strategies:

```typescript
export type ChunkableType = 'project' | 'exam' | 'quiz' | 'assignment' | 'paper';

export interface TargetTypeConfig {
  type: ChunkableType;
  label: string;
  icon: string;
  defaultHours: number;
  description: string;
  phases: [string, string, string, string]; // Strictly 4 phases
}
```

#### Detailed Phase Breakdown Table

| Target Type | Label | Default Hours | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|-------------|-------|---------------|---------|---------|---------|---------|
| `project` | **Final Project / Capstone** | 10.0 hrs | **Research & Architecture Outline**<br>• Scope definition & requirements<br>• System architecture & tech stack<br>• Wireframes & data model schema | **Core Feature Implementation**<br>• Core modules & business logic<br>• API routes & database integration<br>• Component scaffolding | **Testing, Bug Fixes & Refactoring**<br>• Unit & integration testing<br>• Edge-case handling & debugging<br>• Code cleanup & performance | **Final Polish & Submission**<br>• UI styling & accessibility pass<br>• Readme & documentation<br>• Deployment & final artifact export |
| `exam` | **Exam Study Plan** | 8.0 hrs | **Lecture Notes & Key Concepts Review**<br>• Review lecture slides & syllabus<br>• High-yield concept mapping<br>• Clarify confusing formulas | **Practice Problems & Formula Drills**<br>• End-of-chapter problem sets<br>• Active recall drills & flashcards<br>• Timed formula applications | **Timed Mock Exam Run**<br>• Full-length past exam simulation<br>• Strict timing without notes<br>• Score analysis & error triage | **Weak Spot Polish & Cheat Sheet**<br>• Focused review on missed questions<br>• Create condensed exam cheat sheet<br>• Final memorization & resting |
| `quiz` | **Quiz / Test Review** | 3.0 hrs | **Flashcards & Key Term Definitions**<br>• Vocabulary & term flashcard runs<br>• Primary formula memorization<br>• Definition self-testing | **Concept Synthesis & Diagram Review**<br>• Lecture summary review<br>• Diagram & flow chart walkthrough<br>• Core mechanism comprehension | **Targeted Practice Quiz Questions**<br>• Chapter review questions<br>• Online quiz portal drills<br>• Error analysis on tricky distractors | **Rapid-Fire Self-Test & Final Polish**<br>• 15-minute speed self-quiz<br>• Last-minute weak point retention<br>• Confidence reinforcement |
| `assignment` | **Large Assignment / Lab** | 5.0 hrs | **Problem Breakdown & Initial Setup**<br>• Deconstruct problem prompt<br>• Environment & repo setup<br>• Dataset ingestion & prep | **Core Solution & Lab Execution**<br>• Algorithmic implementation<br>• Experimental data collection<br>• Core calculations & code scripts | **Data Analysis & Result Verification**<br>• Sanity check outputs against baselines<br>• Generate plots, charts, & tables<br>• Verify edge case parameters | **Report Write-up & Format Check**<br>• Draft discussion & analysis<br>• Verify rubric formatting guidelines<br>• Final code comments & PDF export |
| `paper` | **Essay / Term Paper** | 7.0 hrs | **Thesis Statement & Literature Outline**<br>• Topic scoping & thesis formulation<br>• Scholarly source search & literature review<br>• Detailed paragraph outline | **Drafting Introduction & Main Argument**<br>• Compelling hook & contextual intro<br>• Articulate core thesis arguments<br>• Body paragraph draft (Points 1 & 2) | **Evidence Mapping & Discussion**<br>• Integrate quotes & citation evidence<br>• Address counterarguments<br>• Synthesize analytical conclusion | **Citations, Proofreading & Final Edit**<br>• Format bibliography (APA/MLA/IEEE)<br>• Grammar & clarity polish<br>• Word count & submission check |

---

### 4.2 Chunking Mathematical Formulation

Given:
- $H \in \mathbb{R}^+$: Total estimated hours.
- $T_{start}, T_{due} \in \text{Date}$: Calendar start and due dates.
- $Pace \in \{\text{'daily'}, \text{'weekly'}\}$.
- $Type \in \{\text{'project'}, \text{'exam'}, \text{'quiz'}, \text{'assignment'}, \text{'paper'}\}$.

#### Step 1: Compute Total Workload in Minutes
$$M_{total} = \max(30, \text{round}(H \times 60))$$

#### Step 2: Compute Calendar Runway
$$\Delta_{days} = \max\left(1, \left\lceil \frac{T_{due.\text{midnight}} - T_{start.\text{midnight}}}{86,400,000} \right\rceil\right)$$

#### Step 3: Compute Optimal Chunk Count ($N$)
- For **Daily Pacing** ($Pace = \text{'daily'}$):
  $$N_{target} = \max\left(4, \left\lceil \frac{M_{total}}{45} \right\rceil\right)$$
  $$N = \min(\Delta_{days}, N_{target})$$
  *(Note: Enforcing $\max(4, \dots)$ ensures all 4 curriculum phases are represented whenever $\Delta_{days} \ge 4$. If $\Delta_{days} < 4$, $N = \Delta_{days}$.)*

- For **Weekly Pacing** ($Pace = \text{'weekly'}$):
  $$\Delta_{weeks} = \max\left(1, \left\lceil \frac{\Delta_{days}}{7} \right\rceil\right)$$
  $$N_{target} = \max\left(2, \left\lceil \frac{M_{total}}{120} \right\rceil\right)$$
  $$N = \min(\Delta_{weeks}, N_{target})$$

#### Step 4: Chunk Duration Allocation
$$M_{base} = \left\lfloor \frac{M_{total}}{N} \right\rfloor, \quad R = M_{total} \pmod N$$
Each chunk $i \in [0, N-1]$ receives duration:
$$M_i = M_{base} + (1 \text{ if } i < R \text{ else } 0)$$
This guarantees $\sum_{i=0}^{N-1} M_i = M_{total}$ exactly without minute leakage.

#### Step 5: Temporal Interpolation & Phase Mapping
For each chunk index $i \in [0, N-1]$:
$$\text{fraction}_i = \frac{i}{\max(1, N - 1)}$$
$$T_i = T_{start.\text{midnight}} + \text{round}(\text{fraction}_i \times (T_{due.\text{midnight}} - T_{start.\text{midnight}}))$$
$$\text{dateStr}_i = \text{formatDateISO}(T_i)$$
$$\text{phaseIndex}_i = \min(3, \lfloor \text{fraction}_i \times 4 \rfloor)$$
$$\text{phaseName}_i = \text{PHASE\_TEMPLATES}[Type][\text{phaseIndex}_i]$$
$$\text{title}_i = `${projectTitle} — ${phaseName}_i \text{ (Part } ${i + 1}/${N}\text{)}`$$

---

### 4.3 1-Click Persistence Architecture & Synchronization

```
┌──────────────────────────────┐
│     ProjectChunkerModal      │
│   (User clicks "Add Chunks") │
└──────────────┬───────────────┘
               │ 1. Iterates previewChunks: maps ProjectChunk -> ScheduleItem
               ▼
┌──────────────────────────────┐
│  createScheduleItem (Async)  │
└──────┬────────────────┬──────┘
       │                │
       │ (Local)        │ (Remote)
       ▼                ▼
┌──────────────┐ ┌────────────────────────────────────────┐
│ AppState     │ │ Firestore Write Queue (enqueueWrite)   │
│ Dispatch     │ │ setDoc: users/{uid}/scheduleItems/{id} │
│ ADD_ITEM     │ └───────────────────┬────────────────────┘
└──────────────┘                     │
       ▲                             │ Snapshot Stream
       │                             ▼
┌──────┴──────────────────────────────────────────────────┐
│ useFirestoreSync / reconcileScheduleItems               │
│ - Reconciles in-flight writes                           │
│ - Zero UI flicker, instant optimistic update            │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Deep-Dive Specification: R2 7-Day Workload Forecast & Date Shifter

### 5.1 7-Day Forecast Grid Model

The forecast window evaluates the interval $[D_0, D_6]$ where $D_0 = \text{today}$.

#### Daily Metrics Data Structure
```typescript
export interface DailyWorkloadDay {
  dateStr: string;         // "YYYY-MM-DD"
  dayName: string;         // "Mon", "Tue", etc.
  formattedDate: string;   // "Aug 24"
  items: WorkloadTaskItem[];
  totalMinutes: number;    // Sum of all active/completed items
  completedMinutes: number;// Sum of completed items
  intensity: WorkloadIntensity; // 'light' | 'moderate' | 'heavy'
}
```

#### Intensity Classification Rules & Exact Thresholds

| Intensity Level | Daily Minutes Range | Daily Hours Range | Visual Styling (Tailwind Tokens) | Cognitive State |
|-----------------|---------------------|-------------------|----------------------------------|-----------------|
| **`light`** | $0 \le M \le 150\text{ min}$ | $0.0 \le H \le 2.5\text{ hrs}$ | `border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400` | Comfortable study pace, high bandwidth for deep focus |
| **`moderate`** | $150 < M \le 300\text{ min}$ | $2.5 < H \le 5.0\text{ hrs}$ | `border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400` | Manageable academic load, full study day |
| **`heavy`** | $M > 300\text{ min}$ | $H > 5.0\text{ hrs}$ | `border-destructive/40 bg-destructive/10 text-destructive font-bold` | **⚠️ Heavy Peak** — cognitive overload risk, triggers date-shift prompt |

---

### 5.2 1-Click Day Inspection & Manual Date Shifter

1. **1-Click Day Inspection**:
   - Clicking on day $D_k$ selects it: `selectedDayDate = D_k.dateStr`.
   - The inspection card highlights the selected day, displays the total study load in hours ($H = M / 60$), and lists all constituent tasks.
   - Users can toggle completion status directly with instant optimistic checkbox interaction.

2. **Manual Date-Shifting Controls**:
   - Each uncompleted task row in the inspector provides an inline date shifter (`<input type="date">` and quick-shift buttons: $+1\text{ Day}$, $-1\text{ Day}$, $\text{Today}$).
   - Selecting a new date $D_{new}$ triggers:
     ```typescript
     await updateScheduleItem(user.uid, task, { ...task, dueDate: newDateStr }, dispatch);
     ```
   - **Real-Time Recalculation**:
     - Task shifts immediately from $D_{orig}$ to $D_{new}$.
     - $D_{orig}.\text{totalMinutes}$ decreases by $M_{task}$.
     - $D_{new}.\text{totalMinutes}$ increases by $M_{task}$.
     - Both days recalculate their `intensity` category in real time.

---

## 6. Deep-Dive Specification: R3 Retroactive Completion & Rollover Recalculation

### 6.1 Retroactive Completion Anchoring

- **Requirement**: When tasks due in the past (e.g. yesterday, 3 days ago) are completed, their completed hours must remain anchored to that past calendar date.
- **Algorithm Rule**:
  ```typescript
  if (item.completed) {
    if (daysMap.has(itemDateStr)) {
      const pastDay = daysMap.get(itemDateStr)!;
      pastDay.items.push({ ...item, completed: true });
      pastDay.totalMinutes += duration;
      pastDay.completedMinutes += duration;
    }
    // Completed past items NEVER rollover to today.
    continue;
  }
  ```
- **Fidelity Guarantee**: Historical days retain accurate completion records; historical workload charts reflect actual effort spent on those days.

### 6.2 Dynamic Rollover Recalculation

- **Requirement**: Any uncompleted task whose due date has passed ($dueDate < todayStr$) represents overdue academic debt that must be executed today.
- **Algorithm Rule**:
  ```typescript
  if (!item.completed && itemDateStr < todayStr) {
    rolledOverCount++;
    const todayDay = daysMap.get(todayStr)!;
    todayDay.items.push({
      ...item,
      title: `${item.title} (Rollover)`,
      isRollover: true,
      completed: false,
    });
    todayDay.totalMinutes += duration;
  }
  ```
- **UI Signaling**:
  - `rolledOverCount > 0` renders a high-visibility badge in the header: `⚠️ ${rolledOverCount} Rollover Tasks`.
  - Rollover task rows render with amber borders (`border-amber-500/40 bg-amber-500/10`) and a `(Rollover)` badge.
  - Non-destructive: The database `dueDate` is not altered automatically, preserving original syllabus deadlines while giving realistic daily workload forecasting.

---

## 7. Complete TypeScript Interface Definitions

```typescript
/**
 * Target study and project types supported by the chunking engine.
 */
export type ChunkableType = 'project' | 'exam' | 'quiz' | 'assignment' | 'paper';

/**
 * Relative load intensity categories for daily workload forecasting.
 */
export type WorkloadIntensity = 'light' | 'moderate' | 'heavy';

/**
 * A discrete bite-sized chunk of work generated by the chunking engine.
 */
export interface ProjectChunk {
  id: string;
  title: string;
  targetDate: string; // ISO date string (YYYY-MM-DD)
  completedDate?: string; // ISO date string when completed
  durationMinutes: number;
  completed: boolean;
  phase: string;
  type: ChunkableType;
  phaseIndex?: number;
  partNumber?: number;
  totalParts?: number;
}

/**
 * Options passed to the chunking algorithm.
 */
export interface DivideProjectOptions {
  projectTitle: string;
  totalEstimatedHours: number;
  startDate?: Date;
  dueDate: Date;
  pace: 'daily' | 'weekly';
  type?: ChunkableType;
  minChunkMinutes?: number;
}

/**
 * An individual task or chunk item positioned on a specific workload day.
 */
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

/**
 * Aggregated metrics for a single calendar day in the workload forecast.
 */
export interface DailyWorkloadDay {
  dateStr: string; // "YYYY-MM-DD"
  dayName: string; // "Mon", "Tue", etc.
  formattedDate: string; // "Aug 24"
  items: WorkloadTaskItem[];
  totalMinutes: number;
  completedMinutes: number;
  intensity: WorkloadIntensity;
}

/**
 * Summary rollup for the active 7-day forecast week.
 */
export interface WeeklyWorkloadSummary {
  weekLabel: string;
  startDateStr: string;
  endDateStr: string;
  totalMinutes: number;
  completedMinutes: number;
  itemCount: number;
  days: DailyWorkloadDay[];
}

/**
 * Complete workload breakdown returned by calculateWorkloadBreakdown.
 */
export interface WorkloadBreakdown {
  today: DailyWorkloadDay;
  thisWeek: WeeklyWorkloadSummary;
  next7Days: DailyWorkloadDay[];
  rolledOverCount: number;
}
```

---

## 8. Verification & Test Plan

1. **Unit Test Suite (`src/lib/planner/__tests__/projectChunker.test.ts`)**:
   - `it('divides all 5 target types with specialized 4-phase curricula')`: Verify that `project`, `exam`, `quiz`, `assignment`, and `paper` each cycle through their exact 4 phases.
   - `it('guarantees exact sum of chunk durations equals total requested minutes')`: Test with prime and fractional hours (e.g. 3.7 hrs).
   - `it('anchors retroactive completions to past dates and suppresses rollover')`: Verify past completed items increment history and do not roll over.
   - `it('rolls over past uncompleted items to today and flags isRollover')`: Verify past pending items roll to today, increment `rolledOverCount`, and increase today's totalMinutes.
   - `it('recalculates intensity correctly across Light, Moderate, and Heavy thresholds')`: Test at 150m, 151m, 300m, 301m.
2. **Type Checking & Linting**:
   - `npx tsc --noEmit` $\implies$ 0 errors.
   - `npm run lint` $\implies$ 0 errors, 0 warnings.
3. **Build Integrity**:
   - `npm test` $\implies$ 100% test pass.
   - `npm run build` $\implies$ clean compilation across all Next.js routes.
