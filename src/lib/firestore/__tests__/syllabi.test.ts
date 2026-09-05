import { describe, it, expect } from 'vitest';
import { getPrimarySyllabus } from '../syllabi';
import type { SyllabusUpload } from '@/types/syllabus';

function upload(overrides: Partial<SyllabusUpload>): SyllabusUpload {
  return {
    id: 'id',
    courseId: 'course-1',
    fileName: 'syllabus.pdf',
    storagePath: 'path',
    downloadURL: 'https://example.com/file',
    sizeBytes: 1024,
    uploadedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getPrimarySyllabus', () => {
  it('returns undefined for an empty list', () => {
    expect(getPrimarySyllabus([])).toBeUndefined();
  });

  it('returns the upload explicitly marked primary', () => {
    const older = upload({ id: 'a', uploadedAt: '2026-01-01T00:00:00.000Z' });
    const newer = upload({ id: 'b', uploadedAt: '2026-02-01T00:00:00.000Z', isPrimary: true });
    const newest = upload({ id: 'c', uploadedAt: '2026-03-01T00:00:00.000Z' });
    expect(getPrimarySyllabus([older, newer, newest])?.id).toBe('b');
  });

  it('falls back to the most recently uploaded when none are marked primary', () => {
    const older = upload({ id: 'a', uploadedAt: '2026-01-01T00:00:00.000Z' });
    const newest = upload({ id: 'b', uploadedAt: '2026-03-01T00:00:00.000Z' });
    const middle = upload({ id: 'c', uploadedAt: '2026-02-01T00:00:00.000Z' });
    expect(getPrimarySyllabus([older, newest, middle])?.id).toBe('b');
  });
});
