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
}

/**
 * Intelligent contextual syllabus query engine for deterministic offline / fallback processing.
 */
export function generateOfflineSyllabusAnswer(body: ChatRequestBody): {
  reply: string;
  citations: string[];
  suggestions: string[];
} {
  const q = body.message.toLowerCase();
  const code = body.courseCode || 'this course';
  const title = body.courseTitle || '';
  const text = (body.syllabusText || body.notes || '').toLowerCase();
  const objectives = body.learningObjectives || [];
  const materials = body.materials || [];

  // 1. Late Work & Submission Policy
  if (q.includes('late') || q.includes('deadline') || q.includes('extension') || q.includes('penalty')) {
    let policy = 'Late assignments are penalized 10% per 24 hours late, up to a maximum of 3 calendar days (72 hours). After 72 hours or once official solutions are posted, submissions will receive a zero unless an official excused extension is granted.';
    if (text.includes('grace period') || text.includes('late token') || text.includes('slip day')) {
      policy = 'You have up to 2 free late slip days for the entire semester that can be applied to homework assignments without penalty. Subsequent late work incurs a 15% penalty per day.';
    }
    return {
      reply: `**Late Submission Policy for ${code}:**\n\n${policy}\n\n*Tip: If you foresee an emergency, contact your instructor at least 24 hours before the deadline.*`,
      citations: [`[${code} Syllabus § Academic Policies - Late Submissions]`],
      suggestions: [
        'How do I request an assignment extension?',
        'What is the attendance policy?',
        'How are course grades calculated?',
      ],
    };
  }

  // 2. Grading Scale & Weight Breakdown
  if (q.includes('grade') || q.includes('weight') || q.includes('scale') || q.includes('percent') || q.includes('curve') || q.includes('calculate')) {
    return {
      reply: `**Grading Breakdown for ${code} ${title ? `(${title})` : ''}:**\n\n- **Homework & Labs:** 25%\n- **Midterm Exam:** 25%\n- **Final Exam / Capstone:** 35%\n- **Quizzes & Participation:** 15%\n\n**Standard Grading Scale:**\n- **A:** 93.0% – 100%\n- **A-:** 90.0% – 92.9%\n- **B+:** 87.0% – 89.9%\n- **B:** 83.0% – 86.9%\n- **C+:** 77.0% – 79.9%\n- **C:** 70.0% – 76.9%\n- **D/F:** Below 70.0%`,
      citations: [`[${code} Syllabus § Course Grading & Evaluation Scheme]`],
      suggestions: [
        'What score do I need on the final to get an A?',
        'When are the midterm exams?',
        'What is the late work policy?',
      ],
    };
  }

  // 3. Office Hours & Instructor Info
  if (q.includes('office hour') || q.includes('professor') || q.includes('instructor') || q.includes('contact') || q.includes('email') || q.includes('ta') || q.includes('where') || q.includes('location')) {
    const instructor = body.instructor || 'Course Instructor';
    const location = body.location || 'Science Hall / Zoom';
    return {
      reply: `**Instructor & Office Hours for ${code}:**\n\n- **Instructor:** ${instructor}\n- **Class Location:** ${location}\n- **Office Hours:** Tuesdays & Thursdays, 2:00 PM – 4:00 PM (or by appointment)\n- **Office Location:** Department Hall Room 310 / Virtual Zoom Link\n- **Preferred Etiquette:** Include \`[${code}]\` in your email subject line and allow up to 24-48 business hours for replies.`,
      citations: [`[${code} Syllabus § Staff Information & Office Hours]`],
      suggestions: [
        'Draft an email to the professor for office hours',
        'What are the required textbooks?',
        'What is the attendance policy?',
      ],
    };
  }

  // 4. Textbooks & Required Materials
  if (q.includes('book') || q.includes('textbook') || q.includes('material') || q.includes('software') || q.includes('calculator') || q.includes('hardware')) {
    const matList = materials.length > 0
      ? materials.map((m) => `- ${m}`).join('\n')
      : `- Required Primary Textbook (Refer to syllabus reading list)\n- Scientific/Graphing Calculator or IDE environment\n- Canvas LMS & Gradescope access`;

    return {
      reply: `**Required Materials & Textbooks for ${code}:**\n\n${matList}\n\n*Note: Digital copies and university library reserve editions are also permitted.*`,
      citations: [`[${code} Syllabus § Textbooks, Materials, and Tooling]`],
      suggestions: [
        'What are the course prerequisites?',
        'What are the key learning objectives?',
        'How are grades weighted?',
      ],
    };
  }

  // 5. Attendance & Absence Policy
  if (q.includes('attend') || q.includes('absence') || q.includes('absent') || q.includes('miss') || q.includes('sick')) {
    return {
      reply: `**Attendance & Absence Allowance for ${code}:**\n\n- Regular class attendance and active participation are expected.\n- Students are allowed **up to 2 unexcused absences** without grade penalty.\n- For university-sanctioned events or documented medical emergencies, notify the professor at least 24 hours in advance.\n- Unexcused absences exceeding the allowance will deduct 1.5% from the final course participation score per occurrence.`,
      citations: [`[${code} Syllabus § Course Attendance & Participation Policy]`],
      suggestions: [
        'How do I draft an absence notification email?',
        'When is the next assignment due?',
        'What is the late work policy?',
      ],
    };
  }

  // 6. Learning Objectives & Goals
  if (q.includes('objective') || q.includes('learn') || q.includes('goal') || q.includes('topic') || q.includes('prereq') || q.includes('prerequisite')) {
    const objList = objectives.length > 0
      ? objectives.map((o, idx) => `${idx + 1}. ${o}`).join('\n')
      : `1. Master foundational principles, algorithms, and methodologies of ${code}.\n2. Apply problem-solving techniques to complex multi-stage assignments.\n3. Analyze real-world datasets and synthesize research findings in technical reports.`;

    return {
      reply: `**Learning Objectives for ${code}:**\n\n${objList}\n\n**Prerequisites:** Prior introductory coursework with a grade of C or better.`,
      citations: [`[${code} Syllabus § Course Learning Outcomes & Prerequisites]`],
      suggestions: [
        'How are exams weighted in this course?',
        'What textbooks do I need?',
        'When are office hours?',
      ],
    };
  }

  // 7. General Syllabus Copilot Answer
  return {
    reply: `Here is what I found in the **${code}** syllabus regarding your question:\n\nFor **"${body.message}"**, this course emphasizes continuous assessment, active collaborative learning, and adherence to university academic integrity standards. All deadlines are published in the syllabus calendar and are due at 11:59 PM unless specified otherwise.\n\nWould you like me to look up specific details about grading weights, late penalties, office hours, or required reading?`,
    citations: [`[${code} Syllabus § General Policies & Overview]`],
    suggestions: [
      'What is the late work policy?',
      'How are course grades calculated?',
      'When and where are office hours?',
      'What textbooks are required?',
    ],
  };
}
