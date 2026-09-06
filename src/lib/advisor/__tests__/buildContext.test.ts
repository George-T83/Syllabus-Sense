import { describe, it, expect } from 'vitest';
import { summarizeAdvisorContext, buildAdvisorContextBlock } from '../buildContext';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

const majorCore: DegreeRequirementCategory = {
  id: 'core',
  name: 'Major Core',
  creditsRequired: 30,
};

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

describe('summarizeAdvisorContext', () => {
  it('reports not-connected when there is no degree profile', () => {
    const summary = summarizeAdvisorContext({
      degreeProfile: null,
      degreeCourses: [],
      courses: [],
      pendingTaskCount: 0,
      overdueTaskCount: 0,
    });
    expect(summary).toEqual({
      degreeConnected: false,
      completedTerms: 0,
      creditsCompleted: 0,
      creditsInProgress: 0,
      creditsRequired: 0,
    });
  });

  it('sums real credits and distinct completed terms when a profile exists', () => {
    const summary = summarizeAdvisorContext({
      degreeProfile: { majorName: 'CS', categories: [majorCore], updatedAt: '2026-01-01' },
      degreeCourses: [
        degreeCourse({ term: 'Fall 2025', credits: 15, status: 'completed' }),
        degreeCourse({ term: 'Fall 2025', credits: 3, status: 'completed' }),
        degreeCourse({ term: 'Spring 2026', credits: 15, status: 'in-progress' }),
      ],
      courses: [],
      pendingTaskCount: 0,
      overdueTaskCount: 0,
    });
    expect(summary.degreeConnected).toBe(true);
    expect(summary.completedTerms).toBe(1);
    expect(summary.creditsCompleted).toBe(18);
    expect(summary.creditsInProgress).toBe(15);
    expect(summary.creditsRequired).toBe(30);
  });
});

describe('buildAdvisorContextBlock', () => {
  it('tells the model not to invent a degree plan when none is set up', () => {
    const block = buildAdvisorContextBlock({
      degreeProfile: null,
      degreeCourses: [],
      courses: [{ code: 'CS 101', title: 'Intro to CS', term: 'Fall 2026' }],
      pendingTaskCount: 2,
      overdueTaskCount: 1,
    });
    expect(block).toMatch(/not set up yet/i);
    expect(block).toContain('CS 101');
    expect(block).toContain('2 pending, 1 overdue');
  });

  it('includes real category and term data when a profile exists', () => {
    const block = buildAdvisorContextBlock({
      degreeProfile: {
        majorName: 'Computer Science',
        categories: [majorCore],
        updatedAt: '2026-01-01',
      },
      degreeCourses: [degreeCourse({ credits: 12, status: 'completed' })],
      courses: [],
      pendingTaskCount: 0,
      overdueTaskCount: 0,
    });
    expect(block).toContain('Computer Science');
    expect(block).toContain('Major Core: 12/30 credits (18 remaining)');
    expect(block).toMatch(/not their official transcript/i);
  });
});
