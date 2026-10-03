import { describe, it, expect } from 'vitest';
import { buildDataExport, EXPORT_SCHEMA_VERSION, type DataExportInput } from '../dataExport';

const empty: DataExportInput = {
  account: { email: 'a@b.c', displayName: 'A', memberSince: null },
  courses: [],
  scheduleItems: [],
  contacts: [],
  sources: [],
  flashcards: [],
  quizzes: [],
  quizAttempts: [],
  moodEntries: [],
  gradeScenarios: [],
  syllabi: [],
  degreeProfile: null,
  degreeCourses: [],
  advisorMessages: [],
  focusSessions: [],
  preferences: {},
};

describe('buildDataExport', () => {
  it('stamps a schema version and the export time', () => {
    const out = buildDataExport(empty, new Date('2026-10-03T12:00:00Z'));
    expect(out.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(out.exportedAt).toBe('2026-10-03T12:00:00.000Z');
  });

  it('includes every collection the app stores, not just the original seven', () => {
    const out = buildDataExport(empty);
    for (const key of [
      'courses',
      'scheduleItems',
      'contacts',
      'moodEntries',
      'gradeScenarios',
      'syllabi',
      'sources',
      'flashcards',
      'quizzes',
      'quizAttempts',
      'degreeProfile',
      'degreeCourses',
      'advisorMessages',
      'focusSessions',
      'preferences',
    ]) {
      expect(out, key).toHaveProperty(key);
    }
  });

  it('counts what it holds so a reader can see nothing was dropped', () => {
    const out = buildDataExport({
      ...empty,
      flashcards: [{ id: 'f1' }, { id: 'f2' }] as DataExportInput['flashcards'],
      focusSessions: [{ startedAt: 'x', duration: 1500 }],
      degreeProfile: { majorName: 'CS', categories: [], updatedAt: 'x' },
    });
    expect(out.counts.flashcards).toBe(2);
    expect(out.counts.focusSessions).toBe(1);
    expect(out.counts.degreeProfile).toBe(1);
    expect(out.counts.courses).toBe(0);
  });

  it('says plainly that the uploaded files are not in the export', () => {
    expect(buildDataExport(empty).notIncluded.join(' ')).toMatch(/uploaded syllabus files/i);
  });
});
