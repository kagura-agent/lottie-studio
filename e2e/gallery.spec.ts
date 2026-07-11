import { test, expect } from '@playwright/test';
import { mockAnimationsAPI } from './fixtures/mock-api';

test.describe('Gallery Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnimationsAPI(page);
  });

  test('loads landing page with hero section', async ({ page }) => {
    await page.goto('/');
    // Hero section should be visible
    await expect(page.locator('main')).toBeVisible();
    // Page should have the app title somewhere
    await expect(page).toHaveTitle(/Lottie Studio/i);
  });

  test('shows New Animation button', async ({ page }) => {
    await page.goto('/');
    const newBtn = page.getByRole('link', { name: /new animation/i })
      .or(page.getByRole('button', { name: /new animation/i }))
      .or(page.locator('a[href*="/editor/new"]'));
    await expect(newBtn.first()).toBeVisible();
  });

  test('New Animation button navigates to editor', async ({ page }) => {
    await page.goto('/');
    const newBtn = page.locator('a[href*="/editor/new"]').first();
    await newBtn.click();
    await expect(page).toHaveURL(/\/editor\/new/);
  });
});
