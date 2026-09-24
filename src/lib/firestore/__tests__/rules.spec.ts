// @vitest-environment node
/**
 * Emulator-backed audit of firestore.rules (issue #77).
 *
 * Requires the Firestore emulator to be running (see package.json's
 * `test:rules` script, which wraps this file with `firebase emulators:exec`).
 * Do not run via the default `npm run test` — see the `--exclude` flag on
 * the `test` script.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const OWNER_UID = 'owner-alice';
const OTHER_UID = 'intruder-bob';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-syllabus-sense-rules-test',
    firestore: {
      rules: readFileSync(path.resolve(__dirname, '../../../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

/** Seeds a document while bypassing security rules, as setup normally would via the Admin SDK. */
async function seed(docPath: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), docPath), data);
  });
}

/** Document paths that exist directly under a user's own document tree, per firestore.rules. */
const ownedDocPaths: Array<{ label: string; path: (uid: string) => string }> = [
  { label: 'profile document (users/{uid})', path: (uid) => `users/${uid}` },
  {
    label: 'course document (users/{uid}/courses/{id})',
    path: (uid) => `users/${uid}/courses/course-1`,
  },
  {
    label: 'syllabus document (users/{uid}/courses/{id}/syllabi/{id})',
    path: (uid) => `users/${uid}/courses/course-1/syllabi/syllabus-1`,
  },
  {
    label: 'schedule item (users/{uid}/scheduleItems/{id})',
    path: (uid) => `users/${uid}/scheduleItems/item-1`,
  },
  {
    label: 'contact (users/{uid}/contacts/{id})',
    path: (uid) => `users/${uid}/contacts/contact-1`,
  },
  {
    label: 'flashcard (users/{uid}/flashcards/{id})',
    path: (uid) => `users/${uid}/flashcards/card-1`,
  },
  {
    label: 'quiz (users/{uid}/quizzes/{id})',
    path: (uid) => `users/${uid}/quizzes/quiz-1`,
  },
  {
    label: 'quiz attempt (users/{uid}/quizAttempts/{id})',
    path: (uid) => `users/${uid}/quizAttempts/attempt-1`,
  },
  {
    label: 'mood entry (users/{uid}/moodEntries/{id})',
    path: (uid) => `users/${uid}/moodEntries/2026-09-03`,
  },
  {
    label: 'degree profile (users/{uid}/degreeProfile/{id})',
    path: (uid) => `users/${uid}/degreeProfile/profile`,
  },
  {
    label: 'degree course (users/{uid}/degreeCourses/{id})',
    path: (uid) => `users/${uid}/degreeCourses/course-1`,
  },
  {
    label: 'advisor message (users/{uid}/advisorMessages/{id})',
    path: (uid) => `users/${uid}/advisorMessages/message-1`,
  },
];

describe('firestore.rules: owner-only access', () => {
  describe.each(ownedDocPaths)('$label', ({ path: docPath }) => {
    beforeEach(async () => {
      await seed(docPath(OWNER_UID), { name: 'seeded' });
    });

    it('allows the owner to read their own document', async () => {
      const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(getDoc(doc(ownerDb, docPath(OWNER_UID))));
    });

    it('allows the owner to write their own document', async () => {
      const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(setDoc(doc(ownerDb, docPath(OWNER_UID)), { name: 'updated' }));
    });

    it('allows the owner to delete their own document', async () => {
      const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(deleteDoc(doc(ownerDb, docPath(OWNER_UID))));
    });

    it('denies a different authenticated user from reading the document', async () => {
      const intruderDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(getDoc(doc(intruderDb, docPath(OWNER_UID))));
    });

    it('denies a different authenticated user from writing the document', async () => {
      const intruderDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(setDoc(doc(intruderDb, docPath(OWNER_UID)), { name: 'hijacked' }));
    });

    it('denies a different authenticated user from deleting the document', async () => {
      const intruderDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(deleteDoc(doc(intruderDb, docPath(OWNER_UID))));
    });

    it('denies an unauthenticated user from reading the document', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, docPath(OWNER_UID))));
    });

    it('denies an unauthenticated user from writing the document', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(anonDb, docPath(OWNER_UID)), { name: 'hijacked' }));
    });
  });
});

