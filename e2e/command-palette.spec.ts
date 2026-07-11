import { test, expect } from '@playwright/test';

test.describe('Command Palette', () => {
  test('opens with Ctrl+K', async ({ page }) => {
    await page.goto('/editor/new');
    await page.waitForLoadState('networkidle');

    // Trigger command palette
    await page.keyboard.press('Control+k');

    // Command palette should appear
    const palette = page.locator('[data-testid="command-palette"]')
      .or(page.locator('[class*="command-palette"]'))
      .or(page.locator('[class*="commandPalette"]'))
      .or(page.getByRole('dialog').filter({ hasText: /command|search/i }));
    await expect(palette.first()).toBeVisible({ timeout: 5_000 });
  });

  test('typing filters commands', async ({ page }) => {
    await page.goto('/editor/new');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    // Type in the search input
    const searchInput = page.locator('[data-testid="command-palette"] input')
      .or(page.locator('[class*="command-palette"] input'))
      .or(page.locator('[class*="commandPalette"] input'))
      .or(page.getByRole('dialog').locator('input'));
    await searchInput.first().fill('export');

    // Should show filtered results containing "export"
    const results = page.locator('[data-testid="command-palette"] [class*="item"]')
      .or(page.locator('[class*="command-palette"] [class*="item"]'))
      .or(page.getByRole('dialog').locator('[class*="item"]'))
      .or(page.getByRole('dialog').getByRole('option'));
    // At least one result should be visible
    await expect(results.first()).toBeVisible({ timeout: 5_000 });
  });

  test('Escape closes palette', async ({ page }) => {
    await page.goto('/editor/new');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    const palette = page.locator('[data-testid="command-palette"]')
      .or(page.locator('[class*="command-palette"]'))
      .or(page.locator('[class*="commandPalette"]'))
      .or(page.getByRole('dialog').filter({ hasText: /command|search/i }));
    await expect(palette.first()).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(palette.first()).toBeHidden({ timeout: 5_000 });
  });
});
