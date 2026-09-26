/**
 * The chat on the syllabus autofill review screen, in two related uses:
 * "chat to finalize" - a student says what's wrong ("this is actually a
 * 4-credit course") about a draft Claude already extracted - and "chat to
 * create," where there's no syllabus at all and the draft starts empty, so
 * the assistant has to proactively ask for what's still missing rather than
 * only reacting to corrections. This module is the part that's independent
 * of Next.js request/response plumbing - the prompt, and parsing the
 * model's reply back into a validated patch - so it's testable without a
 * server.
 *
 * Deliberately scoped to the course-level fields only (not schedule items
 * or contacts): those already have their own dedicated review UI with
 * per-item approval, and letting free text edit a list is a materially
 * different, riskier problem than editing a handful of scalar fields.
 */

export type RefinableField =
  'code' | 'title' | 'instructor' | 'term' | 'modality' | 'credits' | 'notes';

/** `null` means "clear this field"; a field absent from the patch is left alone. */
export type DraftPatch = Partial<Record<RefinableField, string | null>>;

export interface RefineDraftFields {
  code: string;
  title: string;
  instructor: string;
  term: string;
  modality: string | null;
  /** Kept as a string, like the rest of the draft's text fields - parsed to
   * a number only when the course is actually saved. */
  credits: string;
  notes: string;
}

export interface RefineChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const REFINABLE_FIELDS: readonly RefinableField[] = [
  'code',
  'title',
  'instructor',
  'term',
  'modality',
  'credits',
  'notes',
];

const MODALITY_VALUES = new Set(['in-person', 'online', 'hybrid']);

/** The two fields `courseFormSchema` actually requires before a course can
 * be saved - everything else is optional. Used to decide whether the
 * assistant should be proactively asking for something, rather than only
 * reacting to a correction. */
const REQUIRED_FIELDS: readonly ('code' | 'title')[] = ['code', 'title'];

const FIELD_MAX_LENGTH: Record<RefinableField, number> = {
  code: 20,
  title: 150,
  instructor: 100,
  term: 50,
  modality: 20,
  credits: 2,
  notes: 2000,
};

export const PATCH_START_TAG = '---PATCH_START---';
export const PATCH_END_TAG = '---PATCH_END---';

export const OFFLINE_REFINE_REPLY =
  "I can't make edits right now without an AI connection. You can still change any field directly above.";

const FIELD_LABELS: Record<RefinableField, string> = {
  code: 'Code',
  title: 'Title',
  instructor: 'Instructor',
  term: 'Term',
  modality: 'Modality',
  credits: 'Credit hours',
  notes: 'Notes',
};

/** Whether the draft still lacks what `courseFormSchema` requires to save -
 * the same check the prompt uses to decide whether to proactively ask,
 * shared here so the chat UI can greet a from-scratch draft differently
 * from one that's just being corrected. */
export function needsIntake(draft: Pick<RefineDraftFields, 'code' | 'title'>): boolean {
  return REQUIRED_FIELDS.some((f) => !draft[f].trim());
}

/** A short "Updated: Term, Credits" line for the chat log, so an applied
 * patch is visible in the transcript, not just a silent field change
 * somewhere above the fold. */
export function describePatch(patch: DraftPatch): string {
  const labels = REFINABLE_FIELDS.filter((f) => f in patch).map((f) => FIELD_LABELS[f]);
  return labels.length > 0 ? `Updated: ${labels.join(', ')}` : '';
}

