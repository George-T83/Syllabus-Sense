## 2026-08-24T17:37:08Z

You are Spec Miner 2 for the Syllabus Sense Study & Project Chunking & Workload Center implementation.
Read the original request at: c:\Users\georg\source\repos\Syllabus-Sense\.agents\ORIGINAL_REQUEST.md

Your mission:
Investigate and specify precise domain requirements, data structures, and algorithm specs:
1. R1: Bite-Sized Study & Project Chunking Engine
   - 5 distinct study target types: Final Project, Exam Study Plan, Quiz Review, Large Assignment/Lab, Essay/Term Paper.
   - Specialized 4-phase study schedules (e.g. Lecture Notes Review -> Practice Problems -> Mock Exam -> Weak Spot Polish for Exams; what are the exact 4 phases for each of the 5 target types?).
   - Chunking algorithms (date distribution, hours calculation, phase sequencing, milestone breakdown).
   - 1-click persistence to Firestore `scheduleItems` with real-time state synchronization.
2. R2: Interactive 7-Day Workload Forecast & Date Shifter
   - 7-day forecast grid: planned study hours, task counts, relative load intensity (Light, Moderate, Heavy Peak with exact thresholds/calculation).
   - 1-click day inspection modal/panel and manual date-shifting controls (moving tasks between days).
3. R3: Retroactive Completion & Rollover Recalculation
   - Completed past tasks: anchored to original target dates to preserve history.
   - Uncompleted past tasks: automatically rolled over to current day for instant recalculation.
4. Interface contracts, TypeScript types, and state management hooks/services needed.

Write your findings to your analysis/handoff report and summarize your conclusions.
