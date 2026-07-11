import { test, expect } from "@playwright/test";
import { mockLLMRoute, mockGalleryAPI } from "./mock-llm";

test.describe("Mobile responsive layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("editor shows stacked layout on mobile", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    const canvas = page.getByRole("region", { name: /animation preview/i });
    const chat = page.getByRole("log", { name: /chat messages/i });

    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await expect(chat).toBeVisible();
  });

  test("gallery loads on mobile", async ({ page }) => {
    await mockGalleryAPI(page);
    await page.goto("/");

    // On mobile, the gallery should still render with animations
    await expect(
      page.getByText("Bouncing Ball").first()
    ).toBeVisible({ timeout: 20_000 });
  });
});
