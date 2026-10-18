import type { AppAction } from '@/context/AppStateContext';
import { createContacts, deleteContact } from '@/lib/firestore/contacts';
import { createCourseWithScheduleItems, deleteCourse } from '@/lib/firestore/courses';
import { deleteScheduleItem } from '@/lib/firestore/scheduleItems';
import {
  buildSampleSemester,
  collectSampleRecords,
  type SampleScope,
} from '@/lib/sample/sampleSemester';

/**
 * Saves the sample semester through the same path the syllabus autofill uses:
 * each course lands together with its tasks in one atomic batch, then the
 * contacts. Returns how many courses were added.
 */
export async function loadSampleSemester(
  userId: string,
  existingTerms: string[],
  dispatch: React.Dispatch<AppAction>,
  today: Date = new Date(),
): Promise<number> {
  const sample = buildSampleSemester(today, existingTerms);
  for (const course of sample.courses) {
    await createCourseWithScheduleItems(
      userId,
      course,
      sample.scheduleItems.filter((item) => item.courseId === course.id),
      dispatch,
    );
  }
  await createContacts(userId, sample.contacts, dispatch);
  return sample.courses.length;
}

/**
 * Deletes every sample record - the `sample: true` courses with their tasks
 * and contacts - and nothing the student made. Courses go through
 * deleteCourse, so their flashcards, quizzes and sources go with them, the
 * same as removing a course by hand. Returns how many courses were removed.
 */
export async function removeSampleData(
  userId: string,
  scope: SampleScope,
  dispatch: React.Dispatch<AppAction>,
): Promise<number> {
  const sample = collectSampleRecords(scope);
  const removedCourseIds = new Set(sample.courses.map((c) => c.id));

  for (const course of sample.courses) {
    await deleteCourse(
      userId,
      course,
      sample.scheduleItems.filter((i) => i.courseId === course.id),
      dispatch,
      sample.contacts.filter((c) => c.courseId === course.id),
    );
  }

  // A flagged task or contact left on a course the student kept.
  for (const item of sample.scheduleItems) {
    if (!removedCourseIds.has(item.courseId)) await deleteScheduleItem(userId, item, dispatch);
  }
  for (const contact of sample.contacts) {
    if (!removedCourseIds.has(contact.courseId)) await deleteContact(userId, contact, dispatch);
  }
  return sample.courses.length;
}
