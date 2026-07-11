import { test, expect } from "@playwright/test";

test.describe("Command palette", () => {
  test("Cmd+K opens command palette", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    // Trigger command palette with keyboard shortcut
    await page.keyboard.press("Meta+k");

    const palette = page.locator(
      "[data-testid='command-palette'], [role='dialog']:has(input), [class*='command-palette'], [class*='cmdk']"
    );
    await expect(palette.first()).toBeVisible({ timeout: 5_000 });
  });

  test("Ctrl+K opens command palette on non-Mac", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    await page.keyboard.press("Control+k");

    const palette = page.locator(
      "[data-testid='command-palette'], [role='dialog']:has(input), [class*='command-palette'], [class*='cmdk']"
    );
    await expect(palette.first()).toBeVisible({ timeout: 5_000 });
  });
});
