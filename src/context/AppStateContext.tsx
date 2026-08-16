'use client';

import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { Course, ScheduleItem } from '@/types/schedule';

export interface AppState {
  courses: Course[];
  scheduleItems: ScheduleItem[];
  selectedCourseId: string | null;
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
  | { type: 'SELECT_COURSE'; payload: string | null };

export const initialAppState: AppState = {
  courses: [],
  scheduleItems: [],
  selectedCourseId: null,
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
      // Removing a course also drops its schedule items. Without this the
      // items linger with a courseId pointing at a course that no longer
      // exists, so any view listing all items (dashboard, heatmap) would
      // still render work for a deleted course.
      return {
        ...state,
        courses: state.courses.filter((c) => c.id !== action.payload),
        scheduleItems: state.scheduleItems.filter((item) => item.courseId !== action.payload),
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
    case 'SELECT_COURSE':
      return { ...state, selectedCourseId: action.payload };
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

export function AppStateProvider({ children, initialState }: AppStateProviderProps) {
  const mergedInitialState: AppState = {
    ...initialAppState,
    ...initialState,
  };

  const [state, dispatch] = useReducer(appStateReducer, mergedInitialState);

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
