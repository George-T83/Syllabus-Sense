import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PrivacyPage from '../page';

describe('privacy page', () => {
  it('has one page title and covers storage, AI, controls', () => {
    render(<PrivacyPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of [
      'What is stored in your account',
      'What is sent to the AI service',
      'What is not here',
      'On your device',
      'Your controls',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
  });

  it('is reachable from the signed-out header', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('link', { name: 'Syllabus Sense home' }).getAttribute('href')).toBe(
      '/',
    );
  });
});

/**
 * The page promises "no analytics or tracking scripts". Keep that promise
 * tied to the code: adding one of these means updating the page first.
 */
describe('the "no analytics" promise on the privacy page', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

  it('has no analytics or tracking packages installed', () => {
    const tracker =
      /analytics|segment|mixpanel|amplitude|posthog|sentry|hotjar|fullstory|datadog|logrocket|gtag|clarity/i;
    expect(deps.filter((d) => tracker.test(d))).toEqual([]);
  });
});
