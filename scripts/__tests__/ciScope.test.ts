import { describe, it, expect } from 'vitest';
import { isDocsOnly, isNonCodePath } from '../ciScope.js';
import { stripAiAttribution } from '../attributionPatterns.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('isDocsOnly', () => {
  it('is true when every changed file is prose', () => {
    expect(isDocsOnly(['README.md', 'docs/ARCHITECTURE.md', 'docs/screenshots/a.png'])).toBe(true);
    expect(isDocsOnly(['CLAUDE.md', '.github/pull_request_template.md', 'LICENSE'])).toBe(true);
  });

  it('is false as soon as one file can affect a job', () => {
    expect(isDocsOnly(['README.md', 'src/app/page.tsx'])).toBe(false);
    expect(isDocsOnly(['package.json'])).toBe(false);
    expect(isDocsOnly(['package-lock.json'])).toBe(false);
    expect(isDocsOnly(['firestore.rules'])).toBe(false);
  });

  it('never skips for a change to the pipeline itself', () => {
    expect(isDocsOnly(['.github/workflows/ci.yml'])).toBe(false);
    expect(isDocsOnly(['scripts/ci-scope.mjs'])).toBe(false);
    expect(isDocsOnly(['scripts/ciScope.js'])).toBe(false);
  });

  it('treats an empty or blank list as "could not tell" and runs CI', () => {
    expect(isDocsOnly([])).toBe(false);
    expect(isDocsOnly(['', '  '])).toBe(false);
  });

  it('does not treat a markdown-looking name inside code as prose', () => {
    expect(isNonCodePath('src/lib/readme.md.ts')).toBe(false);
    expect(isNonCodePath('src/docs/helper.ts')).toBe(false);
  });
});

describe('strip-pr-attribution pre-filter', () => {
  const workflow = readFileSync(
    path.join(__dirname, '../../.github/workflows/strip-pr-attribution.yml'),
    'utf8',
  );

  it('only skips bodies the stripper would leave unchanged', () => {
    // The workflow's job-level `if` is a cheap superset check done before a
    // runner is started. Every body stripAiAttribution would change must still
    // pass it.
    const needles = ['claude', 'co-authored-by'];
    for (const needle of needles) expect(workflow.toLowerCase()).toContain(`'${needle}'`);
    const samples = [
      'Body\n\n---\n_Generated with [Claude Code](https://claude.ai/code)_',
      '🤖 Generated with Claude Code',
      'text\nCo-Authored-By: Someone <a@b.c>',
      'text\nco-authored-by: someone <a@b.c>',
      'text\nClaude-Session: https://claude.ai/code/session_1',
      'text\nhttps://claude.ai/code/session_1',
    ];
    for (const body of samples) {
      expect(stripAiAttribution(body)).not.toBe(body);
      const lower = body.toLowerCase();
      expect(needles.some((n) => lower.includes(n))).toBe(true);
    }
  });
});
