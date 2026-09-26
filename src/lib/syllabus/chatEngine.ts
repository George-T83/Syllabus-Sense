export interface ChatRequestBody {
  message: string;
  courseId?: string;
  courseCode?: string;
  courseTitle?: string;
  syllabusText?: string;
  materials?: string[];
  notes?: string;
  learningObjectives?: string[];
  instructor?: string;
  location?: string;
  fileBase64?: string;
  fileName?: string;
}

interface Topic {
  label: string;
  /** Matched against the question to pick the topic. */
  askedWith: RegExp;
  /** Matched against syllabus lines to find what it says about the topic. */
  foundWith: RegExp;
  suggestions: string[];
}

const TOPICS: Topic[] = [
  {
    label: 'late work',
    askedWith: /\blate\b|extension|deadline|penalt|slip day|grace/,
    foundWith: /\blate\b|extension|slip day|grace period|penalt/i,
    suggestions: ['How are grades weighted?', 'What is the attendance policy?'],
  },
  {
    label: 'grading',
    askedWith: /grade|grading|weight|scale|percent|curve|calculat/,
    // Not bare percentages: a late policy's "20% off" isn't a grade weight.
    foundWith: /\bgrades?\b|\bgrading\b|weight|curve|letter grade|grade scale/i,
    suggestions: ['What is the late work policy?', 'When are office hours?'],
  },
  {
    label: 'office hours and contact details',
    askedWith: /office hour|professor|instructor|contact|email|\bta\b|where|location/,
    foundWith: /office|hours|email|@|instructor|professor|\bta\b|room|location/i,
    suggestions: ['What textbooks do I need?', 'What is the attendance policy?'],
  },
  {
    label: 'required materials',
    askedWith: /book|textbook|material|software|calculator|hardware/,
    foundWith: /textbook|\bbook\b|required|material|edition|software|calculator/i,
    suggestions: ['How are grades weighted?', 'What are the learning objectives?'],
  },
  {
    label: 'attendance',
    askedWith: /attend|absen|\bmiss|sick/,
    foundWith: /attend|absen|excused|participation/i,
    suggestions: ['What is the late work policy?', 'When are office hours?'],
  },
  {
    label: 'learning objectives',
    askedWith: /objective|outcome|learn|goal|topic|prereq/,
    foundWith: /objective|outcome|students will|able to|prerequisite/i,
    suggestions: ['How are grades weighted?', 'What textbooks do I need?'],
  },
];

const DEFAULT_SUGGESTIONS = [
  'What is the late work policy?',
  'How are grades weighted?',
  'When are office hours?',
];

/** How many syllabus lines to quote - enough to answer, short enough to read. */
const MAX_QUOTED_LINES = 6;

const STOP_WORDS = new Set([
  'what',
  'when',
  'where',
  'which',
  'does',
  'this',
  'that',
  'there',
  'about',
  'with',
  'have',
  'will',
  'class',
  'course',
  'should',
  'could',
  'would',
]);

/** Syllabus lines matching `pattern`, trimmed, deduplicated, in order. */
function findLines(text: string, pattern: RegExp): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 4 || seen.has(line) || !pattern.test(line)) continue;
    seen.add(line);
    lines.push(line);
    if (lines.length >= MAX_QUOTED_LINES) break;
  }
  return lines;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The answer the syllabus chat gives when the AI isn't available: only what
 * is actually on record for the course - lines quoted from the syllabus
 * text, plus the instructor, materials and objectives saved on the course.
 * It never fills a gap with a typical policy: a made-up "2 unexcused
 * absences" or "10% per day late" cited as the student's own syllabus is
 * worse than no answer, because they'd act on it.
 */
export function generateOfflineSyllabusAnswer(body: ChatRequestBody): {
  reply: string;
  citations: string[];
  suggestions: string[];
} {
  const q = body.message.toLowerCase();
  const code = body.courseCode || 'this course';
  const text = [body.syllabusText, body.notes].filter(Boolean).join('\n');
  const topic = TOPICS.find((t) => t.askedWith.test(q));
  const suggestions = topic?.suggestions ?? DEFAULT_SUGGESTIONS;

  // What the course record itself knows, for the topics it covers.
  const onRecord: string[] = [];
  if (topic?.label === 'office hours and contact details') {
    if (body.instructor) onRecord.push(`**Instructor:** ${body.instructor}`);
    if (body.location) onRecord.push(`**Class location:** ${body.location}`);
  }
  if (topic?.label === 'required materials' && body.materials?.length) {
    onRecord.push(...body.materials.map((m) => `- ${m}`));
  }
  if (topic?.label === 'learning objectives' && body.learningObjectives?.length) {
    onRecord.push(...body.learningObjectives.map((o, i) => `${i + 1}. ${o}`));
  }

  // What the syllabus says: lines matching the topic, or failing that, lines
  // sharing a meaningful word with the question.
  let quoted: string[] = [];
  if (text) {
    if (topic) quoted = findLines(text, topic.foundWith);
    if (quoted.length === 0) {
      const words = q.match(/[a-z]{4,}/g)?.filter((w) => !STOP_WORDS.has(w)) ?? [];
      if (words.length) {
        quoted = findLines(text, new RegExp(words.map(escapeRegExp).join('|'), 'i'));
      }
    }
  }

  const about = topic ? topic.label : 'that';
  const parts: string[] = [];
  if (onRecord.length) {
    parts.push(`**What's saved for ${code}:**\n\n${onRecord.join('\n')}`);
  }
  if (quoted.length) {
    parts.push(
      `**What your ${code} syllabus says about ${about}:**\n\n${quoted.map((l) => `> ${l}`).join('\n>\n')}`,
    );
  }

  if (parts.length) {
    return {
      reply: parts.join('\n\n'),
      // Only a real quote earns a syllabus citation.
      citations: quoted.length ? [`[${code} Syllabus]`] : [],
      suggestions,
    };
  }

  const reply = text
    ? `I couldn't find anything about ${about} in the ${code} syllabus on file, so I won't guess. It may not be covered - ${body.instructor ? `${body.instructor} is` : 'your instructor is'} the one to ask.`
    : `I can't answer that without guessing: there's no syllabus text saved for ${code} yet, and the AI assistant isn't available right now. Upload the syllabus on the course page and ask again, or check it directly.`;
  return { reply, citations: [], suggestions };
}
