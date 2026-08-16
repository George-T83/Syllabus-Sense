'use client';

import { useFirestoreSync } from '@/lib/firestore/useFirestoreSync';

export default function FirestoreSync() {
  useFirestoreSync();
  return null;
}
