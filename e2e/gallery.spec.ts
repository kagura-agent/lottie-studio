import { test, expect } from "@playwright/test";
import { mockGalleryAPI } from "./mock-llm";

test.describe("Gallery page", () => {
  test.beforeEach(async ({ page }) => {
    await mockGalleryAPI(page);
  });

  test("loads and displays animations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Bouncing Ball")).toBeVisible();
    await expect(page.getByText("Spinning Star")).toBeVisible();
  });

  test("has a create new animation link", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /new|create/i });
    await expect(link).toBeVisible();
  });
});
