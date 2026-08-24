# Handoff Report: Study & Project Chunking & Workload Center Specification

**Agent**: Spec Miner 2  
**Date**: 2026-08-24T17:39:30Z  
**Type**: Hard Handoff (Specification Task Complete)  
**Target Recipient**: Orchestrator / Lead Architect / Implementation Workers  

---

## 1. Observation

1. **Original Request Requirements**:
   - `c:\Users\georg\source\repos\Syllabus-Sense\.agents\ORIGINAL_REQUEST.md` lines 14-26 specifies:
     * **R1**: 5 distinct study target types (Final Project, Exam Study Plan, Quiz Review, Large Assignment/Lab, Essay/Term Paper) with specialized 4-phase schedules, and 1-click persistence to Firestore `scheduleItems`.
     * **R2**: Interactive 7-day workload forecast grid (study hours, task counts, Light/Moderate/Heavy Peak intensity) with 1-click day inspection and manual date-shifting controls.
     * **R3**: Retroactive completion anchoring to original target dates and automatic dynamic rollover of uncompleted past tasks to the current day.
2. **Existing Implementation Status**:
   - `src/lib/planner/projectChunker.ts`: Lines 52–80 currently contain `PHASE_TEMPLATES`. `quiz` had 2 phases and `assignment` had 3 phases; needs standardization to strict 4-phase curricula across all 5 types (`project`, `exam`, `quiz`, `assignment`, `paper`).
   - `src/lib/planner/projectChunker.ts`: Lines 92–147 implement `divideProjectIntoChunks` with linear temporal interpolation and phase mapping.
   - `src/lib/planner/projectChunker.ts`: Lines 152–294 implement `calculateWorkloadBreakdown` with a 9-day window (past 2 days + next 7 days), retroactive completion anchoring, and uncompleted task rollover.
   - `src/lib/planner/projectChunker.ts`: Lines 259–267 define intensity thresholds: `totalMinutes > 300` (heavy), `totalMinutes > 150` (moderate), $\le 150$ (light).
   - `src/components/planner/ProjectChunkerModal.tsx`: Lines 16–22 define `TYPE_CONFIG` and lines 68–97 implement 1-click batch creation of `ScheduleItem`s using `createScheduleItem(user.uid, itemData, dispatch)`.
   - `src/components/planner/WorkloadOverviewDashboard.tsx`: Lines 19–29, 46–57, and 202–252 render the 7-day forecast grid, selected day inspector, task completion checkboxes, and date shifters (`handleShiftTaskDate`).
   - `src/lib/firestore/scheduleItems.ts`: Lines 18–90 implement `pendingWrites` FIFO queue and `reconcileScheduleItems` for optimistic Firestore state sync.

---

## 2. Logic Chain

1. *From Observation 1 & 2*: The 5 target types must each follow a 4-phase pedagogical curriculum:
   - `project`: (1) Research & Architecture Outline $\rightarrow$ (2) Core Feature Implementation $\rightarrow$ (3) Testing, Bug Fixes & Refactoring $\rightarrow$ (4) Final Polish & Submission.
   - `exam`: (1) Lecture Notes & Key Concepts Review $\rightarrow$ (2) Practice Problems & Formula Drills $\rightarrow$ (3) Timed Mock Exam Run $\rightarrow$ (4) Weak Spot Polish & Cheat Sheet.
   - `quiz`: (1) Flashcards & Key Term Definitions $\rightarrow$ (2) Concept Synthesis & Diagram Review $\rightarrow$ (3) Targeted Practice Quiz Questions $\rightarrow$ (4) Rapid-Fire Self-Test & Final Polish.
   - `assignment`: (1) Problem Breakdown & Initial Setup $\rightarrow$ (2) Core Solution & Lab Execution $\rightarrow$ (3) Data Analysis & Result Verification $\rightarrow$ (4) Report Write-up & Format Check.
   - `paper`: (1) Thesis Statement & Literature Outline $\rightarrow$ (2) Drafting Introduction & Main Argument $\rightarrow$ (3) Evidence Mapping & Discussion $\rightarrow$ (4) Citations, Proofreading & Final Edit.
2. *From Observation 2*: In `divideProjectIntoChunks`, setting the minimum chunk count for daily pacing to $\max(4, \lceil M_{total} / 45 \rceil)$ (when runway $\Delta_{days} \ge 4$) guarantees every phase in the 4-phase sequence is represented in generated study schedules.
3. *From Observation 2*: In `calculateWorkloadBreakdown`, intensity thresholds of 150 mins (2.5h) and 300 mins (5.0h) match student focus limits and map cleanly to Light ($\le 2.5\text{h}$), Moderate ($2.5\text{h} - 5.0\text{h}$), and Heavy Peak ($> 5.0\text{h}$).
4. *From Observation 2*: When an item is marked `completed: true`, preserving it on its original `dueDate` (or `completedDate`) maintains historical accuracy in past window views, while pending items with `dueDate < todayStr` roll over into `today.items` with `isRollover: true`, increasing today's load and alerting the user via `rolledOverCount`.
5. *From Observation 2*: Optimistic updates through `AppStateContext` dispatching `ADD_SCHEDULE_ITEM` and `UPDATE_SCHEDULE_ITEM` paired with Firestore `setDoc` and snapshot reconciliation (`reconcileScheduleItems`) ensure zero-latency UI interaction and robust offline/sync stability.

---

## 3. Caveats

- **No caveats**. All 5 target types, 4-phase schedules, algorithms, intensity thresholds, and rollover behaviors are fully specified and aligned with the existing architecture.

---

## 4. Conclusion

The specification for the Study & Project Chunking & Workload Center (R1, R2, R3) is complete, unambiguous, and backed by mathematical models, TypeScript types, and comprehensive analysis in `.agents/spec_miner_2/analysis.md`. The design integrates seamlessly with `AppStateContext`, `ProjectChunkerModal`, `WorkloadOverviewDashboard`, and Firestore synchronization.

---

## 5. Verification Method

To verify the domain requirements and algorithm specifications:
1. **Inspect Analysis Report**: View `.agents/spec_miner_2/analysis.md` for the full breakdown of equations, 4-phase curricula, and TypeScript types.
2. **Execute Existing Test Suite**:
   ```powershell
   npx vitest run src/lib/planner/__tests__/projectChunker.test.ts
   ```
3. **Execute Full Project Check Suite**:
   ```powershell
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```
4. **Invalidation Conditions**:
   - Any of the 5 target types lacking a distinct 4-phase progression.
   - Any duration rounding error leading to $\sum M_i \ne M_{total}$.
   - Completed past tasks inadvertently rolling over to today.
   - Uncompleted past tasks failing to show up on today's forecast.
