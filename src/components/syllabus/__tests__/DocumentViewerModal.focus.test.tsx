import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentViewerModal } from '../DocumentViewerModal';
import type { SyllabusUpload } from '@/types/syllabus';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

const syllabus = {
  id: 's1',
  courseId: 'c1',
  fileName: 'syllabus.pdf',
  storagePath: 'users/u/syllabi/c1/syllabus.pdf',
  downloadURL: '',
  sizeBytes: 100,
  uploadedAt: '2026-09-01T00:00:00.000Z',
} as unknown as SyllabusUpload;

describe('DocumentViewerModal focus handling', () => {
  it('moves focus into the viewer once it is on screen, even though it is portalled', () => {
    render(<DocumentViewerModal syllabus={syllabus} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('keeps Tab inside the viewer', () => {
    render(
      <>
        <button>Behind</button>
        <DocumentViewerModal syllabus={syllabus} onClose={vi.fn()} />
      </>,
    );
    const dialog = screen.getByRole('dialog');
    const buttons = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
    );
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<DocumentViewerModal syllabus={syllabus} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
