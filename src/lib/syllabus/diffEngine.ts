export type DiffType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface DiffLine {
  type: DiffType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export type PolicySeverity = 'minor' | 'moderate' | 'major';

export interface PolicyChange {
  id: string;
  section: string;
  title: string;
  summary: string;
  type: DiffType;
  severity: PolicySeverity;
  oldSnippet?: string;
  newSnippet?: string;
  category: 'grading' | 'attendance' | 'late_work' | 'schedule' | 'contacts' | 'general';
}

export interface PolicyDiffReport {
  totalAdditions: number;
  totalDeletions: number;
  totalModifications: number;
  overallSeverity: PolicySeverity;
  lines: DiffLine[];
  changes: PolicyChange[];
  sectionsModified: string[];
}

/**
 * Computes line-by-line diff between two text strings using dynamic programming Longest Common Subsequence (LCS).
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split(/\r?\n/) : [];
  const newLines = newText ? newText.split(/\r?\n/) : [];

  const n = oldLines.length;
  const m = newLines.length;

  // DP table for LCS lengths
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff lines
  const result: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return result;
}

/**
 * Heuristic policy revision analysis that inspects diff lines and semantic syllabus sections.
 */
export function analyzeSyllabusRevision(
  originalText: string,
  revisedText: string
): PolicyDiffReport {
  const lines = computeLineDiff(originalText, revisedText);

  let totalAdditions = 0;
  let totalDeletions = 0;
  lines.forEach((l) => {
    if (l.type === 'added') totalAdditions++;
    if (l.type === 'removed') totalDeletions++;
  });

  const changes: PolicyChange[] = [];
  const sectionsSet = new Set<string>();

  // Check for grading weight modifications
  const gradingPattern = /(grading|weights?|breakdown|exams?|homework|quizzes|projects?|midterm|final)\s*:?\s*(\d{1,3}%)/i;
  const oldGradingMatches = originalText.match(new RegExp(gradingPattern, 'gi')) || [];
  const newGradingMatches = revisedText.match(new RegExp(gradingPattern, 'gi')) || [];

  if (oldGradingMatches.join(';') !== newGradingMatches.join(';')) {
    sectionsSet.add('Grading Scheme & Weights');
    changes.push({
      id: 'change-grading-1',
      section: 'Grading Scheme & Weights',
      title: 'Grading Distribution Alteration',
      summary: 'Grading component percentages or assignment weights have been modified.',
      type: 'modified',
      severity: 'major',
      category: 'grading',
      oldSnippet: oldGradingMatches.join(' | ') || 'Original grading breakdown',
      newSnippet: newGradingMatches.join(' | ') || 'Revised grading breakdown',
    });
  }

  // Check for late policy modifications
  const latePattern = /(late\s*policy|late\s*submissions?|penalty|grace\s*period|per\s*day|deduct)/i;
  const hasOldLate = latePattern.test(originalText);
  const hasNewLate = latePattern.test(revisedText);
  if (hasOldLate || hasNewLate) {
    const oldLateSnippet = originalText.split('\n').filter((l) => latePattern.test(l)).join('; ');
    const newLateSnippet = revisedText.split('\n').filter((l) => latePattern.test(l)).join('; ');
    if (oldLateSnippet !== newLateSnippet && (oldLateSnippet || newLateSnippet)) {
      sectionsSet.add('Late Submission Policy');
      changes.push({
        id: 'change-late-1',
        section: 'Late Submission Policy',
        title: 'Late Work / Grace Period Adjustment',
        summary: 'Submission deadline penalties, cutoff windows, or slip-day allowances updated.',
        type: 'modified',
        severity: 'moderate',
        category: 'late_work',
        oldSnippet: oldLateSnippet.slice(0, 140) || 'None stated',
        newSnippet: newLateSnippet.slice(0, 140) || 'None stated',
      });
    }
  }

  // Check for attendance / absence policy
  const attendancePattern = /(attendance|absences?|excused|unexcused|allowed\s*absences?)/i;
  const oldAtt = originalText.split('\n').filter((l) => attendancePattern.test(l)).join('; ');
  const newAtt = revisedText.split('\n').filter((l) => attendancePattern.test(l)).join('; ');
  if (oldAtt !== newAtt && (oldAtt || newAtt)) {
    sectionsSet.add('Attendance & Absence Policy');
    changes.push({
      id: 'change-attendance-1',
      section: 'Attendance & Absence Policy',
      title: 'Attendance Rule Revision',
      summary: 'Class presence expectations or allowed unexcused absence thresholds updated.',
      type: 'modified',
      severity: 'moderate',
      category: 'attendance',
      oldSnippet: oldAtt.slice(0, 140) || 'Standard attendance',
      newSnippet: newAtt.slice(0, 140) || 'Revised attendance',
    });
  }

  // Check for schedule / exam dates
  const schedulePattern = /(exam|midterm|final\s*exam|due\s*date|project\s*due|nov\s*\d+|dec\s*\d+|oct\s*\d+)/i;
  const oldSchedule = originalText.split('\n').filter((l) => schedulePattern.test(l)).join('; ');
  const newSchedule = revisedText.split('\n').filter((l) => schedulePattern.test(l)).join('; ');
  if (oldSchedule !== newSchedule && (oldSchedule || newSchedule)) {
    sectionsSet.add('Exam Schedule & Deadlines');
    changes.push({
      id: 'change-schedule-1',
      section: 'Exam Schedule & Deadlines',
      title: 'Key Milestones & Exam Dates Rescheduled',
      summary: 'Important course exam dates, project deliverables, or deadlines have shifted.',
      type: 'modified',
      severity: 'major',
      category: 'schedule',
      oldSnippet: oldSchedule.slice(0, 140),
      newSnippet: newSchedule.slice(0, 140),
    });
  }

  // Check for contact / office hours
  const contactPattern = /(office\s*hours|zoom|email|room|hall|prof|ta|instructor)/i;
  const oldContact = originalText.split('\n').filter((l) => contactPattern.test(l)).join('; ');
  const newContact = revisedText.split('\n').filter((l) => contactPattern.test(l)).join('; ');
  if (oldContact !== newContact && (oldContact || newContact)) {
    sectionsSet.add('Office Hours & Contact Info');
    changes.push({
      id: 'change-contact-1',
      section: 'Office Hours & Contact Info',
      title: 'Office Location or Hours Changed',
      summary: 'Instructor or TA availability times, office room numbers, or links changed.',
      type: 'modified',
      severity: 'minor',
      category: 'contacts',
      oldSnippet: oldContact.slice(0, 140),
      newSnippet: newContact.slice(0, 140),
    });
  }

  // Overall severity calculation
  let overallSeverity: PolicySeverity = 'minor';
  if (changes.some((c) => c.severity === 'major')) {
    overallSeverity = 'major';
  } else if (changes.some((c) => c.severity === 'moderate') || totalAdditions + totalDeletions > 10) {
    overallSeverity = 'moderate';
  }

  return {
    totalAdditions,
    totalDeletions,
    totalModifications: changes.length,
    overallSeverity,
    lines,
    changes,
    sectionsModified: Array.from(sectionsSet),
  };
}
