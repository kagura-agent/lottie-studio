import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../helpers", () => ({
  sendDoneEvent: vi.fn((data: unknown) => Response.json(data)),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(() => true),
  readAnimationFile: vi.fn(() => ({
    v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
    layers: [{
      ty: 4, nm: "Shape", ind: 0, ip: 0, op: 60,
      ks: {
        p: { a: 0, k: [256, 256] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] },
      },
      shapes: [],
    }],
  })),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

import { handleThreeD } from "../threed";
import { sendDoneEvent, animationExists, readAnimationFile } from "../helpers";

describe("handleThreeD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if no animationId", async () => {
    await handleThreeD(undefined, { effect: "flip" }, "/3d flip");
    expect(sendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reply: expect.stringContaining("Create an animation first") })
    );
  });

  it("returns 404 if animation not found", async () => {
    (animationExists as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const res = await handleThreeD("test-id", { effect: "flip" }, "/3d flip");
    expect(res.status).toBe(404);
  });

  it("returns error if no layers", async () => {
    (readAnimationFile as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [],
    });
    await handleThreeD("test-id", { effect: "flip" }, "/3d flip");
    expect(sendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reply: expect.stringContaining("No layers found") })
    );
  });

  it("applies flip effect successfully", async () => {
    await handleThreeD("test-id", { effect: "flip" }, "/3d flip");
    expect(sendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: expect.stringContaining("3D flip"),
        animationId: "test-id",
        lottieJson: expect.objectContaining({ layers: expect.any(Array) }),
      })
    );
  });

  it("applies rotate effect with axis info in reply", async () => {
    await handleThreeD("test-id", { effect: "rotate", axis: "z" }, "/3d rotate --axis z");
    expect(sendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: expect.stringContaining("z-axis"),
      })
    );
  });

  it("returns null if no animation file", async () => {
    (readAnimationFile as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    await handleThreeD("test-id", { effect: "swing" }, "/3d swing");
    expect(sendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reply: expect.stringContaining("No animation file found") })
    );
  });
});
