import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WhatIfCard } from '../WhatIfCard';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

const categories: DegreeRequirementCategory[] = [
  { id: 'core', name: 'Major Core', creditsRequired: 12 },
  { id: 'genEd', name: 'General Education', creditsRequired: 9 },
];

const courses: DegreeCourse[] = [
  {
    id: 'c1',
    term: 'Fall 2025',
    code: 'CS 101',
    credits: 4,
    categoryId: 'core',
    status: 'completed',
  },
];

function addEntry(creditsValue: string, categoryName: string) {
  fireEvent.change(screen.getByLabelText('Credits'), { target: { value: creditsValue } });
  fireEvent.change(screen.getByLabelText('Counts toward'), {
    target: { value: categories.find((c) => c.name === categoryName)!.id },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add to plan' }));
}

describe('WhatIfCard', () => {
  it('starts empty, labelled as not saved, with the fastest route for today', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);

    expect(screen.getByRole('heading', { name: 'Try a plan' })).toBeDefined();
    expect(screen.getByText('Not saved')).toBeDefined();
    expect(screen.getByText('No courses in this plan yet')).toBeDefined();
    expect(screen.queryByText('If you take these')).toBeNull();
    // 17 credits left (8 core + 9 gen ed) at 15 per term.
    expect(screen.getByText('2 terms to cover the remaining 17 credits.')).toBeDefined();
    expect((screen.getByLabelText('Max credits per term') as HTMLInputElement).value).toBe('15');
  });

  it('adds a hypothetical course and shows before and after progress', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);

    addEntry('3', 'Major Core');

    const list = screen.getByRole('list', { name: 'Courses in this plan' });
    expect(within(list).getByText('3 cr')).toBeDefined();
    expect(screen.queryByText('No courses in this plan yet')).toBeNull();
    const landing = screen.getByRole('region', { name: 'Where you would land' });
    expect(landing.textContent).toContain('4 / 21 cr');
    expect(landing.textContent).toContain('7 / 21 cr');
    expect(landing.textContent).toContain('+3 toward requirements');
    expect(landing.textContent).toContain('4 / 12 cr');
    expect(landing.textContent).toContain('7 / 12 cr');
    expect(
      screen.getByText('1 term to cover the remaining 14 credits, after the courses above.'),
    ).toBeDefined();
  });

  it('reports credits past a requirement as extra rather than progress', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);

    addEntry('10', 'Major Core');

    const landing = screen.getByRole('region', { name: 'Where you would land' });
    expect(landing.textContent).toContain('12 / 21 cr');
    expect(landing.textContent).toContain('+8 toward requirements');
    expect(landing.textContent).toContain('+2 extra past a requirement');
    expect(landing.textContent).toContain('(+2 extra)');
  });

  it('removes an entry and clears them all', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);

    addEntry('3', 'Major Core');
    addEntry('4', 'General Education');
    expect(
      within(screen.getByRole('list', { name: 'Courses in this plan' })).getAllByRole('listitem'),
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Remove 3 cr Major Core from this plan' }));
    expect(
      within(screen.getByRole('list', { name: 'Courses in this plan' })).getAllByRole('listitem'),
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('No courses in this plan yet')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Where you would land' })).toBeNull();
  });

  it('rejects credits that are empty, zero or negative', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);

    for (const bad of ['', '0', '-2']) {
      addEntry(bad, 'Major Core');
      expect(screen.getByRole('alert').textContent).toBe('Enter a number of credits above 0.');
    }
    expect(screen.getByText('No courses in this plan yet')).toBeDefined();
  });

  it('recomputes the fastest route when the max credits per term changes', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);

    fireEvent.change(screen.getByLabelText('Max credits per term'), { target: { value: '6' } });

    expect(screen.getByText('3 terms to cover the remaining 17 credits.')).toBeDefined();
    const terms = within(screen.getByRole('list', { name: 'Remaining terms' })).getAllByRole(
      'listitem',
    );
    expect(terms).toHaveLength(3);
    expect(terms[0].textContent).toContain('Term 1');
    expect(terms[0].textContent).toContain('General Education 6');
  });

  it('explains an unusable max credits per term instead of a plan', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);
    const input = screen.getByLabelText('Max credits per term');

    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText('Enter a max credits per term above 0.')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Remaining terms' })).toBeNull();

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Enter a max credits per term above 0.')).toBeDefined();
  });

  it('says there is nothing to schedule once the plan covers every requirement', () => {
    const done: DegreeCourse[] = [
      { ...courses[0], id: 'a', credits: 12 },
      { ...courses[0], id: 'b', credits: 9, categoryId: 'genEd' },
    ];
    render(<WhatIfCard categories={categories} courses={done} />);

    expect(
      screen.getByText('Nothing left to schedule: every requirement is covered by your plan.'),
    ).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Remaining terms' })).toBeNull();
  });

  it('states what the planner does not do', () => {
    render(<WhatIfCard categories={categories} courses={courses} />);

    expect(screen.getByText(/not specific courses or prerequisites/)).toBeDefined();
    expect(screen.getByText(/does not pick courses or check prerequisites/)).toBeDefined();
  });
});
