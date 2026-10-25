import type { Firestore } from 'firebase-admin/firestore';
import type { Course, ScheduleItem } from '@/types/schedule';

/** Reads one user's courses and schedule items with the admin SDK. */
export async function loadFeedData(
  db: Firestore,
  uid: string,
): Promise<{ courses: Course[]; items: ScheduleItem[] }> {
  const [coursesSnap, itemsSnap] = await Promise.all([
    db.collection(`users/${uid}/courses`).get(),
    db.collection(`users/${uid}/scheduleItems`).get(),
  ]);
  return {
    courses: coursesSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as Course),
    items: itemsSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as ScheduleItem),
  };
}
