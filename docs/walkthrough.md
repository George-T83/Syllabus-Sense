# Syllabus Sense Academic Command Center — Walkthrough Guide

Welcome to the **Syllabus Sense Academic Command Center**. This guide walks you through every major subsystem and revolutionary academic feature delivered in the 52-Item Hardening Pass on integration branch `overnight/2026-08-24`.

---

## 1. Quick Verification & 4-Point Check Suite

Run the following commands in the repository root to verify complete system integrity:

```bash
# 1. Linting (0 errors / 0 warnings)
npm run lint

# 2. TypeScript compilation (0 type errors, exit code 0)
npx tsc --noEmit

# 3. Unit and Integration Test Suites (58 test files / 430 tests passing)
npm test

# 4. Production Next.js Build (20 static/dynamic routes compiled)
npm run build
```

---

## 2. Feature Walkthrough & Interactive Guide

### A. Intelligent Navigation & Power-User Tools

- **Global Command Palette (`Cmd+K` / `Ctrl+K` | Item 34 & Item 50)**:
  - Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) anywhere in the application.
  - Fuzzy-search courses, quick jump to planner/calendar/tasks, or trigger instant actions like "Start Pomodoro Timer", "Calculate GPA", or "New Task".
  - Press `?` to open the Global Keyboard Shortcuts Cheat Sheet.

- **Quick-Join Next Class Hero Banner (Item 44)**:
  - Located at the top of the Dashboard.
  - Automatically identifies your next upcoming class session based on real-time schedule rules.
  - Displays room location, countdown timer, and a one-click "Join Meeting" Zoom/Teams link or campus map directions.

---

### B. AI Copilot & Syllabus Intelligence

- **AI Syllabus Chat Copilot Drawer (Item 35)**:
  - Click the **"Ask Syllabus AI"** button on any course or syllabus page.
  - A slide-out drawer opens with quick suggestion chips ("What is the late work policy?", "When are office hours?", "How is the final grade weighted?").
  - Responses are synthesized with full syllabus document citation support.

- **Syllabus Policy Diff & Revision Detector (Item 46)**:
  - When professors release updated syllabus versions mid-semester, open the **Syllabus Diff Modal**.
  - Side-by-side color-coded visual diff highlights policy shifts, added homework deadlines, and rescheduled midterm exams.

---

### C. Academic Analytics & Grade Engineering

- **What-If Grade Simulator & Final Exam Solver (Item 36)**:
  - Open from the Course Detail page or Command Palette.
  - Interactive sliders let students simulate target grades and calculate the exact minimum score needed on the final exam to secure an A, B, or pass.

- **Semester GPA Goal Radial Progress Tracker (Item 47)**:
  - Located on the student Profile page and Dashboard header.
  - Sets custom semester GPA targets and visualizes progress in an animated SVG radial ring computed from weighted course credit hours.

- **Weekly Cognitive Workload Radar Chart (Item 37)**:
  - Multi-dimensional SVG radar polygon on the Dashboard visualizing cognitive load across all 6+ courses.
  - Instantly reveals deadline pile-ups and study stress zones before burnout occurs.

---

### D. Agile Productivity & Task Management

- **Task Kanban Multi-View (Item 38)**:
  - On the Tasks page, switch between **List View** and **Kanban Board**.
  - Columns: _Backlog_, _This Week_, _In Progress_, and _Completed_.
  - Full keyboard accessibility and tactile drag-and-drop card status moves.

- **Eisenhower Priority Matrix View (Item 39)**:
  - Triage assignments into 4 colored quadrants: _Urgent & Important (Do First)_, _Important / Not Urgent (Schedule)_, _Urgent / Not Important (Quick Tackle)_, and _Low Priority_.

- **Smart Exam Collision & Triple-Deadline Engine (Item 40)**:
  - Automatically flags 48-hour collision windows containing 2+ exams or 3+ major deliverables with proactive preparation alerts.

- **Pomodoro Focus Study Timer (Item 42)**:
  - Built-in 25/5 interval study timer directly attached to tasks with Web Audio chime alerts.

---

### E. Campus Networking & Policy Compliance

- **Study Group Contact vCard & QR Code Generator (Item 45)**:
  - Share professor, TA, and study group contact information with a single click via downloadable vCard (.vcf) or mobile-scannable QR code.

- **Professor Email Drafter Modal (Item 41)**:
  - Contextual modal with 4 pre-filled templates: _Extension Request_, _Absence Notice_, _General Question_, and _Office Hours_.
  - Automatically populates the professor's preferred name (`howToAddress`), course code, and assignment title.

- **Attendance Allowance Policy Gauge (Item 48)**:
  - Course-level circular badge tracking remaining unexcused absences against course policy rules.

- **Late Submission Penalty & Grace Slip Days Advisor (Item 49)**:
  - Sliding simulator displaying exact grade deduction curves and free slip day deductions before turning in late work.

- **Extracurricular & Internship Milestone Tracker (Item 43)**:
  - Track club commitments, lab research hours, and internship application milestones alongside coursework.

---

### F. Mobile Polish, Accessibility & PWA

- **44x44px Touch Targets & Zero Horizontal Panning (Items 21, 22, 23)**:
  - Strict WCAG 2.5.5 touch target sizing on mobile and `scrollWidth <= innerWidth` zero-scroll layout on 375px screens (iPhone SE).
- **PWA Web App Manifest & Standalone Shell (Items 26, 27)**:
  - Standalone app manifest with full icons suite and dynamic light/dark theme color status bar.
- **Offline Network Status Banner (Item 29)**:
  - Reassuring banner alerting students when studying offline in lecture halls or subways.
- **Modular Route Skeletons (Item 28)**:
  - Zero layout shift shimmer loading skeletons across all Next.js App Router subpages.
