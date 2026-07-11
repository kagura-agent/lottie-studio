import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Canvas preview", () => {
  test("renders Lottie animation after agent responds", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    // Send a message to trigger animation generation
    const input = page.locator(
      "[data-testid='chat-input'], textarea, input[type='text']"
    ).first();
    await input.fill("Make a blue circle");

    const sendButton = page.locator(
      "button[type='submit'], [data-testid='send-button'], button[aria-label*='end']"
    );
    if (await sendButton.first().isVisible().catch(() => false)) {
      await sendButton.first().click();
    } else {
      await input.press("Enter");
    }

    // Wait for lottie-web to render — it creates an SVG or canvas element inside the player
    const lottieContainer = page.locator(
      "[data-testid='lottie-canvas'] svg, [data-testid='canvas'] svg, canvas, .lottie-player svg"
    );
    await expect(lottieContainer.first()).toBeVisible({ timeout: 15_000 });
  });
});
