import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

describe('Production Authentication Security (Airtight Gates)', () => {
  const authContextPath = path.join(__dirname, '../../context/AuthContext.tsx');

  it('S1: verifies that the mock authentication credentials block is gated by process.env.NODE_ENV !== "production"', () => {
    const fileContent = fs.readFileSync(authContextPath, 'utf8');

    // Assert that the credentials or UID string exists in the file
    expect(fileContent).toContain('kyHjDg6iM5YokWhHTh071SW6Yds2');

    // Assert that process.env.NODE_ENV !== 'production' or similar is defined
    expect(fileContent).toContain("process.env.NODE_ENV !== 'production'");

    // Specifically verify that the mock auth initialization block is gated by NODE_ENV
    const lines = fileContent.split('\n');
    let gatedLineFound = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("process.env.NODE_ENV !== 'production'")) {
        // Look ahead for the mock user initialization block
        const blockText = lines.slice(i, i + 30).join('\n');
        if (
          blockText.includes('kyHjDg6iM5YokWhHTh071SW6Yds2') &&
          blockText.includes('dev-test@syllabussense.dev')
        ) {
          gatedLineFound = true;
          break;
        }
      }
    }
    expect(gatedLineFound).toBe(true);
  });

  it('S2: verifies that the mock test UID is completely absent from the production build chunks', () => {
    const nextBuildDir = path.join(__dirname, '../../../.next');
    if (!fs.existsSync(nextBuildDir)) {
      // Skip if build directory is not present (e.g. running in fresh dev-only test pass)
      console.log('Skipping S2: .next directory does not exist. Run npm run build first.');
      return;
    }

    const staticChunksDir = path.join(nextBuildDir, 'static/chunks');
    if (!fs.existsSync(staticChunksDir)) {
      console.log('Skipping S2: .next/static/chunks does not exist.');
      return;
    }

    const scanDirectoryForString = (dir: string, searchStr: string): string[] => {
      const results: string[] = [];
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...scanDirectoryForString(fullPath, searchStr));
        } else if (file.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes(searchStr)) {
            results.push(fullPath);
          }
        }
      }
      return results;
    };

    // The hardcoded UID for dev-test must be completely absent from clientside compiled JS chunks
    const matches = scanDirectoryForString(staticChunksDir, 'kyHjDg6iM5YokWhHTh071SW6Yds2');
    if (matches.length > 0) {
      console.error('Security Failure: Hardcoded UID found in production chunks:', matches);
    }
    expect(matches.length).toBe(0);
  });
});
