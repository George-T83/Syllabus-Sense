'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'syllabus-sense-theme';

function readStoredTheme(): Theme {
  // Runs during the very first client render (not in an effect) so the apply
  // effect below never transiently resolves against the wrong theme. Reading
  // in an effect instead would briefly drop the 'dark' class for a user who
  // picked dark on a light-mode OS - the exact flash the inline script in
  // layout.tsx exists to prevent.
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore localStorage errors (e.g., private browsing)
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (currentTheme: Theme) => {
      let resolved: 'light' | 'dark';

      if (currentTheme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        resolved = mediaQuery.matches ? 'dark' : 'light';
      } else {
        resolved = currentTheme;
      }

      setResolvedTheme(resolved);

      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        const resolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(resolved);
        if (resolved === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else {
        mediaQuery.addListener(listener);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', listener);
        } else {
          mediaQuery.removeListener(listener);
        }
      };
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
