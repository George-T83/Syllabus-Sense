import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CheckSyllabusButton } from '../CheckSyllabus';
import { AiNote } from '@/components/ui/AiNote';
import type { SyllabusUpload } from '@/types/syllabus';

vi.mock('@/components/syllabus/DocumentViewerModal', () => ({
  DocumentViewerModal: ({
    syllabus,
    onClose,
  }: {
    syllabus: SyllabusUpload;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label={syllabus.fileName}>
      <button onClick={onClose}>Close viewer</button>
    </div>
  ),
}));

const syllabus = { id: 's1', fileName: 'CS 301 Syllabus.pdf' } as SyllabusUpload;

describe('CheckSyllabusButton', () => {
  it('renders nothing when the course has no syllabus on file', () => {
    const { container } = render(<CheckSyllabusButton syllabus={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('opens the syllabus viewer only when used, and closes it again', () => {
    render(<CheckSyllabusButton syllabus={syllabus} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Check the syllabus' }));
    expect(screen.getByRole('dialog', { name: 'CS 301 Syllabus.pdf' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('AiNote', () => {
  it('renders its text with a decorative icon', () => {
    const { container } = render(<AiNote>It can be wrong.</AiNote>);
    expect(screen.getByText('It can be wrong.')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
