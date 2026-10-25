import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// The root layout's title template appends " | Syllabus Sense", so a page that
// also writes the site name itself ends up with it twice.
function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return name === 'page.tsx' ? [full] : [];
  });
}

describe('page titles', () => {
  const root = path.join(process.cwd(), 'src', 'app');
  const pages = pageFiles(root);

  it('never repeat the site name that the layout template adds', () => {
    const offenders = pages.filter((file) => {
      const match = /title:\s*'([^']*)'/.exec(readFileSync(file, 'utf8'));
      return match ? /Syllabus Sense/i.test(match[1]) : false;
    });
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it('give every signed-in page a title of its own', () => {
    const appPages = pages.filter((f) => f.includes(`${path.sep}(app)${path.sep}`));
    const missing = appPages.filter((file) => {
      const text = readFileSync(file, 'utf8');
      // /planner only redirects to /tasks.
      if (/redirect\(/.test(text)) return false;
      return !/title:\s*'[^']+'/.test(text);
    });
    expect(missing.map((f) => path.relative(root, f))).toEqual([]);
  });
});
