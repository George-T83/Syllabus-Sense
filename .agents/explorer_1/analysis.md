# Syllabus Sense Codebase Architecture & Investigation Report

## Executive Summary
This report provides a comprehensive architectural analysis of **Syllabus Sense** to support the **Study & Project Chunking & Workload Center** implementation. The codebase is a production-grade, highly structured Next.js 14 App Router application with Firebase/Firestore real-time state synchronization, strict TypeScript types, Zod schemas, Tailwind CSS styling, and a 433-test Vitest suite across 59 test files with 100% pass rate and 0 ESLint/TypeScript errors across all 20 build routes.

---

## 1. Tech Stack & Dependencies

### Core Framework & Runtime
- **Framework**: Next.js `14.2.35` (App Router architecture with route groups `(app)`, `(auth)`, `api/syllabus/*`)
- **React**: React 18.3.x (`react`, `react-dom`)
- **Language**: TypeScript 5 (`npx tsc --noEmit` verified clean)
- **Styling**: Tailwind CSS `3.4.1` with custom design tokens:
  - Workload intensity tokens: `load-low` (`#10b981`), `load-medium` (`#f59e0b`), `load-high` (`#f97316`), `load-critical` (`#ef4444`)
  - CSS variables for light/dark theme (`hsl(var(--background))`, `hsl(var(--foreground))`, `hsl(var(--primary))`, etc.)
- **Validation**: Zod `4.4.3` (`extraction.ts`, `courseSummary.ts`, form schemas in `validation/`)
- **AI Integration**: `@anthropic-ai/sdk` (`0.117.1`) powering syllabus extraction, course summaries, and chat copilot
- **Document Processing**: `pdfjs-dist` (`6.2.108`) and `mammoth` (`1.12.1`) for PDF and `.docx` syllabus text extraction

### Backend & Cloud Services
- **Firebase Client SDK**: `firebase` (`12.17.1`)
  - `firebase/auth`: Client-side authentication (`AuthContext.tsx`)
  - `firebase/firestore`: Firestore database with realtime snapshot listeners (`onSnapshot`) and atomic write batches (`writeBatch`)
  - `firebase/storage`: Cloud Storage for syllabus PDFs/documents
- **Firebase Admin SDK**: `firebase-admin` (`14.2.0`) for server-side token validation and secure API routes

### State Management & Data Sync
- **Local React State**: `useReducer` + React Context via `src/context/AppStateContext.tsx` (`AppStateProvider`, `useAppState`)
- **Real-Time Sync**: `src/lib/firestore/useFirestoreSync.ts` attaches `onSnapshot` listeners to `users/{uid}/courses`, `users/{uid}/scheduleItems`, `users/{uid}/contacts`, and `users/{uid}` (preferences doc).
- **Concurrency & Optimistic Updates**:
  - `src/lib/firestore/scheduleItems.ts` implements per-item write queues (`pendingWrites`, `pendingDeletions`) and optimistic state reconciliation (`reconcileScheduleItems`) to prevent UI jitter or race conditions during rapid state transitions.
  - `src/lib/firestore/courses.ts` handles cascading batch writes and cascading deletes across courses, scheduleItems, contacts, syllabi, and Cloud Storage objects.

### Quality Assurance & Automated Check Suite
- **Testing Engine**: Vitest `4.1.10` with `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom`
  - **Result**: 59 test files passed (433 tests passed, 0 failed).
- **Linting**: ESLint `8.x` with `eslint-config-next`
  - **Result**: 0 errors, 0 warnings.
- **Type Checking**: `npx tsc --noEmit`
  - **Result**: 0 type errors.
- **Production Build**: `next build`
  - **Result**: Successfully compiled and generated 20/20 static and dynamic routes.

---

## 2. Directory Structure & Component Hierarchy