describe('firestore.rules: cross-user collection queries', () => {
  const collectionPaths: Array<{ label: string; path: (uid: string) => string }> = [
    { label: 'courses', path: (uid) => `users/${uid}/courses` },
    { label: 'scheduleItems', path: (uid) => `users/${uid}/scheduleItems` },
    { label: 'contacts', path: (uid) => `users/${uid}/contacts` },
    { label: 'flashcards', path: (uid) => `users/${uid}/flashcards` },
    { label: 'quizzes', path: (uid) => `users/${uid}/quizzes` },
    { label: 'quizAttempts', path: (uid) => `users/${uid}/quizAttempts` },
    { label: 'moodEntries', path: (uid) => `users/${uid}/moodEntries` },
    { label: 'degreeProfile', path: (uid) => `users/${uid}/degreeProfile` },
    { label: 'degreeCourses', path: (uid) => `users/${uid}/degreeCourses` },
    { label: 'advisorMessages', path: (uid) => `users/${uid}/advisorMessages` },
  ];

  describe.each(collectionPaths)("listing another user's $label", ({ path: collectionPath }) => {
    beforeEach(async () => {
      await seed(`${collectionPath(OWNER_UID)}/doc-1`, { name: 'seeded' });
    });

    it('fails for a different authenticated user', async () => {
      const intruderDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(getDocs(collection(intruderDb, collectionPath(OWNER_UID))));
    });

    it('fails for an unauthenticated user', async () => {
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDocs(collection(anonDb, collectionPath(OWNER_UID))));
    });

    it('succeeds for the owner', async () => {
      const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      const snapshot = await assertSucceeds(
        getDocs(collection(ownerDb, collectionPath(OWNER_UID))),
      );
      expect(snapshot.empty).toBe(false);
    });
  });
});

describe('firestore.rules: default-deny catch-all', () => {
  it('denies reads to collections outside the users/{userId} tree, even when authenticated', async () => {
    await seed('config/app-settings', { maintenanceMode: false });
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(getDoc(doc(ownerDb, 'config/app-settings')));
  });

  it('denies writes to collections outside the users/{userId} tree, even when authenticated', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(ownerDb, 'config/app-settings'), { maintenanceMode: true }));
  });

  it('denies an authenticated user from reading another top-level users document by guessing a sibling path shape', async () => {
    await seed(`users/${OWNER_UID}/unknownSubcollection/doc-1`, { secret: true });
    const intruderDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(intruderDb, `users/${OWNER_UID}/unknownSubcollection/doc-1`)));
  });
});

