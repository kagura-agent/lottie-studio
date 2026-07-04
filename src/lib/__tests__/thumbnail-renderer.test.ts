import { describe, it, expect } from "vitest";

describe("thumbnail-renderer", () => {
  it("exports renderLottieThumbnail function", async () => {
    const mod = await import("../thumbnail-renderer");
    expect(typeof mod.renderLottieThumbnail).toBe("function");
  });

  it("exports closeBrowser function", async () => {
    const mod = await import("../thumbnail-renderer");
    expect(typeof mod.closeBrowser).toBe("function");
  });
});
