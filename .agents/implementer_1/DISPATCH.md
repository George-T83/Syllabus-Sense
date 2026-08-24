## 2026-08-24T17:42:28Z
<USER_REQUEST>
You are the Implementation Worker for the Syllabus Sense Study & Project Chunking & Workload Center.
Read:
- Original Request: c:\Users\georg\source\repos\Syllabus-Sense\.agents\ORIGINAL_REQUEST.md
- Project Spec: C:\Users\georg\.gemini\antigravity\brain\49187bda-e309-48a4-bbe8-1c0e13e4ec89\PROJECT.md
- Spec Miner Report: c:\Users\georg\source\repos\Syllabus-Sense\.agents\spec_miner_2\analysis.md
- Explorer 1 Report: c:\Users\georg\source\repos\Syllabus-Sense\.agents\explorer_1\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Ensure complete, robust, and clean implementation across Milestones M1, M2, and M3:
1. M1: Bite-Sized Study & Project Chunking Engine & Persistence:
   - Verify/implement support for all 5 distinct study target types (project, exam, quiz, ssignment, paper) in src/lib/planner/projectChunker.ts and src/components/planner/ProjectChunkerModal.tsx.
   - Ensure specialized 4-phase schedules match specifications exactly.
   - Ensure linear temporal distribution and minute allocation with exact remainder distribution math.
   - Verify 1-click batch persistence to Firestore scheduleItems collection with optimistic local state update (ADD_SCHEDULE_ITEM or batch dispatch) and offline write queue sync.
2. M2: Interactive 7-Day Workload Forecast & Date Shifter:
   - In src/lib/planner/projectChunker.ts and src/components/planner/WorkloadOverviewDashboard.tsx, aggregate 7-day workload with planned hours, task counts, and load intensity (Light <= 2.5h, Moderate 2.5-5.0h, Heavy Peak > 5.0h).
   - Support 1-click day inspection panel/modal showing tasks for the selected day.
   - Support manual date shifting (date picker and quick-shift controls) updating dueDate in real time with dynamic grid recalculation.
3. M3: Retroactive Completion & Rollover Recalculation:
   - Ensure completed past tasks ( = true$) remain anchored to their original $ and preserve historical completed minutes.
   - Ensure uncompleted past tasks ( = false \land dueDate < today$) dynamically roll over into today's task list with isRollover: true and increment today's workload minutes, accompanied by rollover warning badges.
4. Verify all quality checks:
   - 
pm run lint (0 errors, 0 warnings)
   - 
px tsc --noEmit (0 errors)
   - 
pm test (100% passing)
   - 
pm run build (clean build across all 20 routes)

Report all test and build results in your handoff report.
</USER_REQUEST>
