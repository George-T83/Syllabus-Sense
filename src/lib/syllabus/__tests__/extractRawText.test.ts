import { describe, it, expect } from 'vitest';
import { detectSyllabusFileKind } from '../extractRawText';

describe('detectSyllabusFileKind', () => {
  it('detects a PDF from its magic-byte base64 prefix', () => {
    // base64 of "%PDF-1.4..." always starts with this prefix regardless of
    // what follows - fixed 3-byte base64 grouping on a known byte run.
    expect(detectSyllabusFileKind('JVBERi0xLjQKJeLjz9MK')).toBe('pdf');
  });

  it('detects a docx from its zip-header base64 prefix', () => {
    expect(detectSyllabusFileKind('UEsDBBQAAAAIAA==')).toBe('docx');
  });

  it('returns null for neither', () => {
    expect(detectSyllabusFileKind('plain text, not base64 of a real file')).toBeNull();
    expect(detectSyllabusFileKind('')).toBeNull();
  });
});