```
src/
├── app/
│   ├── (app)/                   # Protected authenticated layout group
│   │   ├── calendar/            # Month & Week interactive calendar
│   │   ├── contacts/            # Faculty & TA directory with email drafter
│   │   ├── courses/             # Course catalog & course detail pages
│   │   │   └── [courseId]/      # Course view (AI summary, grading, attendance, contacts)
│   │   ├── dashboard/           # Home dashboard (upcoming tasks, 7-day load, stats)
│   │   ├── planner/             # Smart workload planner (recommended start dates)
│   │   ├── profile/             # Student profile, GPA targets, preferences
│   │   ├── tasks/               # Task list & Workload Center
│   │   │   └── [taskId]/        # Task detail view & Late penalty advisor
│   │   └── layout.tsx           # LayoutWrapper (Navbar, Sidebar, MobileTabBar, Copilot)
│   ├── (auth)/                  # Auth route group (login, signup)
│   ├── api/syllabus/            # Claude AI API routes (chat, extract, file, summarize)
│   ├── globals.css              # Theme CSS variables and Tailwind directives
│   ├── icon.svg                 # PWA App Icon
│   ├── manifest.ts              # Web App Manifest generator
│   └── page.tsx                 # Public Landing Page
├── components/
│   ├── auth/                    # AuthGuard
│   ├── calendar/                # MonthCalendar, WeekView
│   ├── common/                  # CommandPalette, modals
│   ├── contacts/                # ContactsListView, ContactShareModal, ProfessorEmailDrafter
│   ├── courses/                 # CourseDetailView, CourseFormModal, GradeCalculatorModal, AttendanceGauge
│   ├── dashboard/               # DashboardView, NextClassHeroBanner, WorkloadRadarChart
│   ├── focus/                   # PomodoroTimer floating widget
│   ├── layout/                  # Navbar, Sidebar, MobileTabBar, FirestoreSync, OfflineBanner
│   ├── marketing/               # LandingPage
│   ├── planner/                 # ProjectChunkerModal, WorkloadOverviewDashboard, SmartPlanner
│   ├── profile/                 # ProfileView, GpaGoalRadial
│   ├── schedule/                # PlannerView, ExtracurricularView
│   ├── syllabus/                # SyllabusAutofillModal, SyllabusChatDrawer, SyllabusDiffModal, PdfViewer
│   ├── tasks/                   # TaskDetailView, TaskFormModal, TaskKanbanBoard, LatePenaltyAdvisor
│   └── ui/                      # Card, TaskRow, SectionIcon, CourseIconGlyph, EmptyState, ProgressRing
├── context/
│   ├── AppStateContext.tsx      # Main application state reducer and selectors
│   ├── AuthContext.tsx          # Firebase Auth user context
│   └── ThemeProvider.tsx        # Light/dark/system theme context
├── hooks/
│   ├── useModalA11y.ts          # Accessible dialog focus trapping & ESC handling
│   └── useOnlineStatus.ts       # Network online/offline status
├── lib/
│   ├── academic/                # Grade math & syllabus weight calculations
│   ├── ai/                      # Anthropic Claude client & tool schemas
│   ├── calendar/                # Date ranges, meeting recurrence math, ICS/vCard generators
│   ├── firebase/                # Client & Admin Firebase initialization
│   ├── firestore/               # Database mutation services (courses, scheduleItems, preferences)
│   ├── planner/                 # projectChunker.ts, computeSmartPlan.ts, examCollisionDetector.ts
│   ├── policy/                  # Late penalty calculation engines
│   ├── taskStatus.ts            # Derived task completion and progress utilities
│   ├── validation/              # Zod form schemas for courses and scheduleItems
│   └── workload/                # Cognitive load engine (constants, dailyLoad, scheduling, dateUtils)
└── types/
    ├── courseSummary.ts         # AI course summary Zod models
    ├── extraction.ts            # Syllabus extraction Zod models
    ├── schedule.ts              # Course, Contact, ScheduleItem, WorkloadLevel definitions
    └── syllabus.ts              # SyllabusUpload metadata
```

---

## 3. Data Models & Firestore Database Architecture

### Data Models (`src/types/schedule.ts`)

