/** What a course holds, for telling the student what archiving keeps and what
 * deleting forever would remove. */
export interface CourseContents {
  tasks: number;
  contacts: number;
  flashcards: number;
  quizzes: number;
}

const NOUNS: Array<[keyof CourseContents, string, string]> = [
  ['tasks', 'task', 'tasks'],
  ['contacts', 'contact', 'contacts'],
  ['flashcards', 'flashcard', 'flashcards'],
  ['quizzes', 'quiz', 'quizzes'],
];

/** "12 tasks, 2 contacts and 40 flashcards", counting only what there is; an
 * empty course is "nothing else". */
export function describeContents(contents: CourseContents): string {
  const parts = NOUNS.filter(([key]) => contents[key] > 0).map(
    ([key, one, many]) => `${contents[key]} ${contents[key] === 1 ? one : many}`,
  );
  if (parts.length === 0) return 'nothing else';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
