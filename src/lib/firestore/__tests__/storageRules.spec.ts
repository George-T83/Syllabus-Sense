// @vitest-environment node
/**
 * Emulator-backed audit of storage.rules: only the owner can touch their own
 * syllabus files, and only a PDF or .docx under 10 MB can be uploaded.
 *
 * Requires the Storage emulator (see package.json's `test:rules` script).
 * Excluded from the default `npm run test` like rules.spec.ts.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const OWNER = 'owner-alice';
const OTHER = 'intruder-bob';
const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-syllabus-sense-rules-test',
    storage: {
      rules: readFileSync(path.resolve(__dirname, '../../../../storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const bytes = (n = 8) => new Uint8Array(n).fill(65);
const syllabusPath = (uid: string, name: string) => `users/${uid}/syllabi/course-1/${name}`;
const storageFor = (uid: string | null) =>
  (uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext()).storage();

describe('storage.rules: uploads', () => {
  it('lets the owner upload a PDF and a .docx', async () => {
    const s = storageFor(OWNER);
    await assertSucceeds(
      uploadBytes(ref(s, syllabusPath(OWNER, 'a.pdf')), bytes(), { contentType: PDF }),
    );
    await assertSucceeds(
      uploadBytes(ref(s, syllabusPath(OWNER, 'a.docx')), bytes(), { contentType: DOCX }),
    );
  });

  it.each([
    ['text/html', 'page.html'],
    ['image/svg+xml', 'logo.svg'],
    ['application/javascript', 'x.js'],
    ['application/octet-stream', 'x.bin'],
  ])('rejects %s uploads', async (contentType, name) => {
    await assertFails(
      uploadBytes(ref(storageFor(OWNER), syllabusPath(OWNER, name)), bytes(), { contentType }),
    );
  });

  it('rejects an upload larger than 10 MB', async () => {
    await assertFails(
      uploadBytes(
        ref(storageFor(OWNER), syllabusPath(OWNER, 'big.pdf')),
        bytes(10 * 1024 * 1024 + 1),
        {
          contentType: PDF,
        },
      ),
    );
  });

  it('rejects uploads outside the syllabi folder, even a PDF', async () => {
    await assertFails(
      uploadBytes(ref(storageFor(OWNER), `users/${OWNER}/other/a.pdf`), bytes(), {
        contentType: PDF,
      }),
    );
  });

  it("rejects writing into another user's folder and anonymous writes", async () => {
    await assertFails(
      uploadBytes(ref(storageFor(OTHER), syllabusPath(OWNER, 'a.pdf')), bytes(), {
        contentType: PDF,
      }),
    );
    await assertFails(
      uploadBytes(ref(storageFor(null), syllabusPath(OWNER, 'a.pdf')), bytes(), {
        contentType: PDF,
      }),
    );
  });
});

describe('storage.rules: read and delete', () => {
  it('lets only the owner read and delete their file', async () => {
    const file = syllabusPath(OWNER, 'keep.pdf');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), file), bytes(), { contentType: PDF });
    });

    await assertFails(getBytes(ref(storageFor(OTHER), file)));
    await assertFails(getBytes(ref(storageFor(null), file)));
    await assertFails(deleteObject(ref(storageFor(OTHER), file)));

    await assertSucceeds(getBytes(ref(storageFor(OWNER), file)));
    await assertSucceeds(deleteObject(ref(storageFor(OWNER), file)));
  });
});
