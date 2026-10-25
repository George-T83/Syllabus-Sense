/**
 * Runs the Playwright suite against the Firebase emulators, on any OS:
 * starts Auth, Firestore and Storage, points the app and the tests at them,
 * runs `playwright test`, and shuts the emulators down again.
 */
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';

const PROJECT = 'demo-syllabus-sense';

// The server routes that read or write Firestore on a student's behalf (the
// calendar feed, the daily AI usage count, account deletion) only start with
// admin credentials. Against the emulators nothing checks them, so a
// throwaway key made here is enough.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const env = {
  ...process.env,
  NEXT_PUBLIC_USE_FIREBASE_EMULATOR: 'true',
  NEXT_PUBLIC_APP_ENV: 'development',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${PROJECT}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:1:web:1',
  FIREBASE_ADMIN_PROJECT_ID: PROJECT,
  FIREBASE_ADMIN_CLIENT_EMAIL: `e2e@${PROJECT}.iam.gserviceaccount.com`,
  FIREBASE_ADMIN_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
  GCLOUD_PROJECT: PROJECT,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
};

const args = process.argv.slice(2).join(' ');
const child = spawn(
  'npx',
  [
    'firebase',
    'emulators:exec',
    '--only',
    'auth,firestore,storage',
    '--project',
    PROJECT,
    `"npx playwright test ${args}"`,
  ],
  { stdio: 'inherit', env, shell: true },
);
child.on('exit', (code) => process.exit(code ?? 1));
