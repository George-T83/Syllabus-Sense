import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Page } from '@playwright/test';

export const PASSWORD = 'DemoPass123!';

function admin() {
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-syllabus-sense' });
  return { auth: getAuth(app), db: getFirestore(app) };
}

/** A due date `days` from now, late in the day, as the app stores them. */
export function dayFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

/**
 * Creates a verified student in the Auth emulator with one course and a few
 * tasks already saved, so a test starts from a realistic account instead of
 * clicking through setup.
 */
export async function seedStudent(label: string) {
  const { auth, db } = admin();
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const user = await auth.createUser({
    email,
    password: PASSWORD,
    displayName: 'Sam Student',
    emailVerified: true,
  });
  const base = `users/${user.uid}`;
  const batch = db.batch();
  batch.set(db.doc(`${base}/courses/csci`), {
    id: 'csci',
    code: 'CSCI 213',
    title: 'Data Structures',
    credits: 4,
    instructor: 'Dr. Chen',
    term: 'Fall 2026',
    color: 'bg-blue-500',
  });
  const items = [
    {
      id: 't1',
      title: 'Problem Set 5',
      type: 'assignment',
      dueDate: dayFromNow(0),
      gradeWeight: 6,
    },
    { id: 't2', title: 'Midterm exam', type: 'exam', dueDate: dayFromNow(3), gradeWeight: 25 },
    {
      id: 't3',
      title: 'Reading: Chapter 3',
      type: 'reading',
      dueDate: dayFromNow(1),
      gradeWeight: 2,
    },
  ];
  for (const item of items) {
    batch.set(db.doc(`${base}/scheduleItems/${item.id}`), {
      courseId: 'csci',
      completed: false,
      priority: 'medium',
      estimatedHours: 3,
      ...item,
    });
  }
  await batch.commit();
  return { email, uid: user.uid };
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 60_000 });
}
