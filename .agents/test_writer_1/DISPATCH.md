## 2026-08-24T17:42:28Z
You are the E2E Test Writer for the Syllabus Sense Study & Project Chunking & Workload Center.
Read:
- Original Request: c:\Users\georg\source\repos\Syllabus-Sense\.agents\ORIGINAL_REQUEST.md
- Project Spec: C:\Users\georg\.gemini\antigravity\brain\49187bda-e309-48a4-bbe8-1c0e13e4ec89\PROJECT.md
- Test Infra Spec: C:\Users\georg\.gemini\antigravity\brain\49187bda-e309-48a4-bbe8-1c0e13e4ec89\TEST_INFRA.md

Your mission:
Implement comprehensive Tier 1-4 opaque-box tests for all features in the Feature Inventory:
1. Tier 1 (Feature Coverage >=5 per feature):
   - F1: 5 Target Types (`project`, `exam`, `quiz`, `assignment`, `paper`).
   - F2: Specialized 4-phase schedules per target type.
   - F3: 1-click persistence to Firestore `scheduleItems` with real-time state sync.
   - F4: 7-day forecast grid (hours, task count, Light/Moderate/Heavy Peak classification).
   - F5: 1-click day inspection.
   - F6: Interactive date shifter.
   - F7: Retroactive completion anchoring (past completed tasks stay on original date).
   - F8: Dynamic rollover recalculation (past uncompleted tasks roll over to today).
2. Tier 2 (Boundary & Corner Cases >=5 per feature):
   - Same-day start and due dates, 1-day projects, large 60-day projects, odd minute totals with remainder distribution, zero hours, midnight boundaries, leap years, empty task lists, high task volume.
3. Tier 3 (Cross-Feature Combinations):
   - Pairwise tests: rollover + date shift, completed past task + date shift, multi-course chunking + Firestore sync, 4-phase exam + workload intensity recalculation.
4. Tier 4 (Real-World Scenarios >=5 scenarios):
   - Midterm sprint, multi-week senior project milestone crunch, sick day rollover recovery, term paper synthesis with mixed deadlines, end-of-semester grade polish workload balancing.

Target test files:
- `src/lib/planner/__tests__/projectChunker.test.ts`
- `src/components/planner/__tests__/ProjectChunkerModal.test.tsx`
- `src/components/planner/__tests__/WorkloadOverviewDashboard.test.tsx`

Verify your tests by running `npm test`.
When complete, write `TEST_READY.md` at project root (`c:\Users\georg\source\repos\Syllabus-Sense\TEST_READY.md`) summarizing the test suites and runner command.
Write your handoff report and notify the orchestrator.
