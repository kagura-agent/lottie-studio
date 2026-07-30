import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

import { handleHelp } from "../help";

describe("handleHelp", () => {
  it("returns a Response", () => {
    const response = handleHelp();
    expect(response).toBeInstanceOf(Response);
  });

  it("returns SSE data with command descriptions", async () => {
    const response = handleHelp();
    const text = await response.text();
    expect(text).toContain("data: ");
    expect(text).toContain('"type":"done"');
    expect(text).toContain('"reply"');
  });

  it("mentions key commands like /fade, /particle, /3d, /repeat", async () => {
    const response = handleHelp();
    const text = await response.text();
    expect(text).toContain("/fade");
    expect(text).toContain("/particle");
    expect(text).toContain("/3d");
    expect(text).toContain("/repeat");
  });
});
