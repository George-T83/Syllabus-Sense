import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SyllabusAutofillModal } from '@/components/syllabus/SyllabusAutofillModal';
import { AppStateProvider } from '@/context/AppStateContext';

vi.mock('@/lib/firestore/courses', () => ({ createCourseWithScheduleItems: vi.fn() }));
vi.mock('@/lib/firestore/contacts', () => ({ createContacts: vi.fn(), updateContact: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1', getIdToken: vi.fn().mockResolvedValue('token') },
    loading: false,
  }),
}));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), setDoc: vi.fn() }));
vi.mock('@/lib/firebase/client', () => ({ storage: {}, db: {} }));

function renderModal() {
  return render(
    <AppStateProvider initialState={{ courses: [], scheduleItems: [], contacts: [] }}>
      <SyllabusAutofillModal open onClose={vi.fn()} />
    </AppStateProvider>,
  );
}

async function uploadSyllabus() {
  const file = new File(['%PDF-1.4'], 'syllabus.pdf', { type: 'application/pdf' });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('SyllabusAutofillModal when extraction fails', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('says the daily limit was reached, without blaming the file, and offers no useless retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Daily AI usage limit reached (60 requests/day).' }), {
        status: 429,
      }),
    );
    renderModal();
    await uploadSyllabus();

    expect(await screen.findByText(/used today's AI requests/i)).toBeDefined();
    expect(screen.queryByText(/couldn't read that file/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add it by hand' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose a different file' })).toBeDefined();
  });

  it('treats a non-JSON gateway error as a service problem and still allows a retry', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));
    renderModal();
    await uploadSyllabus();

    expect(await screen.findByText(/AI service had a problem/i)).toBeDefined();
    expect(screen.queryByText(/Unexpected token/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('names a dropped connection as one', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    renderModal();
    await uploadSyllabus();

    expect(await screen.findByText(/Couldn't reach the server/i)).toBeDefined();
    expect(screen.queryByText(/Failed to fetch/i)).toBeNull();
  });

  it('only blames the file when the file is the problem', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'That document appears to be empty.' }), {
        status: 400,
      }),
    );
    renderModal();
    await uploadSyllabus();

    expect(await screen.findByText('That document appears to be empty.')).toBeDefined();
  });

  it('lets the student carry on by hand from the failure screen', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    renderModal();
    await uploadSyllabus();

    fireEvent.click(await screen.findByRole('button', { name: 'Add it by hand' }));
    await waitFor(() => expect(screen.queryByText(/AI features aren't available/i)).toBeNull());
    expect(screen.queryByRole('button', { name: 'Add it by hand' })).toBeNull();
  });
});
