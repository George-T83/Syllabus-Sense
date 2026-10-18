import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdvisorView } from '../AdvisorView';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { AdvisorMessage } from '@/types/advisor';
import type { DegreeCourse, DegreeProfile } from '@/types/degreeCompass';
import type { AppState } from '@/context/AppStateContext';

const getIdToken = vi.fn().mockResolvedValue('id-token');
let mockUser: { uid: string; getIdToken: typeof getIdToken } | null;
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

const replace = vi.fn();
let mockSearch = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => mockSearch,
}));

let mockProfile: DegreeProfile | null = null;
let mockDegreeLoading = false;
let mockDegreeCourses: DegreeCourse[] = [];
vi.mock('@/lib/firestore/useDegreeCompass', () => ({
  useDegreeProfile: () => ({ profile: mockProfile, loading: mockDegreeLoading }),
  useDegreeCourses: () => mockDegreeCourses,
}));

const appendAdvisorMessage = vi.fn();
let mockMessages: AdvisorMessage[] = [];
let mockMessagesLoading = false;
vi.mock('@/lib/firestore/advisor', () => ({
  appendAdvisorMessage: (...args: unknown[]) => appendAdvisorMessage(...args),
  useAdvisorMessages: () => ({ messages: mockMessages, loading: mockMessagesLoading }),
}));

const fetchMock = vi.fn();

