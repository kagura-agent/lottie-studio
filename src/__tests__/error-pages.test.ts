import { describe, it, expect } from "vitest";

describe("error pages", () => {
  it("not-found page exports a default component", async () => {
    const mod = await import("@/app/not-found");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("error page exports a default component", async () => {
    const mod = await import("@/app/error");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("global-error page exports a default component", async () => {
    const mod = await import("@/app/global-error");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
