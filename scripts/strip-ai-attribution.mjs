#!/usr/bin/env node
/**
 * husky commit-msg hook body: rewrites the commit message file in place,
 * removing any AI attribution before the commit is created. This is the
 * first enforcement point - see scripts/attributionPatterns.js for what
 * counts as attribution and why there are three enforcement points.
 */
import fs from 'node:fs';
import { stripAiAttribution } from './attributionPatterns.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: strip-ai-attribution.mjs <commit-msg-file>');
  process.exit(1);
}

const original = fs.readFileSync(file, 'utf8');
const cleaned = stripAiAttribution(original);

if (cleaned !== original) {
  fs.writeFileSync(file, cleaned, 'utf8');
  console.log('[strip-ai-attribution] Removed AI attribution from commit message.');
}