function msg(o: Partial<AdvisorMessage> & { id: string }): AdvisorMessage {
  return {
    role: 'user',
    content: o.id,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...o,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const tree = (state: Partial<AppState> = {}) => (
  <ToastProvider>
    <AppStateProvider initialState={{ courses: [], scheduleItems: [], ...state }}>
      <AdvisorView />
    </AppStateProvider>
  </ToastProvider>
);

function renderAdvisor(state: Partial<AppState> = {}) {
  return render(tree(state));
}

function ask(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask the advisor' }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

function inputBox() {
  return screen.getByRole('textbox', { name: 'Ask the advisor' }) as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { uid: 'user-1', getIdToken };
  mockSearch = new URLSearchParams();
  mockProfile = null;
  mockDegreeLoading = false;
  mockDegreeCourses = [];
  mockMessages = [];
  mockMessagesLoading = false;
  appendAdvisorMessage.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AdvisorView first visit', () => {
  it('greets a student with no history and starts with Send disabled', () => {
    renderAdvisor();
    expect(screen.getByText(/I'm your AI Advisor/)).toBeDefined();
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not show the welcome message while history is still loading', () => {
    mockMessagesLoading = true;
    renderAdvisor();
    expect(screen.queryByText(/I'm your AI Advisor/)).toBeNull();
  });

  it('does not show the welcome message once there is a conversation', () => {
    mockMessages = [msg({ id: 'q1', content: 'Am I on track?' })];
    renderAdvisor();
    expect(screen.queryByText(/I'm your AI Advisor/)).toBeNull();
    expect(screen.getByText('Am I on track?')).toBeDefined();
  });

  it('enables Send only once there is non-blank text', () => {
    renderAdvisor();
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    fireEvent.change(inputBox(), { target: { value: '   ' } });
    expect(send.disabled).toBe(true);
    fireEvent.change(inputBox(), { target: { value: 'What next?' } });
    expect(send.disabled).toBe(false);
  });
});

describe('AdvisorView history', () => {
  it('renders saved messages from both sides in order', () => {
    mockMessages = [
      msg({ id: 'a', role: 'user', content: 'Can I drop MATH 240?' }),
      msg({ id: 'b', role: 'assistant', content: 'That would leave you at 9 credits.' }),
    ];
    renderAdvisor();
    const text = document.body.textContent ?? '';
    expect(text.indexOf('Can I drop MATH 240?')).toBeGreaterThan(-1);
    expect(text.indexOf('Can I drop MATH 240?')).toBeLessThan(
      text.indexOf('That would leave you at 9 credits.'),
    );
  });

  it('shows the plain-rules disclosure on an offline answer, and not on an AI one', () => {
    mockMessages = [
      msg({ id: 'a', role: 'assistant', content: 'Offline reply', offline: true }),
      msg({ id: 'b', role: 'assistant', content: 'AI reply' }),
    ];
    renderAdvisor();
    expect(
      screen.getAllByText(/Offline answer: worked out from your saved Degree Compass/),
    ).toHaveLength(1);
  });

  it('renders a high-stakes warning card with a link to message the real advisor', () => {
    mockMessages = [
      msg({
        id: 'a',
        role: 'assistant',
        content: 'Dropping it has consequences.',
        warning: { reason: 'Drops you below full-time', detail: 'You would have 9 credits.' },
      }),
    ];
    renderAdvisor();
    expect(screen.getByText('Drops you below full-time')).toBeDefined();
    expect(screen.getByText('You would have 9 credits.')).toBeDefined();
    expect(screen.getByText(/not a substitute for your academic/)).toBeDefined();
    const link = screen.getByRole('link', { name: 'Message your advisor' });
    expect(link.getAttribute('href')).toBe('/contacts');
  });

  it('lists up to three distinct earlier questions, skipping the most recent one', () => {
    mockMessages = [
      msg({ id: 'q1', content: 'Q one' }),
      msg({ id: 'q2', content: 'Q two' }),
      msg({ id: 'q3', content: 'Q three' }),
      msg({ id: 'q4', content: 'Q four' }),
      msg({ id: 'q5', content: 'Q five' }),
      msg({ id: 'q6', content: 'Q five' }),
    ];
    renderAdvisor();
    const heading = screen.getByRole('heading', { name: 'Recent questions' });
    const card = heading.parentElement as HTMLElement;
    const buttons = within(card).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['“Q four”', '“Q three”', '“Q two”']);
  });

  it('hides Recent questions when there is nothing earlier to repeat', () => {
    mockMessages = [msg({ id: 'q1', content: 'Only question' })];
    renderAdvisor();
    expect(screen.queryByRole('heading', { name: 'Recent questions' })).toBeNull();
  });

  it('asks a recent question again when it is clicked', async () => {
    mockMessages = [msg({ id: 'q1', content: 'Older one' }), msg({ id: 'q2', content: 'Newest' })];
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'Sure.' }));
    renderAdvisor();
    fireEvent.click(screen.getByRole('button', { name: '“Older one”' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).message).toBe('Older one');
  });
});

describe('AdvisorView reasoning panel', () => {
  it('says Not set up when there is no Degree Compass profile', () => {
    renderAdvisor();
    expect(screen.getByText('Not set up')).toBeDefined();
    expect(screen.queryByText('Overall credits')).toBeNull();
  });

  it('shows a loading marker, not Not set up, while the profile loads', () => {
    mockDegreeLoading = true;
    renderAdvisor();
    expect(screen.queryByText('Not set up')).toBeNull();
    expect(screen.getByText('…')).toBeDefined();
  });

  it('shows connected status with credit and term counts from the plan', () => {
    mockProfile = {
      majorName: 'CS',
      updatedAt: '2026-01-01',
      categories: [{ id: 'core', name: 'Core', creditsRequired: 30 }],
    };
    mockDegreeCourses = [
      {
        id: '1',
        term: 'Fall 2025',
        code: 'CS 101',
        credits: 4,
        categoryId: 'core',
        status: 'completed',
      },
      {
        id: '2',
        term: 'Spring 2026',
        code: 'CS 102',
        credits: 4,
        categoryId: 'core',
        status: 'completed',
      },
      {
        id: '3',
        term: 'Fall 2026',
        code: 'CS 201',
        credits: 3,
        categoryId: 'core',
        status: 'in-progress',
      },
    ];
    renderAdvisor();
    expect(screen.getByText('Connected')).toBeDefined();
    expect(screen.getByText('Completed terms').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Overall credits').nextElementSibling?.textContent).toBe('11 / 30');
  });
});

describe('AdvisorView sending a message', () => {
  it('saves the question, calls the API with auth and context, then saves the reply', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'Take CS 201 next.' }));
    renderAdvisor({
      courses: [{ id: 'c1', code: 'CS 301', title: 'Algorithms', term: 'Fall 2026' } as never],
      scheduleItems: [
        {
          id: 't1',
          courseId: 'c1',
          title: 'HW',
          type: 'assignment',
          dueDate: '2099-01-01',
          completed: false,
        },
        {
          id: 't2',
          courseId: 'c1',
          title: 'Old',
          type: 'assignment',
          dueDate: '2000-01-01',
          completed: false,
        },
        {
          id: 't3',
          courseId: 'c1',
          title: 'Done',
          type: 'assignment',
          dueDate: '2000-01-01',
          completed: true,
        },
      ],
    });
    ask('  What should I take next?  ');

    await waitFor(() => expect(appendAdvisorMessage).toHaveBeenCalledTimes(2));

    const [uid1, saved] = appendAdvisorMessage.mock.calls[0];
    expect(uid1).toBe('user-1');
    expect(saved).toMatchObject({ role: 'user', content: 'What should I take next?' });
    const [, reply] = appendAdvisorMessage.mock.calls[1];
    expect(reply).toMatchObject({ role: 'assistant', content: 'Take CS 201 next.' });
    expect(reply.warning).toBeUndefined();
    expect(reply.offline).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/advisor/chat');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer id-token');
    const body = JSON.parse(init.body);
    expect(body.message).toBe('What should I take next?');
    expect(body.courses).toEqual([{ code: 'CS 301', title: 'Algorithms', term: 'Fall 2026' }]);
    expect(body.pendingTaskCount).toBe(2);
    expect(body.overdueTaskCount).toBe(1);
  });

  it('clears the input after a successful save', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'ok' }));
    renderAdvisor();
    ask('Hello');
    await waitFor(() => expect(inputBox().value).toBe(''));
  });

  it('shows Thinking and locks the input while the request is in flight', async () => {
    let resolveFetch!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolveFetch = r)));
    renderAdvisor();
    ask('Hello');
    await screen.findByText('Thinking…');
    expect(inputBox().disabled).toBe(true);
    resolveFetch(jsonResponse({ reply: 'Hi' }));
    await waitFor(() => expect(screen.queryByText('Thinking…')).toBeNull());
    expect(inputBox().disabled).toBe(false);
  });

  it('sends only the previous eight messages as history, not the new question', async () => {
    mockMessages = Array.from({ length: 12 }, (_, i) =>
      msg({
        id: `m${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${i}`,
        createdAt: `2026-09-01T10:00:${String(i).padStart(2, '0')}.000Z`,
      }),
    );
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'ok' }));
    renderAdvisor();
    ask('latest');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const { history } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(history).toHaveLength(8);
    expect(history[0].content).toBe('turn 4');
    expect(history[7].content).toBe('turn 11');
    expect(history.map((h: { content: string }) => h.content)).not.toContain('latest');
  });

  it('keeps the high-stakes warning and offline flag on the saved reply', async () => {
    const highStakes = { reason: 'Prerequisite chain', detail: 'CS 301 needs CS 201.' };
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'Careful.', highStakes, offline: true }));
    renderAdvisor();
    ask('Skip CS 201?');
    await waitFor(() => expect(appendAdvisorMessage).toHaveBeenCalledTimes(2));
    expect(appendAdvisorMessage.mock.calls[1][1]).toMatchObject({
      warning: highStakes,
      offline: true,
    });
  });

  it('ignores a submit when the student is signed out', () => {
    mockUser = null;
    renderAdvisor();
    ask('Hello');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(appendAdvisorMessage).not.toHaveBeenCalled();
  });
});

