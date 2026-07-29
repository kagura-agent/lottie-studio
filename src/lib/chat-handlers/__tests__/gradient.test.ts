import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../helpers", () => ({
  sendDoneEvent: vi.fn((data: unknown) => new Response(JSON.stringify(data))),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(() => true),
  readAnimationFile: vi.fn(() => ({ layers: [{ nm: "Shape", ty: 4, shapes: [] }], op: 90 })),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

import { handleGradient } from "../gradient";
import * as helpers from "../helpers";

describe("handleGradient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new animation when no animationId", async () => {
    const res = await handleGradient(undefined, { preset: "sunset" }, "/gradient sunset");
    const body = await res.json();
    expect(body.reply).toContain("Created a new");
    expect(body.reply).toContain("sunset");
    expect(body.lottieJson).toBeDefined();
  });

  it("returns 404 when animation not found", async () => {
    vi.mocked(helpers.animationExists).mockReturnValueOnce(false);
    const res = await handleGradient("abc", {}, "/gradient");
    expect(res.status).toBe(404);
  });

  it("returns message when no animation file found", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce(null);
    const res = await handleGradient("abc", {}, "/gradient");
    const body = await res.json();
    expect(body.reply).toContain("No animation file found");
  });

  it("applies gradient and returns success", async () => {
    const res = await handleGradient("abc", { preset: "rainbow" }, "/gradient rainbow");
    const body = await res.json();
    expect(body.reply).toContain("gradient fill");
    expect(body.reply).toContain("Shape");
    expect(helpers.writeAnimationFile).toHaveBeenCalled();
    expect(helpers.emitUpdated).toHaveBeenCalledWith("abc");
  });

  it("returns message when no shape layers found", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce({ layers: [{ nm: "Solid", ty: 1 }], op: 90 });
    const res = await handleGradient("abc", {}, "/gradient");
    const body = await res.json();
    expect(body.reply).toContain("No shape layers found");
  });

  it("handles layer filter with no match", async () => {
    const res = await handleGradient("abc", { layer: "NonExistent" }, "/gradient --layer NonExistent");
    const body = await res.json();
    expect(body.reply).toContain("No shape layers found");
  });

  it("creates radial gradient for new animation", async () => {
    const res = await handleGradient(undefined, { type: "radial" }, "/gradient radial");
    const body = await res.json();
    expect(body.reply).toContain("radial gradient");
  });

  it("applies stroke mode gradient", async () => {
    const res = await handleGradient("abc", { mode: "stroke" }, "/gradient --mode stroke");
    const body = await res.json();
    expect(body.reply).toContain("gradient stroke");
  });
});
