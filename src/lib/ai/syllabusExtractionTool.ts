import type Anthropic from '@anthropic-ai/sdk';
import { COURSE_COLOR_PRESETS } from '@/lib/courseColors';
import { COURSE_ICON_PRESETS } from '@/lib/courseIcons';

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
          code: {
            type: 'string',
            description:
              'e.g. "CSCI 213" - always insert a space between the subject prefix and the course number, even if the syllabus itself writes it without one (e.g. "CSCI213" in the source becomes "CSCI 213" here).',
          },
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
          suggestedColor: {
            type: ['string', 'null'],
            enum: [...COURSE_COLOR_PRESETS.map((p) => p.value), null],
            description:
              'The best-fitting color for this course from the fixed preset list, using common US academic subject-color conventions where a clear one exists (e.g. math/stats: red or blue; natural sciences - biology, chemistry, physics, environmental science: green; computer science/engineering: indigo or violet; English/literature/writing: purple; history/social studies/political science: orange or amber; economics/business/accounting: amber; foreign languages: teal or cyan; art/music/theater/performance: pink or rose; health/kinesiology/PE/nursing: lime; psychology: teal). For a subject with no strong convention, use judgment - pick whichever available color feels most fitting rather than defaulting to the same one every time.',
          },
          suggestedFileName: {
            type: ['string', 'null'],
            description:
              'A clean, human-readable name for the syllabus file itself, with NO extension, built from the actual course code and term found in the document - e.g. "ECON 201 - Fall 2026 Syllabus" - not the original uploaded file\'s name.',
          },
          suggestedIcon: {
            type: ['string', 'null'],
            enum: [...COURSE_ICON_PRESETS.map((p) => p.value), null],
            description:
              'The best-fitting subject icon for this course from the fixed preset list: "book" (reading-heavy/general/humanities with no better fit), "calculator" (math/statistics), "flask" (lab science - biology/chemistry/physics/environmental), "globe" (history/geography/social studies), "chat" (foreign language), "code" (computer science/software engineering), "chart" (business/economics/accounting), "palette" (art/design), "music" (music), "film" (media/theater/film studies), "heart" (health/psychology/nursing), "scale" (law/political science), "bolt" (kinesiology/PE/fitness), "puzzle" (anything else). Pick the closest match rather than defaulting to "book" for every course.',
          },
          contacts: {
            type: 'array',
            description:
              'Every professor and TA named in the syllabus, with whatever contact/office details are actually stated. Omit entirely rather than inventing a TA that is not named.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['role', 'fullName'],
              properties: {
                role: { type: 'string', enum: ['professor', 'ta'] },
                fullName: { type: 'string' },
                title: {
                  type: ['string', 'null'],
                  description: 'e.g. "Associate Professor of Computer Science"',
                },
                howToAddress: {
                  type: ['string', 'null'],
                  description:
                    'How the syllabus itself says to address them, e.g. "Dr. Chen" or "Professor Lee" - only if stated or clearly implied by their stated title, not guessed from the name alone.',
                },
                email: { type: ['string', 'null'] },
                officeHours: {
                  type: ['string', 'null'],
                  description:
                    'Verbatim or lightly cleaned-up, e.g. "Tue/Thu 2:00-3:30pm" or "By appointment" - do not invent a schedule that is not stated.',
                },
                officeLocation: { type: ['string', 'null'] },
              },
            },
          },
          learningObjectives: {
            type: 'array',
            description:
              'The course\'s stated learning objectives/outcomes, one per array entry, as detailed as the syllabus itself states them. Only extract when the syllabus has an actual "Learning Objectives/Outcomes" section or equivalent - never fabricate objectives from a course description alone.',
            items: { type: 'string' },
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

export const SYLLABUS_EXTRACTION_SYSTEM_PROMPT = `You are an expert academic planner reading a college syllabus (provided as a PDF or as plain text extracted from a Word document) to help a student build their calendar. Call the record_syllabus_extraction tool exactly once with everything you find. Follow these rules, learned from studying real university syllabi:

1. Ignore boilerplate entirely: FERPA, ADA/accommodations, academic honesty, grade-dispute-window, and military-obligation statements are never calendar-worthy. Do not extract items from them.
2. Distinguish the actual class/lecture/rehearsal meeting schedule from office hours or tutoring slots - only the former belongs in meetingTimes. Many syllabi (especially asynchronous online courses) have no meeting time at all - that's fine, leave meetingTimes empty rather than inventing one.
3. Never invent items that aren't actually mentioned. If a syllabus explicitly says "no comprehensive final exam," do not add a final exam. If exam dates simply aren't given anywhere, don't guess a date - use dueDate: null and explain in unresolved.
4. Prefer exact dates. When only a week-range is given, check the syllabus's own policy text for a stated default deadline rule (a specific weekday and/or time, e.g. "all assignments due Fridays by 11:59pm") and apply it to compute an exact date; only fall back to "approximate" (last day of the range) when no such rule exists.
5. Grading isn't always percentage-based - some syllabi use point totals, some are attendance-only, some use completion-based "grading contracts" with no per-item weight at all. Leave gradeWeight/gradeCategory null rather than fabricating a percentage.
6. Look beyond traditional assignments for other calendar-worthy dates: mandatory performances/rehearsals/trips (especially in arts/ensemble courses), registrar deadlines the syllabus itself lists (add/drop, withdrawal-with-refund cutoffs), and holidays/breaks called out in a weekly schedule table. Holidays/breaks go in skipDates (so recurring class meetings can skip them), not scheduleItems.
7. Extract a general materials list only when the syllabus actually describes required/optional supplies (textbook, calculator, specific paper, dress code, instrument, etc.) - leave it empty if none are mentioned, and don't confuse free/open-source software tools with physical supplies.
8. Flag highStakes: true on items with roughly 15%+ grade weight, or explicit "mandatory"/"required attendance"/"automatic F if missed" language - these deserve a visual warning during review, not the same treatment as a routine reading.
9. If the term/year is stated anywhere in the document (header, "Spring 2026", a schedule table's date range), use it to resolve every date to a full ISO YYYY-MM-DD - never leave a date ambiguous about the year.
10. Always propose suggestedColor: pick whichever preset best matches the course's subject by common academic convention (see the tool schema for examples). This is just a starting point the student can change, so a reasonable guess beats leaving it null.
11. Always propose suggestedFileName: a short, human-readable name built from the real course code and term (e.g. "PSYC 220 - Spring 2026 Syllabus"), not a restatement of the uploaded file's own name.
12. Always propose suggestedIcon: pick the preset that best matches the course's actual subject (see the tool schema's enum for what each icon represents) - another starting point the student can change, not a final answer.
13. Extract every professor and TA named in the syllabus into contacts, with whatever details are actually stated (title, how to address them, email, office hours, office location) - leave a field null rather than guessing it, and never invent a TA who is not named anywhere.
14. Extract learningObjectives only when the syllabus has an actual "Learning Objectives," "Course Outcomes," or equivalent section - copy them as detailed, individual bullet entries. Do not synthesize objectives from the course description or title if no such section exists; leave the array empty instead.
15. Always format course.code with a space between the subject prefix and the course number (e.g. "CSCI 213", "ECON 201"), even when the syllabus itself writes it without one (e.g. "CSCI213").`;
