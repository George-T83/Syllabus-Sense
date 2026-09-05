import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactShareModal } from '../ContactShareModal';
import { ToastProvider } from '@/components/ui/Toast';
import type { Contact } from '@/types/schedule';

const MOCK_CONTACT: Contact = {
  id: 'contact-test-1',
  courseId: 'course-1',
  role: 'ta',
  fullName: 'Ada Lovelace',
  title: 'Graduate Teaching Assistant',
  email: 'ada@computing.edu',
  officeLocation: 'Babbage Hall 304',
  officeHours: 'Tuesdays 2-4 PM',
};

describe('ContactShareModal (Item 45)', () => {
  it('renders modal dialog when open with contact information and QR code SVG', () => {
    render(
      <ToastProvider>
        <ContactShareModal
          contact={MOCK_CONTACT}
          courseCode="CS 101"
          courseTitle="Intro to Computer Science"
          isOpen={true}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Share Contact Card')).toBeDefined();
    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('Graduate Teaching Assistant')).toBeDefined();
    expect(screen.getByTestId('qr-code-svg-container')).toBeDefined();
  });

  it('switches to vCard raw details tab and displays RFC formatted vCard', () => {
    render(
      <ToastProvider>
        <ContactShareModal
          contact={MOCK_CONTACT}
          courseCode="CS 101"
          isOpen={true}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );

    const vcardTab = screen.getByTestId('tab-vcard-text');
    fireEvent.click(vcardTab);

    const preview = screen.getByTestId('vcard-raw-preview');
    expect(preview.textContent).toContain('BEGIN:VCARD');
    expect(preview.textContent).toContain('FN:Ada Lovelace');
    expect(preview.textContent).toContain('EMAIL;TYPE=INTERNET,WORK:ada@computing.edu');
  });

  it('provides email direct action with encoded mailto parameters', () => {
    render(
      <ToastProvider>
        <ContactShareModal
          contact={MOCK_CONTACT}
          courseCode="CS 101"
          isOpen={true}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );

    const emailBtn = screen.getByTestId('email-contact-btn');
    expect(emailBtn.getAttribute('href')).toContain('mailto:ada%40computing.edu');
    expect(emailBtn.getAttribute('href')).toContain('CS%20101');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <ContactShareModal
          contact={MOCK_CONTACT}
          courseCode="CS 101"
          isOpen={true}
          onClose={onClose}
        />
      </ToastProvider>,
    );

    const closeBtn = screen.getByLabelText(/Close share modal/i);
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ToastProvider>
        <ContactShareModal
          contact={MOCK_CONTACT}
          courseCode="CS 101"
          isOpen={false}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(container.firstChild).toBeNull();
  });
});