export function buildRefinePrompt(
  draft: RefineDraftFields,
  history: RefineChatMessage[],
  message: string,
): string {
  const historyText = history
    .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const missingRequired = REQUIRED_FIELDS.filter((f) => !draft[f].trim());
  const intakeNote =
    missingRequired.length > 0
      ? `\nThis course can't be saved yet - it's still missing ${missingRequired.map((f) => FIELD_LABELS[f]).join(' and ')}. Treat this as an ongoing intake conversation, not a one-off correction: proactively ask for whichever required field(s) are still missing instead of waiting for the student to bring them up. It's also worth asking about term and instructor if those are unknown too, since the rest of the app relies on them - but don't turn this into a rigid form, ask for at most two or three things at a time, in plain language. Never invent a code or title from something adjacent the student mentioned (e.g. a professor's name is not a course title).\n`
      : '';

  return `You are helping a student set up a course record before it is saved - either finalizing details pulled from a syllabus, or building one from scratch through this chat because they don't have a syllabus file. The only fields that exist to edit are: code, title, instructor, term, modality (in-person, online, hybrid, or none), credits (a whole number 1-12), and notes. There is no other data here yet - no tasks, no grading policy, no contacts - so never claim to have changed anything else.
${intakeNote}
Current draft:
- Code: ${draft.code || '(none)'}
- Title: ${draft.title || '(none)'}
- Instructor: ${draft.instructor || '(none)'}
- Term: ${draft.term || '(none)'}
- Modality: ${draft.modality || '(none)'}
- Credit hours: ${draft.credits || '(not set)'}
- Notes: ${draft.notes || '(none)'}
${historyText ? `\nConversation so far:\n${historyText}\n` : ''}
Student: ${message}

Reply in one to three short sentences, conversationally. If the request is ambiguous, or asks for something outside the fields listed above, say so plainly and ask a clarifying question instead of guessing. Never invent a value the student didn't give you and that wasn't already in the draft.

If - and only if - you are changing one or more fields, end your reply with a JSON object of ONLY the fields that changed, wrapped exactly like this, with nothing else inside the tags:
${PATCH_START_TAG}
{"field": "value"}
${PATCH_END_TAG}
Use JSON null to clear a field. Omit any field you are not changing.`;
}

/**
 * Splits a model reply into the chat-visible text and a validated patch.
 * Every value is checked against the same shape the review form itself
 * enforces (a real modality, a 1-12 credit count, length caps) before it's
 * trusted - a malformed or out-of-range value in the tagged JSON is simply
 * dropped from the patch rather than applied, the same "don't guess, don't
 * silently pass through" stance the rest of the AI-honesty work takes.
 */
export function parseRefineResponse(raw: string): { reply: string; patch?: DraftPatch } {
  const startIndex = raw.indexOf(PATCH_START_TAG);
  if (startIndex === -1) {
    return { reply: raw.trim() || 'Done.' };
  }

  const endIndex = raw.indexOf(PATCH_END_TAG);
  const hasEndTag = endIndex !== -1 && endIndex > startIndex;
  let patch: DraftPatch | undefined;

  if (hasEndTag) {
    const jsonStr = raw.slice(startIndex + PATCH_START_TAG.length, endIndex).trim();
    try {
      const parsed: unknown = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleaned: DraftPatch = {};
        const record = parsed as Record<string, unknown>;
        for (const field of REFINABLE_FIELDS) {
          if (!(field in record)) continue;
          const value = record[field];
          if (value === null) {
            cleaned[field] = null;
            continue;
          }
          if (typeof value !== 'string') continue;
          const trimmed = value.trim();
          if (field === 'modality') {
            if (MODALITY_VALUES.has(trimmed)) cleaned[field] = trimmed;
            continue;
          }
          if (field === 'credits') {
            if (/^([1-9]|1[0-2])$/.test(trimmed)) cleaned[field] = trimmed;
            continue;
          }
          if (trimmed.length === 0) continue;
          cleaned[field] = trimmed.slice(0, FIELD_MAX_LENGTH[field]);
        }
        if (Object.keys(cleaned).length > 0) patch = cleaned;
      }
    } catch {
      // Malformed patch JSON - keep the reply, drop the patch rather than
      // apply anything unvalidated.
    }
  }

  const tail = hasEndTag ? raw.slice(endIndex + PATCH_END_TAG.length).trim() : '';
  const head = raw.slice(0, startIndex).trim();
  const reply = [head, tail].filter(Boolean).join('\n').trim();
  return { reply: reply || 'Done.', patch };
}
