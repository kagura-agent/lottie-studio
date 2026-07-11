import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Export flow", () => {
  test("export button opens export menu", async ({ page }) => {
    await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");

    const exportBtn = page.getByRole("button", { name: /export animation/i });
    await expect(exportBtn).toBeVisible({ timeout: 10_000 });
    await exportBtn.click();

    // Should open a dropdown menu with export options
    await expect(
      page.getByText(/export json|export gif|export\.lottie/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
