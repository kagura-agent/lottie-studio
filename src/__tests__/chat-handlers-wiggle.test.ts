import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/chat-handlers/helpers", () => ({
  sendDoneEvent: vi.fn((data: unknown) => Response.json(data)),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(() => true),
  readAnimationFile: vi.fn(),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

import { handleWiggle } from "@/lib/chat-handlers/wiggle";
import * as helpers from "@/lib/chat-handlers/helpers";

const mockedHelpers = vi.mocked(helpers);

function makeLottieAnimation(layers: unknown[] = []) {
  return {
    fr: 30,
    ip: 0,
    op: 90,
    layers: layers.length ? layers : [
      {
        nm: "Shape",
        ks: {
          p: { a: 0, k: [256, 256] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
        },
        ip: 0,
        op: 90,
      },
    ],
  };
}

describe("handleWiggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleWiggle(undefined, {}, "/wiggle");
    const data = await res.json();
    expect(data.reply).toContain("Create an animation first");
  });

  it("returns 404 when animation does not exist", async () => {
    mockedHelpers.animationExists.mockReturnValue(false);
    const res = await handleWiggle("id1", {}, "/wiggle");
    expect(res.status).toBe(404);
  });

  it("returns error when no animation file", async () => {
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(null);
    const res = await handleWiggle("id1", {}, "/wiggle");
    const data = await res.json();
    expect(data.reply).toContain("No animation file found");
  });

  it("applies wiggle to all properties by default", async () => {
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(makeLottieAnimation());
    const res = await handleWiggle("id1", {}, "/wiggle");
    const data = await res.json();
    expect(data.reply).toContain("4 properties");
    expect(mockedHelpers.writeAnimationFile).toHaveBeenCalled();
  });

  it("applies wiggle to single property when specified", async () => {
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(makeLottieAnimation());
    const res = await handleWiggle("id1", { property: "rotation" }, "/wiggle --property rotation");
    const data = await res.json();
    expect(data.reply).toContain("1 property");
    expect(data.reply).toContain("rotation");
  });

  it("filters by layer name", async () => {
    const anim = makeLottieAnimation([
      { nm: "A", ks: { p: { a: 0, k: [0, 0] } }, ip: 0, op: 90 },
      { nm: "B", ks: { p: { a: 0, k: [0, 0] } }, ip: 0, op: 90 },
    ]);
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(anim);
    const res = await handleWiggle("id1", { layer: "A", property: "position" }, "/wiggle --layer A --property position");
    const data = await res.json();
    expect(data.reply).toContain('"A"');
    expect(data.reply).not.toContain('"B"');
  });

  it("returns no-layers message when layer filter matches nothing", async () => {
    const anim = makeLottieAnimation([
      { nm: "A", ks: { p: { a: 0, k: [0, 0] } }, ip: 0, op: 90 },
    ]);
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(anim);
    const res = await handleWiggle("id1", { layer: "NonExistent" }, "/wiggle --layer NonExistent");
    const data = await res.json();
    expect(data.reply).toContain("No layers found");
  });

  it("saves version and emits update", async () => {
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(makeLottieAnimation());
    await handleWiggle("id1", {}, "/wiggle");
    expect(mockedHelpers.saveVersion).toHaveBeenCalled();
    expect(mockedHelpers.emitUpdated).toHaveBeenCalledWith("id1");
  });

  it("uses seed for reproducibility", async () => {
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(makeLottieAnimation());
    await handleWiggle("id1", { seed: 99, property: "position" }, "/wiggle");
    const call1 = mockedHelpers.writeAnimationFile.mock.calls[0][1];

    vi.clearAllMocks();
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(makeLottieAnimation());
    await handleWiggle("id1", { seed: 99, property: "position" }, "/wiggle");
    const call2 = mockedHelpers.writeAnimationFile.mock.calls[0][1];

    expect(call1).toEqual(call2);
  });

  it("skips layers without ks transform", async () => {
    const anim = makeLottieAnimation([{ nm: "NoKs", ip: 0, op: 90 }]);
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(anim);
    const res = await handleWiggle("id1", {}, "/wiggle");
    const data = await res.json();
    expect(data.reply).toContain("No layers found");
  });

  it("includes lottieJson in response", async () => {
    mockedHelpers.animationExists.mockReturnValue(true);
    mockedHelpers.readAnimationFile.mockReturnValue(makeLottieAnimation());
    const res = await handleWiggle("id1", {}, "/wiggle");
    const data = await res.json();
    expect(data.lottieJson).toBeDefined();
    expect(data.animationId).toBe("id1");
  });
});
