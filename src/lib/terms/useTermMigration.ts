'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { applyTermMigration } from '@/lib/firestore/terms';
import { isEmptyPlan, planTermMigration } from '@/lib/terms/termMigration';

/**
 * Turns the plain-text term labels on a student's existing courses into term
 * objects, once courses and terms have both loaded. Labels with standard
 * dates (Fall, Spring, Summer + year) are created with those dates and the
 * courses linked; the course keeps its label and everything else. Labels
 * without standard dates are returned so the student can be asked for their
 * dates (TermMigrationPrompt) - they are never guessed, and the courses that
 * use them are left exactly as they were until the student answers.
 *
 * Safe to run from several devices at once: migrated terms get an id made
 * from their label, so every device writes the same documents.
 */
export function useTermMigration(): string[] {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const plan = useMemo(
    () => planTermMigration(state.courses, state.terms),
    [state.courses, state.terms],
  );
  const lastWritten = useRef('');
  const ready = Boolean(user) && state.initialized && state.termsLoaded;

  useEffect(() => {
    if (!user || !ready || isEmptyPlan(plan)) return;
    // The same plan is never written twice in a row, so a write that is
    // failing (offline, rules not deployed yet) cannot loop.
    const key = JSON.stringify([plan.newTerms.map((t) => t.id), plan.courseLinks]);
    if (lastWritten.current === key) return;
    lastWritten.current = key;
    applyTermMigration(user.uid, plan, state.courses, dispatch).catch((err) => {
      console.error('[useTermMigration] could not link courses to terms:', err);
    });
  }, [user, ready, plan, state.courses, dispatch]);

  return ready ? plan.unknownLabels : [];
}
