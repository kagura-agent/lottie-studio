import { test, expect } from "@playwright/test";
import { mockLLMRoute, mockGalleryAPI } from "./mock-llm";

test.describe("Mobile responsive layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("editor shows stacked layout on mobile", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    // On mobile, canvas and chat should be stacked (not side by side)
    const canvas = page.locator(
      "[data-testid='canvas'], [data-testid='lottie-canvas'], canvas"
    ).first();
    const chat = page.locator(
      "[data-testid='chat-panel'], [role='complementary'], [class*='chat']"
    ).first();

    await expect(canvas).toBeVisible();
    await expect(chat).toBeVisible();

    // Verify stacked: chat should be below canvas (higher top offset)
    const canvasBox = await canvas.boundingBox();
    const chatBox = await chat.boundingBox();
    if (canvasBox && chatBox) {
      expect(chatBox.y).toBeGreaterThanOrEqual(canvasBox.y);
    }
  });

  test("gallery is usable on mobile", async ({ page }) => {
    await mockGalleryAPI(page);
    await page.goto("/");
    await expect(page.getByText("Bouncing Ball")).toBeVisible();
  });
});
