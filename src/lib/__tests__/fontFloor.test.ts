import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** The smallest text size the app uses, in px. Anything below this is hard to
 * read on a phone, and a fixed px size would also ignore the text size
 * setting - use `text-xs` (0.75rem), which scales. */
const FLOOR_PX = 12;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(tsx|css)$/.test(entry.name) ? [full] : [];
  });
}

describe('12px text floor', () => {
  const files = sourceFiles(path.join(process.cwd(), 'src'));

  it('has no arbitrary text size below 12px', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(m[1]) < FLOOR_PX)
          offenders.push(`${path.relative(process.cwd(), file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no chart or inline font size below 12px', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/fontSize(?:=|:)\s*\{?\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/g)) {
        if (Number(m[1]) < FLOOR_PX)
          offenders.push(`${path.relative(process.cwd(), file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
