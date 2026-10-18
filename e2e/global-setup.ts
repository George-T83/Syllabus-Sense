/**
 * The suite runs against the dev server (the production Content Security
 * Policy deliberately blocks the local emulators), which compiles each page on
 * its first visit. Visiting them once up front keeps that one-off cost out of
 * the individual tests' timeouts.
 */
export default async function globalSetup() {
  const base = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
  for (const path of ['/login', '/signup', '/dashboard', '/tasks', '/courses']) {
    await fetch(base + path).catch(() => undefined);
  }
}
