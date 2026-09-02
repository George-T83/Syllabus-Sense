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
