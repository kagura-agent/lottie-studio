import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Chat interaction", () => {
  test("updates the same preview across two fallback chat turns", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    const input = page.locator("textarea[placeholder*='Describe']");
    const preview = page.getByRole("region", { name: "Animation preview" });
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("Create a bouncing ball animation");
    await input.press("Enter");
    await expect(page.getByText("Here's a bouncing circle animation for you!")).toBeVisible({ timeout: 15_000 });

    const previewSvg = preview.locator("svg");
    await expect(previewSvg).toBeVisible();
    const firstPreviewMarkup = await previewSvg.evaluate((svg) => svg.outerHTML);

    await input.fill("Change it to a red square");
    await input.press("Enter");
    await expect(page.getByText("I changed it to a red square.")).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () => previewSvg.evaluate((svg) => svg.outerHTML)).not.toBe(firstPreviewMarkup);
  });
});
