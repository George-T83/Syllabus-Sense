'use client';

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { Source } from '@/types/source';
import type { Flashcard } from '@/types/flashcard';
import type { Quiz, QuizAttempt } from '@/types/quiz';
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/lib/firestore/preferences';

export interface AppState {
  courses: Course[];
  scheduleItems: ScheduleItem[];
  contacts: Contact[];
  sources: Source[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  selectedCourseId: string | null;
  /** #101 semester switcher. `null` means "no explicit choice made yet" -
   * consumers should fall back to `inferCurrentTerm`. The literal string
   * 'all' is an explicit user choice to see every term, distinct from "no
   * opinion yet". A specific term string filters to that term. */
  selectedTerm: string | null;
  /** Account-level settings (lib/firestore/preferences.ts), kept live here
   * by useFirestoreSync's `users/{uid}` listener - centralizing it means
   * every view that renders a TaskRow reads the same realtime value
   * instead of each opening its own Firestore listener. Defaults until the
   * first snapshot arrives, so nothing needs to null-check this. */
  preferences: UserPreferences;
  initialized: boolean;
}

export type AppAction =
  | { type: 'SET_COURSES'; payload: Course[] }
  | { type: 'ADD_COURSE'; payload: Course }
  | { type: 'UPDATE_COURSE'; payload: Course }
  | { type: 'REMOVE_COURSE'; payload: string }
  | { type: 'SET_SCHEDULE_ITEMS'; payload: ScheduleItem[] }
  | { type: 'ADD_SCHEDULE_ITEM'; payload: ScheduleItem }
  | { type: 'UPDATE_SCHEDULE_ITEM'; payload: ScheduleItem }
  | { type: 'REMOVE_SCHEDULE_ITEM'; payload: string }
  | { type: 'TOGGLE_SCHEDULE_ITEM_COMPLETED'; payload: string }
  | { type: 'SET_CONTACTS'; payload: Contact[] }
  | { type: 'ADD_CONTACT'; payload: Contact }
  | { type: 'ADD_CONTACTS'; payload: Contact[] }
  | { type: 'UPDATE_CONTACT'; payload: Contact }
  | { type: 'REMOVE_CONTACT'; payload: string }
  | { type: 'SET_SOURCES'; payload: Source[] }
  | { type: 'ADD_SOURCE'; payload: Source }
  | { type: 'UPDATE_SOURCE'; payload: Source }
  | { type: 'REMOVE_SOURCE'; payload: string }
  | { type: 'SET_FLASHCARDS'; payload: Flashcard[] }
  | { type: 'ADD_FLASHCARD'; payload: Flashcard }
  | { type: 'ADD_FLASHCARDS'; payload: Flashcard[] }
  | { type: 'UPDATE_FLASHCARD'; payload: Flashcard }
  | { type: 'REMOVE_FLASHCARD'; payload: string }
  | { type: 'SET_QUIZZES'; payload: Quiz[] }
  | { type: 'ADD_QUIZ'; payload: Quiz }
  | { type: 'REMOVE_QUIZ'; payload: string }
  | { type: 'SET_QUIZ_ATTEMPTS'; payload: QuizAttempt[] }
  | { type: 'ADD_QUIZ_ATTEMPT'; payload: QuizAttempt }
  | { type: 'REMOVE_QUIZ_ATTEMPT'; payload: string }
  | { type: 'SELECT_COURSE'; payload: string | null }
  | { type: 'SELECT_TERM'; payload: string | null }
  | { type: 'SET_PREFERENCES'; payload: UserPreferences };

export const initialAppState: AppState = {
  courses: [],
  scheduleItems: [],
  contacts: [],
  sources: [],
  flashcards: [],
  quizzes: [],
  quizAttempts: [],
  selectedCourseId: null,
  selectedTerm: null,
  preferences: DEFAULT_PREFERENCES,
  initialized: false,
};

export function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_COURSES':
      return { ...state, courses: action.payload, initialized: true };
    case 'ADD_COURSE':
      return { ...state, courses: [...state.courses, action.payload] };
    case 'UPDATE_COURSE':
      return {
        ...state,
        courses: state.courses.map((c) => (c.id === action.payload.id ? action.payload : c)),
      };
    case 'REMOVE_COURSE':
      // Removing a course also drops its schedule items and contacts.
      // Without this, orphaned records would linger with a courseId
      // pointing at a course that no longer exists.
      return {
        ...state,
        courses: state.courses.filter((c) => c.id !== action.payload),
        scheduleItems: state.scheduleItems.filter((item) => item.courseId !== action.payload),
        contacts: state.contacts.filter((c) => c.courseId !== action.payload),
        sources: state.sources.filter((s) => s.courseId !== action.payload),
        flashcards: state.flashcards.filter((f) => f.courseId !== action.payload),
        quizzes: state.quizzes.filter((q) => q.courseId !== action.payload),
        quizAttempts: state.quizAttempts.filter((a) => a.courseId !== action.payload),
        selectedCourseId: state.selectedCourseId === action.payload ? null : state.selectedCourseId,
      };
    case 'SET_SCHEDULE_ITEMS':
      return { ...state, scheduleItems: action.payload };
    case 'ADD_SCHEDULE_ITEM':
      return { ...state, scheduleItems: [...state.scheduleItems, action.payload] };
    case 'UPDATE_SCHEDULE_ITEM':
      return {
        ...state,
        scheduleItems: state.scheduleItems.map((item) =>
          item.id === action.payload.id ? action.payload : item,
        ),
      };
    case 'REMOVE_SCHEDULE_ITEM':
      return {
        ...state,
        scheduleItems: state.scheduleItems.filter((item) => item.id !== action.payload),
      };
    case 'TOGGLE_SCHEDULE_ITEM_COMPLETED':
      return {
        ...state,
        scheduleItems: state.scheduleItems.map((item) =>
          item.id === action.payload ? { ...item, completed: !item.completed } : item,
        ),
      };
    case 'SET_CONTACTS':
      return { ...state, contacts: action.payload };
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };
    case 'ADD_CONTACTS':
      return { ...state, contacts: [...state.contacts, ...action.payload] };
    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map((c) => (c.id === action.payload.id ? action.payload : c)),
      };
    case 'REMOVE_CONTACT':
      return { ...state, contacts: state.contacts.filter((c) => c.id !== action.payload) };
    case 'SET_SOURCES':
      return { ...state, sources: action.payload };
    case 'ADD_SOURCE':
      return { ...state, sources: [...state.sources, action.payload] };
    case 'UPDATE_SOURCE':
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.payload.id ? action.payload : s)),
      };
    case 'REMOVE_SOURCE':
      return { ...state, sources: state.sources.filter((s) => s.id !== action.payload) };
    case 'SET_FLASHCARDS':
      return { ...state, flashcards: action.payload };
    case 'ADD_FLASHCARD':
      return { ...state, flashcards: [...state.flashcards, action.payload] };
    case 'ADD_FLASHCARDS':
      return { ...state, flashcards: [...state.flashcards, ...action.payload] };
    case 'UPDATE_FLASHCARD':
      return {
        ...state,
        flashcards: state.flashcards.map((f) => (f.id === action.payload.id ? action.payload : f)),
      };
    case 'REMOVE_FLASHCARD':
      return { ...state, flashcards: state.flashcards.filter((f) => f.id !== action.payload) };
    case 'SET_QUIZZES':
      return { ...state, quizzes: action.payload };
    case 'ADD_QUIZ':
      return { ...state, quizzes: [...state.quizzes, action.payload] };
    case 'REMOVE_QUIZ':
      return { ...state, quizzes: state.quizzes.filter((q) => q.id !== action.payload) };
    case 'SET_QUIZ_ATTEMPTS':
      return { ...state, quizAttempts: action.payload };
    case 'ADD_QUIZ_ATTEMPT':
      return { ...state, quizAttempts: [...state.quizAttempts, action.payload] };
    case 'REMOVE_QUIZ_ATTEMPT':
      return {
        ...state,
        quizAttempts: state.quizAttempts.filter((a) => a.id !== action.payload),
      };
    case 'SELECT_COURSE':
      return { ...state, selectedCourseId: action.payload };
    case 'SELECT_TERM':
      return { ...state, selectedTerm: action.payload };
    case 'SET_PREFERENCES':
      return { ...state, preferences: action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppStateContext = createContext<AppContextType | undefined>(undefined);

interface AppStateProviderProps {
  children: React.ReactNode;
  initialState?: Partial<AppState>;
}

const TERM_STORAGE_KEY = 'syllabus-sense-selected-term';

function readStoredTerm(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TERM_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AppStateProvider({ children, initialState }: AppStateProviderProps) {
  const mergedInitialState: AppState = {
    ...initialAppState,
    ...initialState,
  };

  // Reads localStorage synchronously in the reducer's lazy initializer
  // (runs during the very first render, before any child mounts) rather
  // than in a useEffect - restoring it in an effect would leave a window
  // where children's own mount-time reads (e.g. a filter's lazy useState
  // seeded from selectedTerm) see the still-null default and miss the
  // restored value entirely. Guarded on the caller's own initialState so a
  // test/consumer that explicitly passes initialState.selectedTerm is never
  // silently overridden by a stale value from a previous session.
  const [state, dispatch] = useReducer(appStateReducer, mergedInitialState, (init) => {
    if (init.selectedTerm !== null) return init;
    const stored = readStoredTerm();
    return stored ? { ...init, selectedTerm: stored } : init;
  });

  useEffect(() => {
    try {
      if (state.selectedTerm) {
        window.localStorage.setItem(TERM_STORAGE_KEY, state.selectedTerm);
      } else {
        window.localStorage.removeItem(TERM_STORAGE_KEY);
      }
    } catch {
      // ignore localStorage errors (e.g. private browsing)
    }
  }, [state.selectedTerm]);

  // Memoized so consumers only re-render when app state actually changes.
  // This provider sits below SidebarProvider and ThemeProvider, so without
  // this every drawer open or theme toggle would re-render every consumer.
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

// Pure Selector Helpers
export function getSelectedCourse(state: AppState): Course | null {
  if (!state.selectedCourseId) return null;
  return state.courses.find((c) => c.id === state.selectedCourseId) || null;
}

export function getScheduleItemsByCourse(state: AppState, courseId: string | null): ScheduleItem[] {
  if (!courseId) return [];
  return state.scheduleItems.filter((item) => item.courseId === courseId);
}

/**
 * #101 semester switcher support.
 *
 * Infers the "current" term as whichever term the most courses belong to.
 * There's no explicit term-boundary data (courses only carry a free-text
 * `term` label, not start/end dates) - this is a reasonable default that
 * degrades gracefully to "show everything" once a user has courses spanning
 * multiple terms without a clear majority.
 */
export function inferCurrentTerm(courses: Pick<Course, 'term'>[]): string | null {
  const counts = new Map<string, number>();
  for (const course of courses) {
    if (!course.term) continue;
    counts.set(course.term, (counts.get(course.term) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [term, count] of Array.from(counts)) {
    if (count > bestCount) {
      best = term;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Resolves what term the app should actually scope views to, given the
 * user's stored preference (`AppState.selectedTerm`) and their courses.
 * Returns `null` to mean "no filter - show every term" (either because the
 * user explicitly chose 'All Terms', or because there's nothing to infer
 * yet), or a specific term string to filter by.
 */
export function resolveActiveTerm(
  selectedTerm: string | null,
  courses: Pick<Course, 'term'>[],
): string | null {
  if (selectedTerm === 'all') return null;
  if (selectedTerm) return selectedTerm;
  return inferCurrentTerm(courses);
}
