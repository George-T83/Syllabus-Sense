import type Anthropic from '@anthropic-ai/sdk';

/**
 * Forces Claude's response into our exact schema via tool-calling, rather
 * than hoping it returns clean JSON in prose. Kept as a hand-written JSON
 * Schema (mirroring `syllabusExtractionSchema` in src/types/extraction.ts)
 * since the Anthropic tool `input_schema` is plain JSON Schema, not zod -
 * the zod schema is the source of truth for validating the result server-
 * side, this just shapes what the model is asked to produce.
 */
export const SYLLABUS_EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'record_syllabus_extraction',
  description: 'Records the structured data extracted from a course syllabus.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['course', 'scheduleItems', 'unresolved'],
    properties: {
      course: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'title', 'meetingTimes', 'materials', 'skipDates'],
        properties: {
          code: { type: 'string', description: 'e.g. "CSCI 213"' },
          title: { type: 'string', description: 'e.g. "Computer Science I"' },
          instructor: { type: ['string', 'null'] },
          term: { type: ['string', 'null'], description: 'e.g. "Spring 2026"' },
          modality: { type: ['string', 'null'], enum: ['in-person', 'online', 'hybrid', null] },
          meetingTimes: {
            type: 'array',
            description:
              'Only the actual recurring class/lecture/rehearsal schedule - never office hours or tutoring slots. Omit entirely for asynchronous/online courses with no fixed meeting time.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['dayOfWeek', 'startTime', 'endTime'],
              properties: {
                dayOfWeek: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 6,
                  description: '0=Sunday..6=Saturday',
                },
                startTime: { type: 'string', description: '24-hour "HH:mm"' },
                endTime: { type: 'string', description: '24-hour "HH:mm"' },
                location: { type: ['string', 'null'] },
              },
            },
          },
          materials: {
            type: 'array',
            description:
              'General required/optional materials NOT tied to a specific date: textbook (mark required vs. optional), calculator, supplies, dress code, etc. Empty array if the syllabus states none are needed.',
            items: { type: 'string' },
          },
          skipDates: {
            type: 'array',
            description:
              'ISO dates (YYYY-MM-DD) within the term where class does NOT meet due to a holiday or break explicitly called out in the syllabus schedule (e.g. "1/19 - HOLIDAY - MLK Day", "Spring Break Week 3/9-3/13"). Only include dates you can resolve to a specific calendar date using the term/year.',
            items: { type: 'string' },
          },
          notes: {
            type: ['string', 'null'],
            description:
              'Free-text catch-all for things worth keeping but not worth modeling structurally: footnotes on meeting times (e.g. "sectional days start at noon"), "no comprehensive final exam", grading-dispute windows, etc.',
          },
        },
      },
      scheduleItems: {
        type: 'array',
        description:
          'Every dated, gradeable, or otherwise calendar-worthy item: assignments, exams, quizzes, projects, readings with deadlines, and - just as importantly - "important dates" that are not traditional assignments: mandatory performances/rehearsals/trips, registrar deadlines mentioned in the syllabus (add/drop, withdrawal-with-refund cutoffs), and dated supply-acquisition needs (e.g. "acquire concert attire before the first performance"). Do NOT invent items (like a final exam) that are not actually mentioned. Do NOT include pure boilerplate (FERPA, ADA, academic honesty policy text).',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'type', 'dueDate', 'dateConfidence'],
          properties: {
            title: { type: 'string' },
            type: {
              type: 'string',
              enum: ['assignment', 'exam', 'quiz', 'project', 'reading', 'other'],
            },
            dueDate: {
              type: ['string', 'null'],
              description:
                'ISO date YYYY-MM-DD. Resolve week-ranges to an exact date when the syllabus states a default rule (e.g. "all due dates are Fridays", "due by 11:59pm of the due date") - apply that rule to the range. If no such rule exists, use the last day of the range as a best-guess date and mark dateConfidence "approximate". If there is truly no basis to compute any date (e.g. dates are only posted on the LMS, or attendance-only grading with no dated deliverables), use null and add a note to `unresolved` explaining why.',
            },
            dateConfidence: {
              type: 'string',
              enum: ['exact', 'approximate', 'unknown'],
              description:
                '"exact" = the syllabus stated this date directly, or it was deterministically resolved via a stated default-deadline rule. "approximate" = guessed from a range with no stated rule (e.g. last day of the week). "unknown" = dueDate is null.',
            },
            gradeWeight: {
              type: ['number', 'null'],
              description:
                'Percentage of final grade (e.g. 15 for 15%), only when the syllabus states a percentage - omit/null for points-based or non-percentage grading.',
            },
            gradeCategory: {
              type: ['string', 'null'],
              description: 'e.g. "Homework", "Exam", "Final Project"',
            },
            notes: {
              type: ['string', 'null'],
              description:
                'Short context worth surfacing, e.g. "counts as an unexcused absence; missing this = automatic F", "overnight travel required", "worth 3 midterm exams total".',
            },
            highStakes: {
              type: 'boolean',
              description:
                'true if this item is unusually high-stakes: a large grade weight (roughly 15%+), or explicit "mandatory"/"required"/"automatic F if missed" language.',
            },
          },
        },
      },
      unresolved: {
        type: 'array',
        description:
          'Plain-language notes about things you noticed but could not confidently extract, for a human to see before confirming, e.g. "This syllabus does not list exam dates - your professor may post them on Blackboard/LMS separately."',
        items: { type: 'string' },
      },
    },
  },
};