describe('AdvisorView failures', () => {
  it('tells a student whose connection dropped to check it, and re-enables the form', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAdvisor();
    ask('Hello');
    expect(await screen.findByText("The Advisor couldn't answer")).toBeDefined();
    expect(
      screen.getByText("Couldn't reach the server. Check your connection and try again."),
    ).toBeDefined();
    expect(screen.queryByText('Thinking…')).toBeNull();
    expect(inputBox().disabled).toBe(false);
  });

  it('tells a student who hit the daily limit to try again tomorrow', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'rate limit' }, 429));
    renderAdvisor();
    ask('Hello');
    expect(
      await screen.findByText(
        "You've used today's AI requests. They reset tomorrow, so try again then.",
      ),
    ).toBeDefined();
  });

  it('tells a signed-out student to sign in again on a 401', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 401));
    renderAdvisor();
    ask('Hello');
    expect(
      await screen.findByText("You've been signed out. Sign in again, then retry."),
    ).toBeDefined();
  });

  it('shows generic server-error copy, never raw server text, on a 500 with an HTML body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Internal</html>', { status: 500 }));
    renderAdvisor();
    ask('Hello');
    expect(
      await screen.findByText('Something went wrong on our side. Try again in a moment.'),
    ).toBeDefined();
    expect(screen.queryByText(/Unexpected token/)).toBeNull();
  });

  it('does not save an assistant reply when the request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'x' }, 503));
    renderAdvisor();
    ask('Hello');
    await screen.findByText("AI features aren't available right now. Try again later.");
    expect(appendAdvisorMessage).toHaveBeenCalledTimes(1);
    expect(appendAdvisorMessage.mock.calls[0][1].role).toBe('user');
  });

  it('keeps the typed question and skips the API call when saving it fails', async () => {
    appendAdvisorMessage.mockRejectedValueOnce(new Error('Firestore is not configured.'));
    renderAdvisor();
    ask('Please keep me');
    await screen.findByText("The Advisor couldn't answer");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inputBox().value).toBe('Please keep me');
  });
});

describe('AdvisorView ?prompt= deep link', () => {
  beforeEach(() => {
    mockSearch = new URLSearchParams({ prompt: 'Am I on track to graduate?' });
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'Yes.' }));
  });

  it('asks the linked question immediately and clears the URL', async () => {
    renderAdvisor();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).message).toBe('Am I on track to graduate?');
    expect(replace).toHaveBeenCalledWith('/advisor');
  });

  it('waits for the Degree Compass plan to load before asking', () => {
    mockDegreeLoading = true;
    renderAdvisor();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('only asks once even if the page re-renders', async () => {
    const { rerender } = renderAdvisor();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender(tree());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
