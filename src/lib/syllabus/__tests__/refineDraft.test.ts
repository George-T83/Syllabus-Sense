import { describe, it, expect } from 'vitest';
import {
  buildRefinePrompt,
  describePatch,
  parseRefineResponse,
  PATCH_START_TAG,
  PATCH_END_TAG,
  type RefineDraftFields,
} from '../refineDraft';

const draft: RefineDraftFields = {
  code: 'CSCI 213',
  title: 'Computer Science I',
  instructor: 'Dr. Smith',
  term: 'Fall 2026',
  modality: 'in-person',
  credits: '3',
  notes: '',
};

describe('parseRefineResponse', () => {
  it('returns the whole reply verbatim when there is no patch tag', () => {
    const result = parseRefineResponse('Sure, what would you like to change?');
    expect(result).toEqual({ reply: 'Sure, what would you like to change?' });
  });

  it('falls back to "Done." for an empty reply with no patch tag', () => {
    expect(parseRefineResponse('   ')).toEqual({ reply: 'Done.' });
  });

  it('extracts a valid patch and strips the tagged block from the reply', () => {
    const raw = `Got it, bumping the credits.\n${PATCH_START_TAG}\n{"credits": "4"}\n${PATCH_END_TAG}`;
    const result = parseRefineResponse(raw);
    expect(result.reply).toBe('Got it, bumping the credits.');
    expect(result.patch).toEqual({ credits: '4' });
  });

  it('joins text before and after the tags into the reply', () => {
    const raw = `Before.\n${PATCH_START_TAG}\n{"term": "Spring 2027"}\n${PATCH_END_TAG}\nAfter.`;
    const result = parseRefineResponse(raw);
    expect(result.reply).toBe('Before.\nAfter.');
    expect(result.patch).toEqual({ term: 'Spring 2027' });
  });

  it('drops an out-of-range credits value rather than applying it', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"credits": "15"}\n${PATCH_END_TAG}`;
    const result = parseRefineResponse(raw);
    expect(result.patch).toBeUndefined();
  });

  it('accepts a valid boundary credits value', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"credits": "12"}\n${PATCH_END_TAG}`;
    expect(parseRefineResponse(raw).patch).toEqual({ credits: '12' });
  });

  it('drops an unrecognized modality value', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"modality": "remote"}\n${PATCH_END_TAG}`;
    expect(parseRefineResponse(raw).patch).toBeUndefined();
  });

  it('accepts a valid modality value', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"modality": "hybrid"}\n${PATCH_END_TAG}`;
    expect(parseRefineResponse(raw).patch).toEqual({ modality: 'hybrid' });
  });

  it('treats a JSON null as an explicit clear', () => {
    const raw = `Cleared it.\n${PATCH_START_TAG}\n{"term": null}\n${PATCH_END_TAG}`;
    expect(parseRefineResponse(raw).patch).toEqual({ term: null });
  });

  it('ignores fields outside the known set', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"title": "New Title", "notARealField": "x"}\n${PATCH_END_TAG}`;
    expect(parseRefineResponse(raw).patch).toEqual({ title: 'New Title' });
  });

  it('truncates a value longer than the field max length', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"code": "${'X'.repeat(30)}"}\n${PATCH_END_TAG}`;
    const result = parseRefineResponse(raw);
    expect(result.patch?.code).toHaveLength(20);
  });

  it('drops an empty-string field value rather than applying a blank', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"title": ""}\n${PATCH_END_TAG}`;
    expect(parseRefineResponse(raw).patch).toBeUndefined();
  });

  it('keeps the reply but drops the patch on malformed JSON', () => {
    const raw = `Something changed.\n${PATCH_START_TAG}\nnot json\n${PATCH_END_TAG}`;
    const result = parseRefineResponse(raw);
    expect(result.reply).toBe('Something changed.');
    expect(result.patch).toBeUndefined();
  });

  it('returns no patch when the end tag is missing', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n{"title": "New Title"}`;
    const result = parseRefineResponse(raw);
    expect(result.patch).toBeUndefined();
    expect(result.reply).toContain('Sure.');
  });

  it('ignores a non-object patch payload (array)', () => {
    const raw = `Sure.\n${PATCH_START_TAG}\n["title", "New Title"]\n${PATCH_END_TAG}`;
    expect(parseRefineResponse(raw).patch).toBeUndefined();
  });
});

describe('describePatch', () => {
  it('returns an empty string for an empty patch', () => {
    expect(describePatch({})).toBe('');
  });

  it('lists changed field labels in the fixed field order, not insertion order', () => {
    expect(describePatch({ notes: 'x', code: 'y' })).toBe('Updated: Code, Notes');
  });

  it('uses the human label for credits', () => {
    expect(describePatch({ credits: '4' })).toBe('Updated: Credit hours');
  });
});

describe('buildRefinePrompt', () => {
  it('includes the current draft values', () => {
    const prompt = buildRefinePrompt(draft, [], 'change the credits to 4');
    expect(prompt).toContain('CSCI 213');
    expect(prompt).toContain('Dr. Smith');
    expect(prompt).toContain('change the credits to 4');
  });

  it('renders unset fields as placeholders rather than blank', () => {
    const prompt = buildRefinePrompt({ ...draft, notes: '', modality: null }, [], 'hi');
    expect(prompt).toContain('Notes: (none)');
    expect(prompt).toContain('Modality: (none)');
  });

  it('includes prior conversation turns when history is given', () => {
    const prompt = buildRefinePrompt(
      draft,
      [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
      ],
      'follow up',
    );
    expect(prompt).toContain('Student: first question');
    expect(prompt).toContain('Assistant: first answer');
  });

  it('omits the conversation section entirely when there is no history', () => {
    const prompt = buildRefinePrompt(draft, [], 'hi');
    expect(prompt).not.toContain('Conversation so far');
  });
});