describe('firestore.rules: courseGroups (Section Sync)', () => {
  const CODE = 'AB3DEFGH';
  const THIRD_UID = 'stranger-carol';

  describe('the group document', () => {
    it('lets a signed-in user create a group with themselves as createdBy', async () => {
      const creatorDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(
        setDoc(doc(creatorDb, 'courseGroups', CODE), {
          code: CODE,
          courseLabel: 'CS 301',
          createdBy: OWNER_UID,
          createdAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it('denies creating a group with a spoofed createdBy', async () => {
      const intruderDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(
        setDoc(doc(intruderDb, 'courseGroups', CODE), {
          code: CODE,
          courseLabel: 'CS 301',
          createdBy: OWNER_UID,
          createdAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it('lets any signed-in user read a group by its exact code, even before joining', async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      const strangerDb = testEnv.authenticatedContext(THIRD_UID).firestore();
      await assertSucceeds(getDoc(doc(strangerDb, 'courseGroups', CODE)));
    });

    it('denies an unauthenticated user from reading a group', async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      const anonDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, 'courseGroups', CODE)));
    });

    it('denies listing/enumerating groups even when authenticated', async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      const strangerDb = testEnv.authenticatedContext(THIRD_UID).firestore();
      await assertFails(getDocs(collection(strangerDb, 'courseGroups')));
    });

    it('lets the creator update the group', async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      const creatorDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(
        setDoc(doc(creatorDb, 'courseGroups', CODE), { courseLabel: 'CS 301 (renamed)' }),
      );
    });

    it('denies a non-creator member from updating the group', async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      await seed(`courseGroups/${CODE}/members/${OTHER_UID}`, { uid: OTHER_UID });
      const memberDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(setDoc(doc(memberDb, 'courseGroups', CODE), { courseLabel: 'hijacked' }));
    });
  });

  describe('members', () => {
    beforeEach(async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      await seed(`courseGroups/${CODE}/members/${OWNER_UID}`, {
        uid: OWNER_UID,
        displayName: 'Alice',
        showRealName: true,
        joinedAt: '2026-09-24T00:00:00.000Z',
      });
    });

    it('lets a user create their own membership doc (joining)', async () => {
      const joinerDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertSucceeds(
        setDoc(doc(joinerDb, 'courseGroups', CODE, 'members', OTHER_UID), {
          uid: OTHER_UID,
          displayName: 'Bob',
          showRealName: false,
          joinedAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it("denies creating a membership doc under someone else's uid", async () => {
      const intruderDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(
        setDoc(doc(intruderDb, 'courseGroups', CODE, 'members', THIRD_UID), {
          uid: THIRD_UID,
          displayName: 'Fake Carol',
          showRealName: false,
          joinedAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it('lets an existing member read the member roster', async () => {
      const memberDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      const snapshot = await assertSucceeds(
        getDocs(collection(memberDb, 'courseGroups', CODE, 'members')),
      );
      expect(snapshot.empty).toBe(false);
    });

    it('denies a non-member from reading the member roster', async () => {
      const strangerDb = testEnv.authenticatedContext(THIRD_UID).firestore();
      await assertFails(getDocs(collection(strangerDb, 'courseGroups', CODE, 'members')));
    });

    it('lets a member leave by deleting their own membership doc', async () => {
      const memberDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(deleteDoc(doc(memberDb, 'courseGroups', CODE, 'members', OWNER_UID)));
    });
  });

  describe('checkpoints', () => {
    const CHECKPOINT_ID = 'checkpoint-1';

    beforeEach(async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      await seed(`courseGroups/${CODE}/members/${OWNER_UID}`, { uid: OWNER_UID });
    });

    it('lets a member create a checkpoint', async () => {
      const memberDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(
        setDoc(doc(memberDb, 'courseGroups', CODE, 'checkpoints', CHECKPOINT_ID), {
          id: CHECKPOINT_ID,
          label: 'Midterm 1',
          createdBy: OWNER_UID,
          createdAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it('denies a non-member from creating a checkpoint', async () => {
      const strangerDb = testEnv.authenticatedContext(THIRD_UID).firestore();
      await assertFails(
        setDoc(doc(strangerDb, 'courseGroups', CODE, 'checkpoints', CHECKPOINT_ID), {
          id: CHECKPOINT_ID,
          label: 'Midterm 1',
          createdBy: THIRD_UID,
          createdAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it('denies a non-member from reading checkpoints', async () => {
      await seed(`courseGroups/${CODE}/checkpoints/${CHECKPOINT_ID}`, {
        id: CHECKPOINT_ID,
        label: 'Midterm 1',
        createdBy: OWNER_UID,
      });
      const strangerDb = testEnv.authenticatedContext(THIRD_UID).firestore();
      await assertFails(
        getDoc(doc(strangerDb, 'courseGroups', CODE, 'checkpoints', CHECKPOINT_ID)),
      );
    });

    it("lets the checkpoint's creator delete it", async () => {
      await seed(`courseGroups/${CODE}/checkpoints/${CHECKPOINT_ID}`, {
        id: CHECKPOINT_ID,
        label: 'Midterm 1',
        createdBy: OWNER_UID,
      });
      const creatorDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(
        deleteDoc(doc(creatorDb, 'courseGroups', CODE, 'checkpoints', CHECKPOINT_ID)),
      );
    });

    it('denies another member from deleting a checkpoint they did not create', async () => {
      await seed(`courseGroups/${CODE}/checkpoints/${CHECKPOINT_ID}`, {
        id: CHECKPOINT_ID,
        label: 'Midterm 1',
        createdBy: OWNER_UID,
      });
      await seed(`courseGroups/${CODE}/members/${OTHER_UID}`, { uid: OTHER_UID });
      const otherMemberDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(
        deleteDoc(doc(otherMemberDb, 'courseGroups', CODE, 'checkpoints', CHECKPOINT_ID)),
      );
    });
  });

  describe('confirmations', () => {
    const CHECKPOINT_ID = 'checkpoint-1';
    const CONFIRMATION_ID = `${CHECKPOINT_ID}_${OWNER_UID}`;

    beforeEach(async () => {
      await seed(`courseGroups/${CODE}`, {
        code: CODE,
        courseLabel: 'CS 301',
        createdBy: OWNER_UID,
      });
      await seed(`courseGroups/${CODE}/members/${OWNER_UID}`, { uid: OWNER_UID });
      await seed(`courseGroups/${CODE}/checkpoints/${CHECKPOINT_ID}`, {
        id: CHECKPOINT_ID,
        label: 'Midterm 1',
        createdBy: OWNER_UID,
      });
    });

    it('lets a member confirm their own date', async () => {
      const memberDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(
        setDoc(doc(memberDb, 'courseGroups', CODE, 'confirmations', CONFIRMATION_ID), {
          id: CONFIRMATION_ID,
          checkpointId: CHECKPOINT_ID,
          uid: OWNER_UID,
          displayName: 'Alice',
          date: '2026-10-14',
          confirmedAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it("denies a member from confirming a date under someone else's uid", async () => {
      await seed(`courseGroups/${CODE}/members/${OTHER_UID}`, { uid: OTHER_UID });
      const memberDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      const spoofedId = `${CHECKPOINT_ID}_${OWNER_UID}`;
      await assertFails(
        setDoc(doc(memberDb, 'courseGroups', CODE, 'confirmations', spoofedId), {
          id: spoofedId,
          checkpointId: CHECKPOINT_ID,
          uid: OWNER_UID,
          displayName: 'Fake Alice',
          date: '2026-10-14',
          confirmedAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it('denies a non-member from confirming a date', async () => {
      const strangerDb = testEnv.authenticatedContext(THIRD_UID).firestore();
      const strangerConfirmationId = `${CHECKPOINT_ID}_${THIRD_UID}`;
      await assertFails(
        setDoc(doc(strangerDb, 'courseGroups', CODE, 'confirmations', strangerConfirmationId), {
          id: strangerConfirmationId,
          checkpointId: CHECKPOINT_ID,
          uid: THIRD_UID,
          displayName: 'Stranger',
          date: '2026-10-14',
          confirmedAt: '2026-09-24T00:00:00.000Z',
        }),
      );
    });

    it('denies a non-member from reading confirmations', async () => {
      await seed(`courseGroups/${CODE}/confirmations/${CONFIRMATION_ID}`, {
        id: CONFIRMATION_ID,
        checkpointId: CHECKPOINT_ID,
        uid: OWNER_UID,
        displayName: 'Alice',
        date: '2026-10-14',
      });
      const strangerDb = testEnv.authenticatedContext(THIRD_UID).firestore();
      await assertFails(
        getDoc(doc(strangerDb, 'courseGroups', CODE, 'confirmations', CONFIRMATION_ID)),
      );
    });

    it('lets a member delete their own confirmation', async () => {
      await seed(`courseGroups/${CODE}/confirmations/${CONFIRMATION_ID}`, {
        id: CONFIRMATION_ID,
        checkpointId: CHECKPOINT_ID,
        uid: OWNER_UID,
        displayName: 'Alice',
        date: '2026-10-14',
      });
      const memberDb = testEnv.authenticatedContext(OWNER_UID).firestore();
      await assertSucceeds(
        deleteDoc(doc(memberDb, 'courseGroups', CODE, 'confirmations', CONFIRMATION_ID)),
      );
    });

    it("denies a member from deleting someone else's confirmation", async () => {
      await seed(`courseGroups/${CODE}/confirmations/${CONFIRMATION_ID}`, {
        id: CONFIRMATION_ID,
        checkpointId: CHECKPOINT_ID,
        uid: OWNER_UID,
        displayName: 'Alice',
        date: '2026-10-14',
      });
      await seed(`courseGroups/${CODE}/members/${OTHER_UID}`, { uid: OTHER_UID });
      const otherMemberDb = testEnv.authenticatedContext(OTHER_UID).firestore();
      await assertFails(
        deleteDoc(doc(otherMemberDb, 'courseGroups', CODE, 'confirmations', CONFIRMATION_ID)),
      );
    });
  });
});
