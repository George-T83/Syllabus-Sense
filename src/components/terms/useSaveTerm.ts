'use client';

import { useCallback } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { saveTerm } from '@/lib/firestore/terms';
import type { Term } from '@/types/term';

/** Saves a term to the signed-in student's account (see lib/firestore/terms.ts). */
export function useSaveTerm() {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  return useCallback(
    async (term: Term) => {
      if (!user) throw new Error('You must be signed in to save a term.');
      const previous = state.terms.find((t) => t.id === term.id);
      await saveTerm(user.uid, term, dispatch, previous);
    },
    [user, state.terms, dispatch],
  );
}
