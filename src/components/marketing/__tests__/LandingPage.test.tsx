import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import LandingPage from '../LandingPage';

const setTheme = vi.fn();
let mockResolvedTheme: 'light' | 'dark';
vi.mock('@/context/ThemeProvider', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme }),
}));

function hrefs(links: HTMLElement[]) {
  return links.map((l) => l.getAttribute('href'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolvedTheme = 'light';
});

describe('LandingPage', () => {
  it('has a single top-level heading that states the pitch', () => {
    render(<LandingPage />);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toContain('Everything that matters');
    expect(h1[0].textContent).toContain('right where you can see it');
  });

  it('puts Sign up and Log in in the header navigation', () => {
    render(<LandingPage />);
    const nav = screen.getByRole('banner');
    expect(within(nav).getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe('/signup');
    expect(within(nav).getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
  });

  it('leads the hero with a Get started call to action that goes to sign up', () => {
    render(<LandingPage />);
    const main = screen.getByRole('main');
    const cta = within(main).getByRole('link', { name: 'Get started free' });
    expect(cta.getAttribute('href')).toBe('/signup');
    expect(within(main).getByText(/No credit card/)).toBeDefined();
  });

  it('offers a way in for returning students in the hero and the closing banner', () => {
    render(<LandingPage />);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
    expect(
      within(main).getByRole('link', { name: 'I already have an account' }).getAttribute('href'),
    ).toBe('/login');
  });

  it('repeats the sign-up call to action at the end of the page', () => {
    render(<LandingPage />);
    expect(screen.getByRole('link', { name: 'Sign up free' }).getAttribute('href')).toBe('/signup');
    expect(
      screen.getByRole('heading', { name: /We read the fine print so you don't have to/ }),
    ).toBeDefined();
  });

  it('only ever links to the sign-up and login pages', () => {
    render(<LandingPage />);
    const all = new Set(hrefs(screen.getAllByRole('link')));
    expect([...all].sort()).toEqual(['/login', '/signup']);
  });

  it('describes the three features under their own headings', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { level: 2, name: /What actually changes once it's uploaded/ }),
    ).toBeDefined();
    const features = [
      'Upload the syllabus, skip the re-typing',
      'A planner that flags overload before it happens',
      'Every deadline, one calendar',
    ];
    for (const title of features) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeDefined();
    }
  });

  it('shows the example parsed syllabus with its high-stakes and overload flags', () => {
    render(<LandingPage />);
    expect(screen.getByText('CSCI213_Syllabus.pdf - parsed')).toBeDefined();
    expect(screen.getByText('High stakes - 25%')).toBeDefined();
    expect(screen.getByText('Overloaded Thu')).toBeDefined();
  });

  it('has a footer', () => {
    render(<LandingPage />);
    expect(screen.getByRole('contentinfo')).toBeDefined();
  });

  it('lets a visitor switch theme from the header', async () => {
    render(<LandingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('offers the way back to light when the page is dark', async () => {
    mockResolvedTheme = 'dark';
    render(<LandingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to light theme' }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
