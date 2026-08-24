# Original User Request

## Initial Request — 2026-08-24T17:35:58Z

# Teamwork Project Prompt — Study & Project Chunking & Workload Center

Enable students to divide final projects, exam study plans, quizzes, lab assignments, and term papers into daily/weekly bite-sized tasks with interactive date shifting, retroactive completion anchoring, and a 7-day workload forecast grid.

Working directory: c:\Users\georg\source\repos\Syllabus-Sense
Integrity mode: development

## Requirements

### R1. Bite-Sized Study & Project Chunking Engine
- Support 5 distinct study target types: Final Project, Exam Study Plan, Quiz Review, Large Assignment/Lab, and Essay/Term Paper.
- Generate specialized 4-phase study schedules (e.g. Lecture Notes Review -> Practice Problems -> Mock Exam -> Weak Spot Polish for Exams).
- Allow 1-click persistence to Firestore scheduleItems with full real-time state synchronization.

### R2. Interactive 7-Day Workload Forecast & Date Shifter
- Provide a 7-day forecast grid displaying total planned study hours, task counts, and relative load intensity (Light, Moderate, Heavy Peak).
- Support 1-click day inspection and manual date-shifting controls so students can move bite-sized tasks to balance heavy workload peaks.

### R3. Retroactive Completion & Rollover Recalculation
- Anchor completed past tasks to their original target dates so past progress is preserved.
- Automatically roll over uncompleted past tasks to the current day for instant recalculation.

## Acceptance Criteria

### Automated Check Suite
- `npm run lint` passes with 0 errors and 0 warnings.
- `npx tsc --noEmit` passes with 0 type errors.
- `npm test` passes 100% of Vitest unit & integration tests.
- `npm run build` succeeds cleanly with 0 errors across all 20 routes.
