import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    // Scans all of src/, not just pages/components/app: files like
    // src/lib/mock-data.ts hold literal Tailwind class strings (e.g.
    // course.color: 'bg-blue-500') that Tailwind's JIT scanner needs to see
    // to generate their CSS - narrower globs silently drop that class.
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Wires the Geist variable font (loaded via next/font/local in
        // layout.tsx) into Tailwind's default sans stack. Without this, the
        // --font-geist-sans CSS variable is defined but nothing ever
        // consumes it, so the app silently falls back to the browser's raw
        // system-font stack - and different font-weight utilities on that
        // stack can resolve to genuinely different typefaces (e.g. a bold
        // number rendering in a different font family than adjacent medium-
        // weight text), which is exactly the mismatch this fixes.
        sans: ['var(--font-geist-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        load: {
          low: 'hsl(var(--load-low) / <alpha-value>)',
          medium: 'hsl(var(--load-medium) / <alpha-value>)',
          high: 'hsl(var(--load-high) / <alpha-value>)',
          critical: 'hsl(var(--load-critical) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        glass: '1rem',
        'glass-lg': '1.5rem',
      },
      spacing: {
        'glass-padding': '1.5rem',
        'glass-gap': '2rem',
      },
      fontSize: {
        display: [
          '2.25rem',
          { lineHeight: '2.5rem', letterSpacing: '-0.025em', fontWeight: '700' },
        ],
        h1: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        h3: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0em', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0em', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em', fontWeight: '500' }],
        label: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em', fontWeight: '600' }],
        'glass-title': [
          '2.25rem',
          { lineHeight: '2.75rem', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
        'glass-subtitle': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
        'glass-hover': '0 12px 40px 0 rgba(0, 0, 0, 0.12)',
        // Card v2: brand-tinted, theme-aware shadow driven by CSS vars
        // (globals.css) so the same class works in light and dark.
        card: 'var(--card-shadow)',
        'card-hover': 'var(--card-shadow-hover)',
        // Modal v1: a distinct, deeper elevation tier for true modal-overlay
        // surfaces (dialogs, sheets), theme-aware via --modal-shadow.
        modal: 'var(--modal-shadow)',
      },
    },
  },
  plugins: [],
};
export default config;
