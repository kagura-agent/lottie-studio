import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Canvas preview", () => {
  test("renders Lottie animation after agent responds", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    // Wait for full editor hydration — chat input indicates React is ready
    const input = page.locator("textarea[placeholder*='Describe']");
    await expect(input).toBeVisible({ timeout: 15_000 });

    // Verify the placeholder is shown initially
    await expect(page.getByText("Describe your animation to begin")).toBeVisible();

    // Send a message — wait for hydration to stabilize before interacting
    const sendBtn = page.locator("button[aria-label='Send message']");

    // Keep filling until the button becomes enabled (hydration may reset input)
    await expect(async () => {
      await input.fill("Make a blue circle");
      await expect(sendBtn).toBeEnabled({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });

    await sendBtn.click();

    // After the agent responds with Lottie JSON, the placeholder should disappear
    await expect(page.getByText("Describe your animation to begin")).toBeHidden({ timeout: 15_000 });
  });
});
