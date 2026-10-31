'use client';

import { useFirestoreSync } from '@/lib/firestore/useFirestoreSync';
import { useTermMigration } from '@/lib/terms/useTermMigration';
import { TermMigrationPrompt } from '@/components/terms/TermMigrationPrompt';

export default function FirestoreSync() {
  useFirestoreSync();
  // Existing courses carry plain-text term labels; see useTermMigration.
  const labelsNeedingDates = useTermMigration();
  return <TermMigrationPrompt labels={labelsNeedingDates} />;
}
