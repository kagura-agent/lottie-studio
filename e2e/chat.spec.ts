import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Chat interaction", () => {
  test("send a message and see a response", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    const input = page.locator(
      "[data-testid='chat-input'], textarea, input[type='text']"
    ).first();
    await input.fill("Create a bouncing ball animation");

    // Submit via Enter or send button
    const sendButton = page.locator(
      "button[type='submit'], [data-testid='send-button'], button[aria-label*='end']"
    );
    if (await sendButton.first().isVisible().catch(() => false)) {
      await sendButton.first().click();
    } else {
      await input.press("Enter");
    }

    // Response should appear in chat
    await expect(
      page.getByText(/bouncing circle|animation/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
