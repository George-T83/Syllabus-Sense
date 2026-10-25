import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Design rule: interactive elements lift (translateY plus a shadow) on hover;
// they never grow. Press feedback (active:scale-*) is a separate, allowed thing.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.(tsx|ts|css)$/.test(name) ? [full] : [];
  });
}

describe('hover styles', () => {
  it('never scale an element on hover', () => {
    const root = path.join(process.cwd(), 'src');
    const offenders = sourceFiles(root).filter((file) =>
      /(?:^|[\s'"`:])(?:group-)?hover:scale-/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
});
