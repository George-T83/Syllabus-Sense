import { describe, it, expect } from 'vitest';
import { describeContents } from '../contents';

describe('describeContents', () => {
  it('lists only what there is, with the right plurals', () => {
    expect(describeContents({ tasks: 12, contacts: 1, flashcards: 0, quizzes: 3 })).toBe(
      '12 tasks, 1 contact and 3 quizzes',
    );
    expect(describeContents({ tasks: 1, contacts: 0, flashcards: 0, quizzes: 0 })).toBe('1 task');
    expect(describeContents({ tasks: 2, contacts: 0, flashcards: 40, quizzes: 0 })).toBe(
      '2 tasks and 40 flashcards',
    );
  });
  it('says so for an empty course', () => {
    expect(describeContents({ tasks: 0, contacts: 0, flashcards: 0, quizzes: 0 })).toBe(
      'nothing else',
    );
  });
});
