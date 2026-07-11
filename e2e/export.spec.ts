import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Export flow", () => {
  test("export button opens export dialog", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    // Find the export button
    const exportBtn = page.locator(
      "button:has-text('Export'), button:has-text('export'), [data-testid='export-button'], [aria-label*='xport']"
    );
    await expect(exportBtn.first()).toBeVisible();
    await exportBtn.first().click();

    // Export dialog/modal should appear
    const dialog = page.locator(
      "[role='dialog'], [data-testid='export-dialog'], [class*='modal']"
    );
    await expect(dialog.first()).toBeVisible();
  });
});
