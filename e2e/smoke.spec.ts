import { test, expect } from '@playwright/test';

test.describe('E2E Application Smoke Suite', () => {
  test('1. Public Login Page loads with expected form elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Syllabus Sense/);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('2. Authenticated Dashboard loads for fixture user', async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('mock_auth', 'true');
    });
    await page.goto('/dashboard?mock=true');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  });

  test('3. Authenticated Navigation across core app routes', async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('mock_auth', 'true');
    });
    await page.goto('/dashboard?mock=true');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Navigate to Courses
    await page.goto('/courses?mock=true');
    await expect(page).toHaveURL(/.*courses/);
    await expect(page.locator('h1')).toContainText('Courses', { timeout: 15000 });

    // Navigate to Tasks
    await page.goto('/tasks?mock=true');
    await expect(page).toHaveURL(/.*tasks/);
    await expect(page.locator('h1')).toContainText('Tasks', { timeout: 15000 });
  });
});
