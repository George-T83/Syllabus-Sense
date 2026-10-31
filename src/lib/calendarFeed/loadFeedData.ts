import type { Firestore } from 'firebase-admin/firestore';
import type { Course, ScheduleItem } from '@/types/schedule';
import { withoutSample } from '@/lib/sample/sampleSemester';
import { withoutArchived } from '@/lib/archive/archive';

/**
 * Reads one user's courses and schedule items with the admin SDK. Records
 * from "Try a sample semester" are made-up data, so they are left out of
 * anything leaving the app, a subscribed calendar included. So are archived
 * courses and their tasks: archiving takes a course off the calendar too.
 */
export async function loadFeedData(
  db: Firestore,
  uid: string,
): Promise<{ courses: Course[]; items: ScheduleItem[] }> {
  const [coursesSnap, itemsSnap] = await Promise.all([
    db.collection(`users/${uid}/courses`).get(),
    db.collection(`users/${uid}/scheduleItems`).get(),
  ]);
  const inUse = withoutArchived(
    withoutSample(coursesSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as Course)),
    withoutSample(itemsSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as ScheduleItem)),
  );
  return { courses: inUse.courses, items: inUse.records };
}
