import { test, expect } from '@playwright/test';
import { seedStudent, signIn } from './helpers';

test.describe('public pages', () => {
  test('login page loads with the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Syllabus Sense/);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('sign-up page loads with its form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
  });
});

test.describe('signed-in student', () => {
  test('sees their own work on the dashboard and Tasks page', async ({ page }) => {
    const { email } = await seedStudent('nav');
    await signIn(page, email);

    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Problem Set 5').first()).toBeVisible({ timeout: 30_000 });

    await page.goto('/tasks');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tasks');
    await expect(page.getByText('Midterm exam').first()).toBeVisible({ timeout: 30_000 });

    await page.goto('/courses');
    await expect(page.getByText('CSCI 213').first()).toBeVisible({ timeout: 30_000 });
  });

  test('deleting a task removes it and survives a reload', async ({ page }) => {
    const { email } = await seedStudent('delete');
    await signIn(page, email);
    await page.goto('/tasks');
    await expect(page.getByText('3 tasks')).toBeVisible({ timeout: 30_000 });

    const row = page
      .locator('li, div')
      .filter({ hasText: 'Reading: Chapter 3' })
      .filter({ has: page.getByRole('button', { name: 'Delete' }) })
      .last();
    await row.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Task deleted')).toBeVisible();
    await expect(page.getByText('2 tasks')).toBeVisible();

    await page.reload();
    await expect(page.getByText('2 tasks')).toBeVisible({ timeout: 30_000 });
  });

  test('a deleted task comes back with Undo, and is still there after a reload', async ({
    page,
  }) => {
    const { email } = await seedStudent('undo');
    await signIn(page, email);
    await page.goto('/tasks');
    await expect(page.getByText('3 tasks')).toBeVisible({ timeout: 30_000 });

    const row = page
      .locator('li, div')
      .filter({ hasText: 'Reading: Chapter 3' })
      .filter({ has: page.getByRole('button', { name: 'Delete' }) })
      .last();
    await row.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Task deleted')).toBeVisible();
    await expect(page.getByText('2 tasks')).toBeVisible();

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('3 tasks')).toBeVisible();

    await page.reload();
    await expect(page.getByText('3 tasks')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Reading: Chapter 3').first()).toBeVisible();
  });

  test("one student's data is not visible to another", async ({ page }) => {
    await seedStudent('other');
    const { email } = await seedStudent('mine');
    await signIn(page, email);
    await page.goto('/tasks');
    // Both accounts hold three tasks with the same titles; seeing six would mean a leak.
    await expect(page.getByText('3 tasks')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('6 tasks')).toHaveCount(0);
  });
});
