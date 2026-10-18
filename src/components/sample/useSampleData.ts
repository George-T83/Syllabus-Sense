'use client';

import { useCallback, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { loadSampleSemester, removeSampleData } from '@/lib/firestore/sample';
import { hasSampleData } from '@/lib/sample/sampleSemester';

/**
 * Load / remove for the sample semester, shared by every place that offers
 * it (Courses empty state, dashboard checklist and banner, Profile).
 */
export function useSampleData() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasSample = useMemo(
    () =>
      hasSampleData({
        courses: state.courses,
        scheduleItems: state.scheduleItems,
        contacts: state.contacts,
      }),
    [state.courses, state.scheduleItems, state.contacts],
  );

  const load = useCallback(async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const terms = state.courses.map((c) => c.term).filter((t): t is string => Boolean(t));
      await loadSampleSemester(user.uid, terms, dispatch);
      showSuccess('Sample semester loaded', 'Explore the app, then remove it whenever you like.');
    } catch (err) {
      console.error('Failed to load sample semester:', err);
      showError("Couldn't load the sample semester. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [user, loading, state.courses, dispatch, showError, showSuccess]);

  const remove = useCallback(async () => {
    if (!user || removing) return;
    setRemoving(true);
    try {
      await removeSampleData(
        user.uid,
        { courses: state.courses, scheduleItems: state.scheduleItems, contacts: state.contacts },
        dispatch,
      );
      showSuccess('Sample data removed');
    } catch (err) {
      console.error('Failed to remove sample data:', err);
      showError("Couldn't remove the sample data. Try again in a moment.");
    } finally {
      setRemoving(false);
    }
  }, [
    user,
    removing,
    state.courses,
    state.scheduleItems,
    state.contacts,
    dispatch,
    showError,
    showSuccess,
  ]);

  return { hasSample, load, remove, loading, removing };
}
