'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useToast } from '@/components/ui/Toast';
import type { AdvisorMessage } from '@/types/advisor';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/**
 * The Advisor is "a standing conversation about your whole degree, not a
 * per-syllabus drawer" (per the design direction) - the history is real,
 * persisted Firestore state rather than component state, so it survives a
 * refresh or a return visit the same way every other collection in this app
 * does.
 */
export async function appendAdvisorMessage(userId: string, message: AdvisorMessage): Promise<void> {
  const record: AdvisorMessage = { ...message };
  if (!record.warning) delete record.warning;
  await setDoc(doc(requireDb(), 'users', userId, 'advisorMessages', record.id), record);
}

export function useAdvisorMessages(userId: string | undefined): {
  messages: AdvisorMessage[];
  loading: boolean;
} {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    if (!userId || !db) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'users', userId, 'advisorMessages'),
      orderBy('createdAt', 'asc'),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map((d) => d.data() as AdvisorMessage));
        setLoading(false);
      },
      (error: FirestoreError) => {
        console.error('[useAdvisorMessages] listener failed:', error);
        showError("Couldn't load your Advisor conversation", 'Try refreshing the page.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [userId, showError]);

  return { messages, loading };
}
