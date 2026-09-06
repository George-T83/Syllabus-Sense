'use client';

import { Card } from '@/components/ui/Card';
import { CardActionLink } from '@/components/ui/CardAction';
import { SectionIcon } from '@/components/ui/SectionIcon';
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
    <Card accent="none" className="rounded-2xl border-primary/20 bg-primary/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SectionIcon icon="planner" />
          <div className="min-w-0">
            <span className="text-caption font-semibold uppercase tracking-wide text-primary">
              Advisor insight
            </span>
            <p className="text-body-sm font-semibold text-foreground">
              {lagging.category.name} is falling behind your other requirement categories.
            </p>
          </div>
        </div>
        <CardActionLink
          href={`/advisor?prompt=${encodeURIComponent(prompt)}`}
          variant="solid"
          withChevron
          className="shrink-0"
        >
          Continue in Advisor
        </CardActionLink>
      </div>
    </Card>
  );
}
