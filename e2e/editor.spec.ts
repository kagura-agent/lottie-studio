import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Editor — new animation", () => {
  test.beforeEach(async ({ page }) => {
    await mockLLMRoute(page);
  });

  test("renders canvas and chat panel", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    // Wait for full hydration via chat input
    const input = page.locator("textarea[placeholder*='Describe']");
    await expect(input).toBeVisible({ timeout: 15_000 });

    const canvas = page.getByRole("region", { name: /animation preview/i });
    await expect(canvas).toBeVisible();

    const chatPanel = page.getByRole("log", { name: /chat messages/i });
    await expect(chatPanel).toBeVisible();
  });

  test("chat input is visible and focusable", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    const input = page.locator("textarea[placeholder*='Describe']");
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect(input).toBeFocused();
  });
});
