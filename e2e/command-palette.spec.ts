import { test, expect } from "@playwright/test";

test.describe("Command palette", () => {
  test("Ctrl+K opens command palette", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    // Wait for full hydration — the chat input means React is ready
    const input = page.locator("textarea[placeholder*='Describe']");
    await expect(input).toBeVisible({ timeout: 15_000 });

    // Click somewhere to ensure focus is in the page
    const canvas = page.getByRole("region", { name: /animation preview/i });
    await canvas.click();
    await page.waitForTimeout(300);

    // Use keyboard shortcut
    await page.keyboard.press("Control+k");

    // Command palette renders when open
    const palette = page.getByRole("dialog", { name: "Command Palette" });
    await expect(palette).toBeVisible({ timeout: 5_000 });
  });

  test("command palette has search input", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    // Wait for full hydration
    const input = page.locator("textarea[placeholder*='Describe']");
    await expect(input).toBeVisible({ timeout: 15_000 });

    const canvas = page.getByRole("region", { name: /animation preview/i });
    await canvas.click();
    await page.waitForTimeout(300);

    await page.keyboard.press("Control+k");

    const palette = page.getByRole("dialog", { name: "Command Palette" });
    await expect(palette).toBeVisible({ timeout: 5_000 });

    // Should have a search/filter input
    await expect(palette.locator("input").first()).toBeVisible();
  });
});
