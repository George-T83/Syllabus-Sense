/**
 * Runs the Playwright suite against the Firebase emulators, on any OS:
 * starts Auth, Firestore and Storage, points the app and the tests at them,
 * runs `playwright test`, and shuts the emulators down again.
 */
import { spawn } from 'node:child_process';

const PROJECT = 'demo-syllabus-sense';

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
