import { collection, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { generateInviteCode } from '@/lib/courseGroups/inviteCode';
import type { CourseGroup, CourseGroupMember, CourseGroupCheckpoint } from '@/types/courseGroup';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/** How many times to retry generating a fresh code if it happens to already
 * exist - astronomically unlikely at this app's scale (32^8 combinations)
 * but cheap enough to guard against a collision outright rather than
 * silently letting two unrelated groups collide on the same code. */
const MAX_CODE_GENERATION_ATTEMPTS = 5;

async function generateUnusedInviteCode(): Promise<string> {
  const database = requireDb();
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateInviteCode();
    const existing = await getDoc(doc(database, 'courseGroups', code));
    if (!existing.exists()) return code;
  }
  throw new Error('Could not generate a unique invite code. Please try again.');
}

/** Creates a new group and joins its creator as the first member in one
 * call - a group with no members would be a dead end nobody could reach
 * (membership is what gates every other read). */
export async function createCourseGroup(
  uid: string,
  courseLabel: string,
  displayName: string,
  showRealName: boolean,
): Promise<string> {
  const database = requireDb();
  const code = await generateUnusedInviteCode();
  const now = new Date().toISOString();

  const group: CourseGroup = { code, courseLabel, createdBy: uid, createdAt: now };
  await setDoc(doc(database, 'courseGroups', code), group);

  const member: CourseGroupMember = { uid, displayName, showRealName, joinedAt: now };
  await setDoc(doc(database, 'courseGroups', code, 'members', uid), member);

  return code;
}

/** One-off lookup by code, for previewing a group ("You're about to join:
 * CS 301") before actually joining it - any signed-in user can read this per
 * firestore.rules, since knowing the code is what authorizes it. */
export async function getCourseGroup(code: string): Promise<CourseGroup | null> {
  const database = requireDb();
  const snapshot = await getDoc(doc(database, 'courseGroups', code));
  return snapshot.exists() ? (snapshot.data() as CourseGroup) : null;
}

export async function joinCourseGroup(
  code: string,
  uid: string,
  displayName: string,
  showRealName: boolean,
): Promise<void> {
  const database = requireDb();
  const member: CourseGroupMember = {
    uid,
    displayName,
    showRealName,
    joinedAt: new Date().toISOString(),
  };
  await setDoc(doc(database, 'courseGroups', code, 'members', uid), member);
}

export async function leaveCourseGroup(code: string, uid: string): Promise<void> {
  const database = requireDb();
  await deleteDoc(doc(database, 'courseGroups', code, 'members', uid));
}

export async function updateMemberNamePreference(
  code: string,
  uid: string,
  displayName: string,
  showRealName: boolean,
  joinedAt: string,
): Promise<void> {
  const database = requireDb();
  const member: CourseGroupMember = { uid, displayName, showRealName, joinedAt };
  await setDoc(doc(database, 'courseGroups', code, 'members', uid), member);
}

export async function addCheckpoint(
  code: string,
  uid: string,
  label: string,
): Promise<CourseGroupCheckpoint> {
  const database = requireDb();
  const id = crypto.randomUUID();
  const checkpoint: CourseGroupCheckpoint = {
    id,
    label,
    createdBy: uid,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(database, 'courseGroups', code, 'checkpoints', id), checkpoint);
  return checkpoint;
}

export async function deleteCheckpoint(code: string, checkpointId: string): Promise<void> {
  const database = requireDb();
  await deleteDoc(doc(database, 'courseGroups', code, 'checkpoints', checkpointId));
}

export async function setConfirmation(
  code: string,
  checkpointId: string,
  uid: string,
  displayName: string,
  dateValue: string,
): Promise<void> {
  const database = requireDb();
  const id = `${checkpointId}_${uid}`;
  await setDoc(doc(database, 'courseGroups', code, 'confirmations', id), {
    id,
    checkpointId,
    uid,
    displayName,
    date: dateValue,
    confirmedAt: new Date().toISOString(),
  });
}

export async function removeConfirmation(
  code: string,
  checkpointId: string,
  uid: string,
): Promise<void> {
  const database = requireDb();
  await deleteDoc(doc(database, 'courseGroups', code, 'confirmations', `${checkpointId}_${uid}`));
}

/** Collection reference helpers, kept here rather than duplicated in each
 * hook's onSnapshot call. */
export function membersCollection(code: string) {
  return collection(requireDb(), 'courseGroups', code, 'members');
}

export function checkpointsCollection(code: string) {
  return collection(requireDb(), 'courseGroups', code, 'checkpoints');
}

export function confirmationsCollection(code: string) {
  return collection(requireDb(), 'courseGroups', code, 'confirmations');
}