#### 1. `Course`
```typescript
export interface Course {
  id: string;
  code: string;                          // e.g., 'CSCI 213'
  title: string;                         // e.g., 'Computer Science I'
  instructor?: string;
  color?: string;                        // Tailwind swatch token or hex
  icon?: string;                         // Preset icon identifier (lib/courseIcons.ts)
  term?: string;                         // e.g., 'Fall 2026'
  notes?: string;
  source?: DataSource;                   // 'manual' | 'ai'
  modality?: CourseModality;             // 'in-person' | 'online' | 'hybrid'
  meetingTimes?: MeetingTime[];          // Weekly recurrence times
  materials?: string[];                  // Textbooks, equipment
  skipDates?: string[];                  // Holiday skip dates (YYYY-MM-DD)
  aiSummary?: CourseAiSummary;           // AI summary + important policy notes
  learningObjectives?: string[];
  learningObjectivesApproved?: boolean;
}
```

#### 2. `ScheduleItem` (Central Task / Milestone Model)
```typescript
export type AssignmentType = 'assignment' | 'exam' | 'quiz' | 'project' | 'reading' | 'other';
export type Priority = 'low' | 'medium' | 'high';
export type DataSource = 'manual' | 'ai';

export interface ScheduleItem {
  id: string;
  courseId: string;
  title: string;
  type: AssignmentType;
  dueDate: string;                       // ISO date string (YYYY-MM-DD or full ISO-8601)
  estimatedHours?: number;               // Planned study/work hours
  completed: boolean;                    // Authoritative completion flag
  progress?: number;                     // 0-100 percentage
  priority?: Priority;                   // 'low' | 'medium' | 'high'
  notes?: string;
  gradeWeight?: number;                  // e.g. 15 for 15% of final grade
  gradeCategory?: string;                // e.g. 'Homework', 'Midterm'
  source?: DataSource;
  dateConfidence?: 'exact' | 'approximate';
  highStakes?: boolean;
}
```

#### 3. `ProjectChunk` & `DailyWorkloadDay` (`src/lib/planner/projectChunker.ts`)
```typescript
export type ChunkableType =
  | 'project' | 'exam' | 'quiz' | 'assignment' | 'paper'
  | 'presentation' | 'reading' | 'coding' | 'portfolio'
  | 'group' | 'flashcards' | 'case_study';

export interface ProjectChunk {
  id: string;
  title: string;
  targetDate: string;                    // YYYY-MM-DD
  completedDate?: string;
  durationMinutes: number;
  completed: boolean;
  phase: string;
  type: ChunkableType;
}

export interface DailyWorkloadDay {
  dateStr: string;                       // YYYY-MM-DD
  dayName: string;                       // 'Mon', 'Tue', etc.
  formattedDate: string;                 // 'Aug 24'
  items: Array<{
    id: string;
    title: string;
    courseId?: string;
    durationMinutes: number;
    isChunk?: boolean;
    type?: string;
    completed?: boolean;
    isRollover?: boolean;
  }>;
  totalMinutes: number;
  completedMinutes: number;
  intensity: 'light' | 'moderate' | 'heavy';
}
```

---

## 4. Workload Engine & Chunking Architecture

### R1: Bite-Sized Study & Project Chunking Engine
- **Implementation**: `src/lib/planner/projectChunker.ts` and `src/components/planner/ProjectChunkerModal.tsx`.
- **Target Types Supported**: 12 distinct study target types (covers all 5 required targets: Final Project, Exam Study Plan, Quiz Review, Large Assignment/Lab, Essay/Term Paper, plus Coding, Presentation, Reading, Portfolio, Group Project, Flashcards, Case Study).
- **Specialized 4-Phase Schedules**:
  - `project`: Research & Architecture Outline -> Core Feature Implementation -> Testing, Bug Fixes & Refactoring -> Final Polish & Submission
  - `exam`: Lecture Notes & Key Concepts Review -> Practice Problems & Formula Drills -> Timed Mock Exam Run -> Weak Spot Refinement & Cheat Sheet
  - `quiz`: Flashcards & Key Term Definitions -> Targeted Practice Quiz Questions
  - `assignment`: Problem Breakdown & Initial Setup -> Core Solution Execution -> Verification & Format Check
  - `paper`: Thesis Statement & Literature Outline -> Drafting Introduction & Main Argument -> Evidence Mapping & Discussion -> Citations, Proofreading & Final Edit
