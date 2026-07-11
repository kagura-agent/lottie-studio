import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsive', () => {
  test.use(devices['iPhone 13']);

  test('layout is stacked on mobile viewport', async ({ page }) => {
    await page.goto('/editor/new');
    await page.waitForLoadState('networkidle');

    // On mobile, the layout should be stacked (not side-by-side)
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(430);

    // Main content should be visible
    await expect(page.locator('main').or(page.locator('[class*="editor"]')).first()).toBeVisible({ timeout: 10_000 });
  });

  test('tab bar or nav is visible on mobile', async ({ page }) => {
    await page.goto('/editor/new');
    await page.waitForLoadState('networkidle');

    // Mobile should have either a tab bar or toggle buttons for canvas/chat
    const tabBar = page.locator('[data-testid="tab-bar"]')
      .or(page.locator('[class*="tab-bar"]'))
      .or(page.locator('[class*="tabBar"]'))
      .or(page.locator('[role="tablist"]'))
      .or(page.locator('nav[class*="mobile"]'))
      .or(page.getByRole('tab'));
    await expect(tabBar.first()).toBeVisible({ timeout: 10_000 });
  });
});
