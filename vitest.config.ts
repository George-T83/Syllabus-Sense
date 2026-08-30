import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // .claude/worktrees holds isolated checkouts used by subagents (each with
    // its own in-progress files) - without this, vitest's default glob picks
    // up their test files too and fails to resolve imports against this
    // tree's node_modules/aliases.
    exclude: ['**/node_modules/**', '**/.claude/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
