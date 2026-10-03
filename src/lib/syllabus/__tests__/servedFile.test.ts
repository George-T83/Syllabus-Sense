import { describe, it, expect } from 'vitest';
import { buildServedFileHeaders, detectServedFileKind } from '../servedFile';

const bytes = (text: string) => new TextEncoder().encode(text);
const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

describe('detectServedFileKind', () => {
  it('recognises a PDF by its bytes', () => {
    expect(detectServedFileKind(PDF, 'syllabus.pdf')).toBe('pdf');
  });

  it('recognises a .docx only when it is a zip and the name says .docx', () => {
    expect(detectServedFileKind(ZIP, 'syllabus.docx')).toBe('docx');
    expect(detectServedFileKind(ZIP, 'archive.zip')).toBe('other');
  });

  it('does not trust the name: HTML called .pdf is not a PDF', () => {
    expect(detectServedFileKind(bytes('<html><script>alert(1)</script>'), 'syllabus.pdf')).toBe(
      'other',
    );
  });

  it('treats SVG, empty and truncated files as other', () => {
    expect(detectServedFileKind(bytes('<svg onload="alert(1)"/>'), 'logo.svg')).toBe('other');
    expect(detectServedFileKind(new Uint8Array(), 'empty.pdf')).toBe('other');
    expect(detectServedFileKind(Uint8Array.from([0x25, 0x50, 0x44]), 'short.pdf')).toBe('other');
  });
});

describe('buildServedFileHeaders', () => {
  it('lets a real PDF be shown inline', () => {
    const h = buildServedFileHeaders('pdf', 'syllabus.pdf', 'inline');
    expect(h['Content-Type']).toBe('application/pdf');
    expect(h['Content-Disposition']).toMatch(/^inline;/);
  });

  it('forces anything that is not a PDF to download, even when inline is requested', () => {
    for (const kind of ['docx', 'other'] as const) {
      const h = buildServedFileHeaders(kind, 'x.bin', 'inline');
      expect(h['Content-Disposition']).toMatch(/^attachment;/);
    }
  });

  it('never labels unknown bytes with an executable type', () => {
    const h = buildServedFileHeaders('other', 'evil.html', 'inline');
    expect(h['Content-Type']).toBe('application/octet-stream');
  });

  it('always sends nosniff and a scriptless sandbox CSP', () => {
    const h = buildServedFileHeaders('pdf', 'a.pdf', 'inline');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
  });

  it('cannot be broken out of by quotes, CRLF or non-ASCII in the file name', () => {
    const h = buildServedFileHeaders('pdf', 'a"\r\nSet-Cookie: x=1é.pdf', 'attachment');
    expect(h['Content-Disposition']).not.toMatch(/[\r\n]/);
    expect(h['Content-Disposition']).toContain("filename*=UTF-8''");
    expect(h['Content-Disposition'].match(/"/g)).toHaveLength(2);
  });
});