export const SYLLABUS_EXTRACTION_SYSTEM_PROMPT = `You are an expert academic planner reading a college syllabus PDF to help a student build their calendar. Call the record_syllabus_extraction tool exactly once with everything you find. Follow these rules, learned from studying real university syllabi:

1. Ignore boilerplate entirely: FERPA, ADA/accommodations, academic honesty, grade-dispute-window, and military-obligation statements are never calendar-worthy. Do not extract items from them.
2. Distinguish the actual class/lecture/rehearsal meeting schedule from office hours or tutoring slots - only the former belongs in meetingTimes. Many syllabi (especially asynchronous online courses) have no meeting time at all - that's fine, leave meetingTimes empty rather than inventing one.
3. Never invent items that aren't actually mentioned. If a syllabus explicitly says "no comprehensive final exam," do not add a final exam. If exam dates simply aren't given anywhere, don't guess a date - use dueDate: null and explain in unresolved.
4. Prefer exact dates. When only a week-range is given, check the syllabus's own policy text for a stated default deadline rule (a specific weekday and/or time, e.g. "all assignments due Fridays by 11:59pm") and apply it to compute an exact date; only fall back to "approximate" (last day of the range) when no such rule exists.
5. Grading isn't always percentage-based - some syllabi use point totals, some are attendance-only, some use completion-based "grading contracts" with no per-item weight at all. Leave gradeWeight/gradeCategory null rather than fabricating a percentage.
6. Look beyond traditional assignments for other calendar-worthy dates: mandatory performances/rehearsals/trips (especially in arts/ensemble courses), registrar deadlines the syllabus itself lists (add/drop, withdrawal-with-refund cutoffs), and holidays/breaks called out in a weekly schedule table. Holidays/breaks go in skipDates (so recurring class meetings can skip them), not scheduleItems.
7. Extract a general materials list only when the syllabus actually describes required/optional supplies (textbook, calculator, specific paper, dress code, instrument, etc.) - leave it empty if none are mentioned, and don't confuse free/open-source software tools with physical supplies.
8. Flag highStakes: true on items with roughly 15%+ grade weight, or explicit "mandatory"/"required attendance"/"automatic F if missed" language - these deserve a visual warning during review, not the same treatment as a routine reading.
9. If the term/year is stated anywhere in the document (header, "Spring 2026", a schedule table's date range), use it to resolve every date to a full ISO YYYY-MM-DD - never leave a date ambiguous about the year.`;
