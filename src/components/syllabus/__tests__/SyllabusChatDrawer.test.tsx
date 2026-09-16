import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyllabusChatDrawer } from '../SyllabusChatDrawer';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course } from '@/types/schedule';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      getIdToken: () => Promise.resolve('mock-token'),
      uid: 'test-user',
    },
  }),
}));

vi.mock('@/lib/firestore/useDegreeCompass', () => ({
  useDegreeProfile: () => ({ profile: null, loading: false }),
  useDegreeCourses: () => [],
}));

const appendAdvisorMessage = vi.fn().mockResolvedValue(undefined);
let mockAdvisorMessages: { id: string; role: 'user' | 'assistant'; content: string }[] = [];
vi.mock('@/lib/firestore/advisor', () => ({
  appendAdvisorMessage: (...args: unknown[]) => appendAdvisorMessage(...args),
  useAdvisorMessages: () => ({ messages: mockAdvisorMessages, loading: false }),
}));

const mockCourses: Course[] = [
  {
    id: 'course-1',
    code: 'CS 301',
    title: 'Data Structures & Algorithms',
    instructor: 'Dr. Ada Lovelace',
    meetingTimes: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:15', location: 'Science Hall 204' },
    ],
    term: 'Fall 2026',
    notes: 'Late work allowed up to 3 days with penalty.',
    materials: [{ name: 'CLRS Algorithms Textbook' }],
  },
  {
    id: 'course-2',
    code: 'MATH 240',
    title: 'Linear Algebra',
    instructor: 'Prof. Gauss',
    meetingTimes: [
      { dayOfWeek: 2, startTime: '11:00', endTime: '12:15', location: 'Math Hall 101' },
    ],
    term: 'Fall 2026',
  },
];

function renderWithProviders(ui: React.ReactElement, stateOverrides: Partial<AppState> = {}) {
  const initialState: Partial<AppState> = {
    courses: mockCourses,
    scheduleItems: [],
    contacts: [],
    selectedTerm: 'Fall 2026',
    ...stateOverrides,
  };

  return render(
    <ThemeProvider>
      <ToastProvider>
        <AppStateProvider initialState={initialState as AppState}>{ui}</AppStateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('SyllabusChatDrawer (Item 35)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvisorMessages = [];
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
    // Mock fetch for chat API
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            reply: 'Late submissions are accepted up to 3 days late with 10% penalty per day.',
            citations: ['[CS 301 Syllabus § Late Policy]'],
            suggestions: ['What is the attendance policy?'],
          }),
      }),
    );
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithProviders(
      <SyllabusChatDrawer isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders chat header, course selector, message history, and input when open', () => {
    renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/AI Syllabus Copilot/i)).toBeDefined();
    expect(screen.getByLabelText(/Select course scope/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Ask anything about/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Send query/i })).toBeDefined();
  });

  it('allows selecting different course scopes', () => {
    renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

    const select = screen.getByLabelText(/Select course scope/i) as HTMLSelectElement;
    expect(select.value).toBe('course-1');

    fireEvent.change(select, { target: { value: 'course-2' } });
    expect(select.value).toBe('course-2');
  });

  it('sends user message and displays AI assistant response with citations', async () => {
    renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ask anything about/i);
    const sendButton = screen.getByRole('button', { name: /Send query/i });

    fireEvent.change(input, { target: { value: 'Can I get an extension on assignment 4?' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('Can I get an extension on assignment 4?')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Late submissions are accepted up to 3 days/i)).toBeDefined();
      expect(screen.getByText(/CS 301 Syllabus § Late Policy/i)).toBeDefined();
    });
  });

  it('sends quick starter prompt when clicked', async () => {
    renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

    const promptBtn = screen.getByRole('button', { name: 'What is the late work policy?' });
    fireEvent.click(promptBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Late submissions are accepted/i)).toBeDefined();
    });
  });

  it('calls onClose when close button or Escape is pressed', () => {
    const onClose = vi.fn();
    renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  describe('This syllabus / My Advisor mode toggle (Direction A)', () => {
    it('defaults to "This syllabus" mode with the course selector visible', () => {
      renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

      const syllabusTab = screen.getByRole('tab', { name: 'This syllabus' });
      expect(syllabusTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByLabelText(/Select course scope/i)).toBeDefined();
    });

    it('switching to "My Advisor" hides the course selector and shows the Advisor welcome message', () => {
      renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('tab', { name: 'My Advisor' }));

      expect(screen.getByRole('heading', { name: /AI Advisor/i })).toBeDefined();
      expect(screen.queryByLabelText(/Select course scope/i)).toBeNull();
      expect(screen.getByText(/reason over your Degree Compass plan/i)).toBeDefined();
      expect(
        screen.getByPlaceholderText(/Ask about your degree, GPA, or what to take next/i),
      ).toBeDefined();
    });

    it('switching back to "This syllabus" restores the course-scoped UI', () => {
      renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('tab', { name: 'My Advisor' }));
      fireEvent.click(screen.getByRole('tab', { name: 'This syllabus' }));

      expect(screen.getByLabelText(/Select course scope/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Ask anything about/i)).toBeDefined();
    });

    it('sends an Advisor message to /api/advisor/chat and persists it via appendAdvisorMessage', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/advisor/chat') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ reply: 'You are on track to graduate in Spring 2028.' }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      });

      renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole('tab', { name: 'My Advisor' }));

      const input = screen.getByPlaceholderText(/Ask about your degree/i);
      fireEvent.change(input, { target: { value: 'Am I on track to graduate?' } });
      fireEvent.click(screen.getByRole('button', { name: /Send query/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/advisor/chat',
          expect.objectContaining({ method: 'POST' }),
        );
        expect(appendAdvisorMessage).toHaveBeenCalled();
      });
    });

    it('does not show the file-upload button in Advisor mode', () => {
      renderWithProviders(<SyllabusChatDrawer isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByLabelText(/Upload syllabus or assignment rubric/i)).toBeDefined();

      fireEvent.click(screen.getByRole('tab', { name: 'My Advisor' }));
      expect(screen.queryByLabelText(/Upload syllabus or assignment rubric/i)).toBeNull();
    });
  });
});
