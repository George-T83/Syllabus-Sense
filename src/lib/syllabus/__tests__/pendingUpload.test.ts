import { describe, it, expect } from 'vitest';
import {
  INLINE_UPLOAD_LIMIT_BYTES,
  isPendingUploadPath,
  pendingUploadPrefix,
} from '../pendingUpload';

describe('pending syllabus uploads', () => {
  it('keeps the inline limit safely under the host request cap once base64-encoded', () => {
    const base64Bytes = Math.ceil((INLINE_UPLOAD_LIMIT_BYTES * 4) / 3);
    expect(base64Bytes).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("accepts only a file in the signed-in student's own pending folder", () => {
    expect(isPendingUploadPath('u1', `${pendingUploadPrefix('u1')}abc-syllabus.pdf`)).toBe(true);
    expect(isPendingUploadPath('u1', 'users/u2/syllabi/_pending/abc.pdf')).toBe(false);
    expect(isPendingUploadPath('u1', 'users/u1/syllabi/course/abc.pdf')).toBe(false);
    expect(isPendingUploadPath('u1', 'users/u1/syllabi/_pending/../course/abc.pdf')).toBe(false);
    expect(isPendingUploadPath('u1', pendingUploadPrefix('u1'))).toBe(false);
    expect(isPendingUploadPath('u1', undefined)).toBe(false);
    expect(isPendingUploadPath('u1', 42)).toBe(false);
  });

  it("does not let a user id that prefixes another match the other's folder", () => {
    expect(isPendingUploadPath('u1', 'users/u10/syllabi/_pending/abc.pdf')).toBe(false);
  });
});
