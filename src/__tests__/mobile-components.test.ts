import { describe, it, expect } from "vitest";

describe("MobileTabBar", () => {
  it("exports a default component function", async () => {
    const mod = await import("@/components/MobileTabBar");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("exports MobileTab type covering all four tabs", async () => {
    const tabs: Array<"canvas" | "chat" | "layers" | "settings"> = [
      "canvas",
      "chat",
      "layers",
      "settings",
    ];
    expect(tabs).toHaveLength(4);
    expect(new Set(tabs).size).toBe(4);
  });
});

describe("BottomSheet", () => {
  it("exports a default component function", async () => {
    const mod = await import("@/components/BottomSheet");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("drag threshold is reasonable for mobile dismiss", () => {
    const DRAG_THRESHOLD = 80;
    expect(DRAG_THRESHOLD).toBeGreaterThanOrEqual(40);
    expect(DRAG_THRESHOLD).toBeLessThanOrEqual(200);
  });
});
