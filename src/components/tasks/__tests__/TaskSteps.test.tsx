import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskSteps } from '../TaskSteps';
import type { TaskStep } from '@/types/schedule';

const steps: TaskStep[] = [
  { id: 'a', title: 'Outline', done: true },
  { id: 'b', title: 'First draft', done: false },
];

describe('TaskSteps', () => {
  it('shows how many steps are done', () => {
    render(<TaskSteps steps={steps} onChange={vi.fn()} />);
    expect(screen.getByText('1 of 2 done')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Outline' })).toHaveProperty('checked', true);
    expect(screen.getByRole('checkbox', { name: 'First draft' })).toHaveProperty('checked', false);
  });

  it('ticking a step reports the new list', () => {
    const onChange = vi.fn();
    render(<TaskSteps steps={steps} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'First draft' }));
    expect(onChange).toHaveBeenCalledWith([steps[0], { ...steps[1], done: true }]);
  });

  it('adds a step from the form and clears the box', () => {
    const onChange = vi.fn();
    render(<TaskSteps steps={steps} onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: 'New step' });
    fireEvent.change(box, { target: { value: 'Cite sources' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].at(-1)).toMatchObject({ title: 'Cite sources', done: false });
    expect((box as HTMLInputElement).value).toBe('');
  });

  it('keeps Add step off until there is text', () => {
    render(<TaskSteps steps={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add step' })).toHaveProperty('disabled', true);
  });

  it('removes a step by name', () => {
    const onChange = vi.fn();
    render(<TaskSteps steps={steps} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove step: Outline' }));
    expect(onChange).toHaveBeenCalledWith([steps[1]]);
  });

  it('is read-only when disabled', () => {
    render(<TaskSteps steps={steps} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('checkbox', { name: 'Outline' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('textbox', { name: 'New step' })).toHaveProperty('disabled', true);
  });
});
