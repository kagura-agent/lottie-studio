import { test, expect } from "@playwright/test";
import { mockGalleryAPI } from "./mock-llm";

test.describe("Gallery page", () => {
  test.beforeEach(async ({ page }) => {
    await mockGalleryAPI(page);
  });

  test("loads and displays animations", async ({ page }) => {
    await page.goto("/");

    // Wait for hydration — the h1 appears once data loads
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Animations");

    // The mocked animations should appear
    await expect(page.getByText("Bouncing Ball").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Spinning Star").first()).toBeVisible();
  });

  test("has a create new animation link", async ({ page }) => {
    await page.goto("/");

    // Wait for hydration
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });

    const link = page.getByRole("link", { name: /create animation/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/editor/new");
  });
});