- **Persistence**: Persists directly into Firestore `users/{uid}/scheduleItems` via `createScheduleItem(userId, itemData, dispatch)` with optimistic state dispatch.

### R2: Interactive 7-Day Workload Forecast & Date Shifter
- **Implementation**: `src/components/planner/WorkloadOverviewDashboard.tsx`.
- **Grid Layout**: 7-day responsive forecast tiles showing daily hours, item count, and dynamic intensity badge (`Light Pace`, `Moderate Pace`, `⚠️ Heavy Peak`).
- **Inspection & Date Shifter**: Selecting any day in the 7-day forecast inspects all tasks scheduled for that day. Uncompleted tasks contain an interactive date-picker `<input type="date">` that immediately shifts the task's due date and persists to Firestore via `updateScheduleItem`.

### R3: Retroactive Completion & Rollover Recalculation
- **Implementation**: `calculateWorkloadBreakdown` in `src/lib/planner/projectChunker.ts`.
- **Retroactive Completion**: Completed tasks are anchored to their original target dates, preserving the historical record.
- **Rollover Recalculation**: Incomplete past-due tasks (`dateStr < todayStr`) are dynamically rolled over to `today`, marked with `isRollover: true`, flagged in the rollover banner (`⚠️ X Rollover Tasks`), and factored into today's total scheduled study load.

---

## 5. UI Routes & Navigation Map (20 Verified Routes)

| # | Route | Type | Description / Component |
|---|---|---|---|
| 1 | `/` | Static | Public Landing Page (`LandingPage.tsx`) |
| 2 | `/_not-found` | Static | 404 handler |
| 3 | `/login` | Static | Firebase Auth login page |
| 4 | `/signup` | Static | Firebase Auth registration page |
| 5 | `/dashboard` | Static | Dashboard overview (`DashboardView.tsx`) |
| 6 | `/courses` | Static | Courses directory (`CoursesListView.tsx`) |
| 7 | `/courses/[courseId]` | Dynamic | Course detail (`CourseDetailView.tsx`) |
| 8 | `/tasks` | Static | Task Management & Workload Center (`PlannerView.tsx` + `WorkloadOverviewDashboard.tsx`) |
| 9 | `/tasks/[taskId]` | Dynamic | Task detail & late penalty policy (`TaskDetailView.tsx`) |
| 10 | `/planner` | Static | Smart study planner (`SmartPlanner.tsx`) |
| 11 | `/calendar` | Static | Month & Week interactive calendar (`MonthCalendar.tsx`, `WeekView.tsx`) |
| 12 | `/contacts` | Static | Faculty & TA directory (`ContactsListView.tsx`) |
| 13 | `/profile` | Static | Student profile & GPA goal radial (`ProfileView.tsx`) |
| 14 | `/api/syllabus/chat` | Dynamic API | Claude AI Syllabus Copilot streaming API |
| 15 | `/api/syllabus/extract` | Dynamic API | Claude AI Syllabus structure extraction API |
| 16 | `/api/syllabus/file` | Dynamic API | Document upload & text extraction API |
| 17 | `/api/syllabus/summarize` | Dynamic API | Syllabus summary & key policy notes API |
| 18 | `/icon.svg` | Static Asset | Dynamic app icon generator |
| 19 | `/manifest.webmanifest` | Static Asset | PWA Manifest |
| 20 | `(app)` Layout / App Shell | Route Group | Authenticated app shell (`LayoutWrapper.tsx`) |

---

## 6. Acceptance Criteria Validation Summary

1. **`npm run lint`**: Clean — 0 errors, 0 warnings.
2. **`npx tsc --noEmit`**: Clean — 0 type errors.
3. **`npm test`**: Clean — 59 test files passed (433 tests passed).
4. **`npm run build`**: Clean — 20 routes generated successfully.
