import { test, expect } from '@playwright/test';
import { mockChatAPI } from './fixtures/mock-api';

test.describe('Export Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockChatAPI(page);
  });

  test('export button opens export dialog', async ({ page }) => {
    await page.goto('/editor/new');
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    const exportBtn = page.getByRole('button', { name: /export/i })
      .or(page.locator('[data-testid="export-button"]'))
      .or(page.locator('button:has-text("Export")'));
    await expect(exportBtn.first()).toBeVisible({ timeout: 10_000 });
    await exportBtn.first().click();

    // Export dialog/modal should appear
    const dialog = page.getByRole('dialog')
      .or(page.locator('[data-testid="export-dialog"]'))
      .or(page.locator('[class*="export"][class*="modal"]'))
      .or(page.locator('[class*="export"][class*="dialog"]'));
    await expect(dialog.first()).toBeVisible({ timeout: 5_000 });
  });

  test('export dialog shows format options', async ({ page }) => {
    await page.goto('/editor/new');
    await page.waitForLoadState('networkidle');

    const exportBtn = page.getByRole('button', { name: /export/i })
      .or(page.locator('button:has-text("Export")'));
    await exportBtn.first().click();

    // Should show various export formats
    await expect(page.getByText(/JSON/)).toBeVisible({ timeout: 5_000 });
    // At least one other format should be present
    const hasGif = await page.getByText(/GIF/i).isVisible().catch(() => false);
    const hasMp4 = await page.getByText(/MP4/i).isVisible().catch(() => false);
    const hasDotLottie = await page.getByText(/dotLottie/i).isVisible().catch(() => false);
    expect(hasGif || hasMp4 || hasDotLottie).toBeTruthy();
  });
});
