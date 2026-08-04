import { test, expect } from "@playwright/test";
import { mockLLMRoute } from "./mock-llm";

test.describe("Chat interaction", () => {
  test("renders fallback replies and updates the preview in one editor session", async ({ page }) => {
    const { requests } = await mockLLMRoute(page);
    await page.goto("/editor/new?skip=true");
    await page.waitForLoadState("networkidle");

    const composer = page.getByRole("textbox", { name: "Chat message" });
    const send = page.getByRole("button", { name: "Send message" });
    const chat = page.getByRole("log", { name: "Chat messages" });
    const preview = page.getByRole("region", { name: "Animation preview" });

    await expect(composer).toBeVisible({ timeout: 10_000 });

    await composer.fill("Create a bouncing ball animation");
    await send.click();
    await expect(chat.getByText("Here's a bouncing circle animation for you!")).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByRole("img", { name: "Blue Circle animation preview" })).toBeVisible();

    await composer.fill("Change it to a red square");
    await send.click();
    await expect(chat.getByText("I changed it to a red square.")).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByRole("img", { name: "Red Square animation preview" })).toBeVisible();

    expect(requests).toEqual([
      { message: "Create a bouncing ball animation" },
      { animationId: "test-animation-id", message: "Change it to a red square" },
    ]);
  });
});
