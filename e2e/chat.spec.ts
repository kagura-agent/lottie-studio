import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Chat interaction", () => {
  test("send a message and see a response", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    const input = page.locator("textarea[placeholder*='Describe']");
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Create a bouncing ball animation");
    await input.press("Enter");

    // Response should appear in chat
    await expect(
      page.getByText(/bouncing circle|animation/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
