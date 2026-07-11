import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Editor — new animation", () => {
  test.beforeEach(async ({ page }) => {
    await mockLLMRoute(page);
  });

  test("renders canvas and chat panel", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    // Canvas area should be present
    const canvas = page.locator("canvas, [data-testid='canvas'], [data-testid='lottie-canvas']");
    await expect(canvas.first()).toBeVisible();

    // Chat panel should be present
    const chatPanel = page.locator(
      "[data-testid='chat-panel'], [role='complementary'], [class*='chat']"
    );
    await expect(chatPanel.first()).toBeVisible();
  });

  test("chat input is visible and focusable", async ({ page }) => {
    await page.goto("/editor/new?skip=true");

    const input = page.locator(
      "[data-testid='chat-input'], textarea[placeholder*='escri'], textarea[placeholder*='hat'], input[placeholder*='escri']"
    );
    await expect(input.first()).toBeVisible();
    await input.first().focus();
    await expect(input.first()).toBeFocused();
  });
});
