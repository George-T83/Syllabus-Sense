'use client';

import { useEffect, useState } from 'react';
import { onSnapshot, type FirestoreError } from 'firebase/firestore';
import { useToast } from '@/components/ui/Toast';
import {
  membersCollection,
  checkpointsCollection,
  confirmationsCollection,
} from '@/lib/firestore/courseGroups';
import type {
  CourseGroupMember,
  CourseGroupCheckpoint,
  CheckpointConfirmation,
} from '@/types/courseGroup';

/** Live member roster for a group - each entry's `showRealName` is what the
 * UI checks before ever rendering a real name to anyone else in the group. */
export function useCourseGroupMembers(code: string | undefined) {
  const [members, setMembers] = useState<CourseGroupMember[]>([]);
  const { showError } = useToast();

  useEffect(() => {
    if (!code) {
      setMembers([]);
      return;
    }
    const unsubscribe = onSnapshot(
      membersCollection(code),
      (snapshot) => setMembers(snapshot.docs.map((d) => d.data() as CourseGroupMember)),
      (error: FirestoreError) => {
        console.error('[useCourseGroupMembers] listener failed:', error);
        showError("Couldn't load section sync members", 'Try refreshing the page.');
      },
    );
    return unsubscribe;
  }, [code, showError]);

  return members;
}

export function useCourseGroupCheckpoints(code: string | undefined) {
  const [checkpoints, setCheckpoints] = useState<CourseGroupCheckpoint[]>([]);
  const { showError } = useToast();

  useEffect(() => {
    if (!code) {
      setCheckpoints([]);
      return;
    }
    const unsubscribe = onSnapshot(
      checkpointsCollection(code),
      (snapshot) => setCheckpoints(snapshot.docs.map((d) => d.data() as CourseGroupCheckpoint)),
      (error: FirestoreError) => {
        console.error('[useCourseGroupCheckpoints] listener failed:', error);
        showError("Couldn't load section sync checkpoints", 'Try refreshing the page.');
      },
    );
    return unsubscribe;
  }, [code, showError]);

  return checkpoints;
}

/** Every confirmation in the group, across all checkpoints - kept as one
 * flat listener rather than one per checkpoint (see firestore.rules for why
 * confirmations are a flat sibling collection, not nested under each
 * checkpoint). Callers filter by `checkpointId` client-side. */
export function useCourseGroupConfirmations(code: string | undefined) {
  const [confirmations, setConfirmations] = useState<CheckpointConfirmation[]>([]);
  const { showError } = useToast();

  useEffect(() => {
    if (!code) {
      setConfirmations([]);
      return;
    }
    const unsubscribe = onSnapshot(
      confirmationsCollection(code),
      (snapshot) => setConfirmations(snapshot.docs.map((d) => d.data() as CheckpointConfirmation)),
      (error: FirestoreError) => {
        console.error('[useCourseGroupConfirmations] listener failed:', error);
        showError("Couldn't load section sync confirmations", 'Try refreshing the page.');
      },
    );
    return unsubscribe;
  }, [code, showError]);

  return confirmations;
}
