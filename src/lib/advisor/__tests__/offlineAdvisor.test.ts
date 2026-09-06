import { describe, it, expect } from 'vitest';
import { generateOfflineAdvisorReply } from '../offlineAdvisor';
import type { AdvisorContextInput } from '../buildContext';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

const majorCore: DegreeRequirementCategory = {
  id: 'core',
  name: 'Major Core',
  creditsRequired: 30,
};
const genEd: DegreeRequirementCategory = {
  id: 'genEd',
  name: 'General Education',
  creditsRequired: 36,
};

function baseInput(overrides: Partial<AdvisorContextInput> = {}): AdvisorContextInput {
  return {
    degreeProfile: null,
    degreeCourses: [],
    courses: [],
    pendingTaskCount: 0,
    overdueTaskCount: 0,
    ...overrides,
  };
}

function degreeCourse(overrides: Partial<DegreeCourse>): DegreeCourse {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    term: 'Fall 2026',
    code: 'CS 101',
    credits: 4,
    categoryId: majorCore.id,
    status: 'completed',
    ...overrides,
  };
}

describe('generateOfflineAdvisorReply', () => {
  it('flags a drop/withdraw question as high-stakes unconditionally', () => {
    const result = generateOfflineAdvisorReply('Should I drop CHEM 201?', baseInput());
    expect(result.highStakes).toBeDefined();
    expect(result.highStakes?.reason).toMatch(/high-stakes/i);
  });

  it('flags a withdraw question the same way as a drop question', () => {
    const result = generateOfflineAdvisorReply(
      'What happens if I withdraw from this class?',
      baseInput(),
    );
    expect(result.highStakes).toBeDefined();
  });

  it('tells the student to set up Degree Compass when no profile exists', () => {
    const result = generateOfflineAdvisorReply('Am I on track to graduate?', baseInput());
    expect(result.reply).toMatch(/haven't set up Degree Compass/i);
    expect(result.highStakes).toBeUndefined();
  });

  it('reports real completed-term pace for an on-track question', () => {
    const input = baseInput({
      degreeProfile: {
        majorName: 'Computer Science',
        categories: [majorCore, genEd],
        updatedAt: '2026-01-01',
      },
      degreeCourses: [
        degreeCourse({ term: 'Fall 2025', credits: 15, status: 'completed' }),
        degreeCourse({ term: 'Spring 2026', credits: 15, status: 'completed' }),
      ],
    });
    const result = generateOfflineAdvisorReply(
      'Am I still on track to graduate in four years?',
      input,
    );
    expect(result.reply).toContain('30 of 66 credits');
    expect(result.reply).toContain('2 completed terms');
    expect(result.highStakes).toBeUndefined();
  });

  it('recommends the category with the most remaining credits for a "what should I take" question', () => {
    const input = baseInput({
      degreeProfile: {
        majorName: 'Computer Science',
        categories: [majorCore, genEd],
        updatedAt: '2026-01-01',
      },
      degreeCourses: [degreeCourse({ categoryId: majorCore.id, credits: 30, status: 'completed' })],
    });
    const result = generateOfflineAdvisorReply('What should I take next semester?', input);
    expect(result.reply).toContain('General Education: 36 credits still needed');
    expect(result.reply).not.toContain('Major Core');
  });
});
