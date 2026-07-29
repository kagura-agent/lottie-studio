import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../helpers", () => ({
  sendDoneEvent: vi.fn((data: unknown) => new Response(JSON.stringify(data))),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(() => true),
  readAnimationFile: vi.fn(() => ({ layers: [{ nm: "Shape" }] })),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

import { handleShadow } from "../shadow";
import * as helpers from "../helpers";

describe("handleShadow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleShadow(undefined, {}, "/shadow");
    const body = await res.json();
    expect(body.reply).toContain("Create an animation first");
  });

  it("returns 404 when animation not found", async () => {
    vi.mocked(helpers.animationExists).mockReturnValueOnce(false);
    const res = await handleShadow("abc", {}, "/shadow");
    expect(res.status).toBe(404);
  });

  it("applies shadow and returns success", async () => {
    const res = await handleShadow("abc", { type: "glow" }, "/shadow glow");
    const body = await res.json();
    expect(body.reply).toContain("glow shadow");
    expect(helpers.writeAnimationFile).toHaveBeenCalled();
    expect(helpers.emitUpdated).toHaveBeenCalledWith("abc");
  });

  it("returns message when no layers match", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce({ layers: [{ nm: "A" }] });
    const res = await handleShadow("abc", { layer: "NonExistent" }, "/shadow --layer NonExistent");
    const body = await res.json();
    expect(body.reply).toContain("No layers found");
  });
});
