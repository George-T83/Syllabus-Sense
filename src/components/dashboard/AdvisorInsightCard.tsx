'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useDegreeProfile, useDegreeCourses } from '@/lib/firestore/useDegreeCompass';
import { computeCategoryProgress, computeOverallProgress } from '@/lib/degreeCompass/progress';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

/** A category counts as "falling behind" once it trails the overall
 * completion percentage by more than this - small gaps are normal (not
 * every category is worked on every term), so only a real gap surfaces a
 * nudge rather than manufacturing one every time Degree Compass is set up. */
const LAG_THRESHOLD = 0.15;

interface LaggingCategory {
  category: DegreeRequirementCategory;
  categoryPct: number;
}

function findLaggingCategory(
  categories: DegreeRequirementCategory[],
  courses: DegreeCourse[],
): LaggingCategory | null {
  const overall = computeOverallProgress(categories, courses);
  if (overall.creditsRequired === 0) return null;
  const overallPct =
    (overall.creditsCompleted + overall.creditsInProgress) / overall.creditsRequired;

  let worst: LaggingCategory | null = null;
  for (const c of computeCategoryProgress(categories, courses)) {
    if (c.category.creditsRequired === 0 || c.creditsRemaining === 0) continue;
    const pct = (c.creditsCompleted + c.creditsInProgress) / c.category.creditsRequired;
    if (!worst || pct < worst.categoryPct) worst = { category: c.category, categoryPct: pct };
  }

  if (!worst || overallPct - worst.categoryPct < LAG_THRESHOLD) return null;
  return worst;
}

/**
 * Direction C from the AI Advisor design exploration: a proactive nudge on
 * the Dashboard, not just a passive chat waiting to be opened. Only renders
 * when there's a real, computed gap to report - no generic filler insight
 * for an account with no Degree Compass data or nothing genuinely lagging.
 */
export function AdvisorInsightCard() {
  const { user } = useAuth();
  const { profile } = useDegreeProfile(user?.uid);
  const degreeCourses = useDegreeCourses(user?.uid);

  if (!profile) return null;
  const lagging = findLaggingCategory(profile.categories, degreeCourses);
  if (!lagging) return null;

  const prompt = `Why is ${lagging.category.name} falling behind, and what should I do about it?`;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-5 text-white shadow-card">
      <div className="relative z-10 space-y-3">
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-white/80">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 2L3 14h7v8l10-12h-7z" />
          </svg>
          Advisor insight
        </span>
        <p className="text-h3 font-bold leading-snug text-white">
          {lagging.category.name} is falling behind your other requirement categories.
        </p>
        <Link
          href={`/advisor?prompt=${encodeURIComponent(prompt)}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-label text-primary shadow-sm transition-transform hover:scale-[1.02]"
        >
          Continue in Advisor
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
