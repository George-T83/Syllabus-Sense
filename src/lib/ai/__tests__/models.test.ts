import { describe, it, expect } from 'vitest';
import { AI_MODELS, getAIModel, safeParseDelimitedContent } from '../models';

describe('AI Model Registry (models.ts)', () => {
  it('provides single source of truth model constants', () => {
    expect(AI_MODELS.SYLLABUS_EXTRACTION).toBeDefined();
    expect(AI_MODELS.SYLLABUS_CHAT).toBeDefined();
    expect(AI_MODELS.COURSE_SUMMARIZATION).toBeDefined();
  });

  it('resolves model identifiers using getAIModel', () => {
    expect(getAIModel('SYLLABUS_EXTRACTION')).toBe(AI_MODELS.SYLLABUS_EXTRACTION);
    expect(getAIModel('SYLLABUS_CHAT')).toBe(AI_MODELS.SYLLABUS_CHAT);
    expect(getAIModel('COURSE_SUMMARIZATION')).toBe(AI_MODELS.COURSE_SUMMARIZATION);
  });

  describe('safeParseDelimitedContent', () => {
    const fallback = { status: 'fallback' };

    it('extracts and parses valid JSON inside delimiters', () => {
      const rawText =
        'Preamble text\n<<<SUMMARY_START>>>{"status":"ok","count":42}<<<SUMMARY_END>>>\nPostscript';
      const result = safeParseDelimitedContent(
        rawText,
        '<<<SUMMARY_START>>>',
        '<<<SUMMARY_END>>>',
        fallback,
      );
      expect(result).toEqual({ status: 'ok', count: 42 });
    });

    it('parses valid JSON when end delimiter is omitted/truncated', () => {
      const rawText = 'Some response\n<<<JSON_START>>>{"title":"Partial JSON"}';
      const result = safeParseDelimitedContent(
        rawText,
        '<<<JSON_START>>>',
        '<<<JSON_END>>>',
        fallback,
      );
      expect(result).toEqual({ title: 'Partial JSON' });
    });

    it('returns fallback when start delimiter is missing', () => {
      const rawText = 'Plain text response without delimiters';
      const result = safeParseDelimitedContent(rawText, '<<<START>>>', '<<<END>>>', fallback);
      expect(result).toEqual(fallback);
    });

    it('returns fallback when JSON inside delimiters is malformed', () => {
      const rawText = '<<<START>>>{ invalid json content <<<END>>>';
      const result = safeParseDelimitedContent(rawText, '<<<START>>>', '<<<END>>>', fallback);
      expect(result).toEqual(fallback);
    });

    it('returns fallback gracefully for null or empty input', () => {
      expect(safeParseDelimitedContent('', '<<<START>>>', '<<<END>>>', fallback)).toEqual(fallback);
    });
  });
});
