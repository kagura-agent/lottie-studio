import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../helpers", () => ({
  sendDoneEvent: vi.fn((data: unknown) => new Response(JSON.stringify(data))),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(() => true),
  readAnimationFile: vi.fn(() => ({
    w: 512,
    h: 512,
    fr: 30,
    ip: 0,
    op: 60,
    layers: [{ nm: "Shape", ip: 0, op: 60 }],
  })),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

import { handleMask } from "../mask";
import * as helpers from "../helpers";

describe("handleMask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleMask(undefined, {}, "/mask reveal");
    const body = await res.json();
    expect(body.reply).toContain("Create an animation first");
  });

  it("returns 404 when animation not found", async () => {
    vi.mocked(helpers.animationExists).mockReturnValueOnce(false);
    const res = await handleMask("abc", {}, "/mask reveal");
    expect(res.status).toBe(404);
  });

  it("returns message when no animation file", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce(null);
    const res = await handleMask("abc", {}, "/mask reveal");
    const body = await res.json();
    expect(body.reply).toContain("No animation file found");
  });

  it("applies reveal mask and returns success", async () => {
    const res = await handleMask("abc", { type: "reveal" }, "/mask reveal");
    const body = await res.json();
    expect(body.reply).toContain("reveal mask");
    expect(body.reply).toContain("1 layer");
    expect(helpers.writeAnimationFile).toHaveBeenCalled();
    expect(helpers.emitUpdated).toHaveBeenCalledWith("abc");
  });

  it("applies circle mask type", async () => {
    const res = await handleMask("abc", { type: "circle" }, "/mask circle");
    const body = await res.json();
    expect(body.reply).toContain("circle mask");
    expect(helpers.writeAnimationFile).toHaveBeenCalled();
  });

  it("applies wipe-right mask type", async () => {
    const res = await handleMask("abc", { type: "wipe-right" }, "/mask wipe-right");
    const body = await res.json();
    expect(body.reply).toContain("wipe-right mask");
  });

  it("applies wipe-left mask type", async () => {
    const res = await handleMask("abc", { type: "wipe-left" }, "/mask wipe-left");
    const body = await res.json();
    expect(body.reply).toContain("wipe-left mask");
  });

  it("applies wipe-down mask type", async () => {
    const res = await handleMask("abc", { type: "wipe-down" }, "/mask wipe-down");
    const body = await res.json();
    expect(body.reply).toContain("wipe-down mask");
  });

  it("applies wipe-up mask type", async () => {
    const res = await handleMask("abc", { type: "wipe-up" }, "/mask wipe-up");
    const body = await res.json();
    expect(body.reply).toContain("wipe-up mask");
  });

  it("applies circle-out mask type", async () => {
    const res = await handleMask("abc", { type: "circle-out" }, "/mask circle-out");
    const body = await res.json();
    expect(body.reply).toContain("circle-out mask");
  });

  it("applies iris mask type", async () => {
    const res = await handleMask("abc", { type: "iris" }, "/mask iris");
    const body = await res.json();
    expect(body.reply).toContain("iris mask");
  });

  it("applies star mask type", async () => {
    const res = await handleMask("abc", { type: "star" }, "/mask star");
    const body = await res.json();
    expect(body.reply).toContain("star mask");
  });

  it("applies invert mask type", async () => {
    const res = await handleMask("abc", { type: "invert" }, "/mask invert");
    const body = await res.json();
    expect(body.reply).toContain("invert mask");
  });

  it("returns message when no layers match target", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce({
      w: 512, h: 512, fr: 30, ip: 0, op: 60,
      layers: [{ nm: "Background", ip: 0, op: 60 }],
    });
    const res = await handleMask("abc", { type: "reveal", layer: "NonExistent" }, "/mask reveal --layer NonExistent");
    const body = await res.json();
    expect(body.reply).toContain("No layers found");
  });

  it("targets specific layer with --layer option", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce({
      w: 512, h: 512, fr: 30, ip: 0, op: 60,
      layers: [
        { nm: "Shape A", ip: 0, op: 60 },
        { nm: "Shape B", ip: 0, op: 60 },
      ],
    });
    const res = await handleMask("abc", { type: "circle", layer: "Shape A" }, "/mask circle --layer \"Shape A\"");
    const body = await res.json();
    expect(body.reply).toContain("circle mask");
    expect(body.reply).toContain("1 layer");
    expect(body.reply).toContain("Shape A");
  });

  it("applies mask to multiple layers", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce({
      w: 512, h: 512, fr: 30, ip: 0, op: 60,
      layers: [
        { nm: "A", ip: 0, op: 60 },
        { nm: "B", ip: 0, op: 60 },
        { nm: "C", ip: 0, op: 60 },
        { nm: "D", ip: 0, op: 60 },
      ],
    });
    const res = await handleMask("abc", { type: "wipe-right" }, "/mask wipe-right");
    const body = await res.json();
    expect(body.reply).toContain("4 layers");
  });

  it("respects duration option", async () => {
    const res = await handleMask("abc", { type: "reveal", duration: 2 }, "/mask reveal --duration 2");
    const body = await res.json();
    expect(body.reply).toContain("reveal mask");
    expect(helpers.writeAnimationFile).toHaveBeenCalled();
    // Verify the written animation has correct mask timing
    const writtenAnim = vi.mocked(helpers.writeAnimationFile).mock.calls[0][1] as { layers: Array<{ masksProperties?: Array<{ pt: { k: Array<{ t: number }> } }> }> };
    const maskPt = writtenAnim.layers[0].masksProperties![0].pt.k as Array<{ t: number }>;
    expect(maskPt[0].t).toBe(0); // startFrame
    expect(maskPt[1].t).toBe(60); // 2s * 30fps = 60 frames
  });

  it("respects from/to frame options", async () => {
    const res = await handleMask("abc", { type: "reveal", from: 10, to: 40 }, "/mask reveal --from 10 --to 40");
    const body = await res.json();
    expect(body.reply).toContain("reveal mask");
    const writtenAnim = vi.mocked(helpers.writeAnimationFile).mock.calls[0][1] as { layers: Array<{ masksProperties?: Array<{ pt: { k: Array<{ t: number }> } }> }> };
    const maskPt = writtenAnim.layers[0].masksProperties![0].pt.k as Array<{ t: number }>;
    expect(maskPt[0].t).toBe(10);
    expect(maskPt[1].t).toBe(40);
  });

  it("respects expand option", async () => {
    const res = await handleMask("abc", { type: "circle", expand: 5 }, "/mask circle --expand 5");
    const body = await res.json();
    expect(body.reply).toContain("circle mask");
    const writtenAnim = vi.mocked(helpers.writeAnimationFile).mock.calls[0][1] as { layers: Array<{ masksProperties?: Array<{ x: { k: number } }> }> };
    expect(writtenAnim.layers[0].masksProperties![0].x.k).toBe(5);
  });

  it("respects invert option", async () => {
    const res = await handleMask("abc", { type: "reveal", invert: true }, "/mask reveal --invert");
    const body = await res.json();
    expect(body.reply).toContain("reveal mask");
    const writtenAnim = vi.mocked(helpers.writeAnimationFile).mock.calls[0][1] as { layers: Array<{ masksProperties?: Array<{ inv: boolean }> }> };
    expect(writtenAnim.layers[0].masksProperties![0].inv).toBe(true);
  });

  it("defaults type to reveal when not specified", async () => {
    const res = await handleMask("abc", {}, "/mask reveal");
    const body = await res.json();
    expect(body.reply).toContain("reveal mask");
  });

  it("saves version and messages", async () => {
    await handleMask("abc", { type: "star" }, "/mask star");
    expect(helpers.saveVersion).toHaveBeenCalledWith("abc", expect.any(String), "/mask star");
    expect(helpers.saveUserMessage).toHaveBeenCalledWith("abc", "/mask star");
    expect(helpers.saveAssistantMessage).toHaveBeenCalledWith(
      "abc",
      expect.stringContaining("star mask"),
      expect.any(String),
      expect.any(String)
    );
  });

  it("returns lottieJson and previousLottieJson in response", async () => {
    const res = await handleMask("abc", { type: "reveal" }, "/mask reveal");
    const body = await res.json();
    expect(body.lottieJson).toBeDefined();
    expect(body.previousLottieJson).toBeDefined();
    expect(body.animationId).toBe("abc");
  });

  it("handles animation with no layers array gracefully", async () => {
    vi.mocked(helpers.readAnimationFile).mockReturnValueOnce({
      w: 512, h: 512, fr: 30, ip: 0, op: 60,
      layers: [],
    });
    const res = await handleMask("abc", { type: "reveal" }, "/mask reveal");
    const body = await res.json();
    expect(body.reply).toContain("No layers found");
  });
});
