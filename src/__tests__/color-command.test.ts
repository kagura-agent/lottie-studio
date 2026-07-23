import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCommand } from "@/lib/commands";

// Mock the helpers module
vi.mock("@/lib/chat-handlers/helpers", () => ({
  sendDoneEvent: vi.fn((data) => {
    return new Response(JSON.stringify(data), { status: 200 });
  }),
  saveVersion: vi.fn(() => 1),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(() => true),
  readAnimationFile: vi.fn(),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

import { handleColor } from "@/lib/chat-handlers/color";
import {
  sendDoneEvent,
  readAnimationFile,
  writeAnimationFile,
  animationExists,
} from "@/lib/chat-handlers/helpers";

const mockedReadAnimationFile = vi.mocked(readAnimationFile);
const mockedWriteAnimationFile = vi.mocked(writeAnimationFile);
const mockedAnimationExists = vi.mocked(animationExists);
const mockedSendDoneEvent = vi.mocked(sendDoneEvent);

describe("parseCommand /color", () => {
  it("parses /color palette", () => {
    expect(parseCommand("/color palette")).toEqual({
      type: "color",
      subcommand: { action: "palette" },
    });
  });

  it("parses /color shift 45", () => {
    expect(parseCommand("/color shift 45")).toEqual({
      type: "color",
      subcommand: { action: "shift", degrees: 45 },
    });
  });

  it("parses /color shift -90", () => {
    expect(parseCommand("/color shift -90")).toEqual({
      type: "color",
      subcommand: { action: "shift", degrees: -90 },
    });
  });

  it("parses /color warm", () => {
    expect(parseCommand("/color warm")).toEqual({
      type: "color",
      subcommand: { action: "warm" },
    });
  });

  it("parses /color cool", () => {
    expect(parseCommand("/color cool")).toEqual({
      type: "color",
      subcommand: { action: "cool" },
    });
  });

  it("parses /color mono", () => {
    expect(parseCommand("/color mono")).toEqual({
      type: "color",
      subcommand: { action: "mono" },
    });
  });

  it("parses /color monochrome", () => {
    expect(parseCommand("/color monochrome")).toEqual({
      type: "color",
      subcommand: { action: "mono" },
    });
  });

  it("parses /color grayscale", () => {
    expect(parseCommand("/color grayscale")).toEqual({
      type: "color",
      subcommand: { action: "mono" },
    });
  });

  it("parses /color invert", () => {
    expect(parseCommand("/color invert")).toEqual({
      type: "color",
      subcommand: { action: "invert" },
    });
  });

  it("parses /color swap #ff0000 #00ff00", () => {
    expect(parseCommand("/color swap #ff0000 #00ff00")).toEqual({
      type: "color",
      subcommand: { action: "swap", from: "#ff0000", to: "#00ff00" },
    });
  });

  it("parses /color saturate +20", () => {
    expect(parseCommand("/color saturate +20")).toEqual({
      type: "color",
      subcommand: { action: "saturate", amount: 0.2 },
    });
  });

  it("parses /color saturate -30%", () => {
    expect(parseCommand("/color saturate -30%")).toEqual({
      type: "color",
      subcommand: { action: "saturate", amount: -0.3 },
    });
  });

  it("parses /color brighten +20", () => {
    expect(parseCommand("/color brighten +20")).toEqual({
      type: "color",
      subcommand: { action: "brighten", amount: 0.2 },
    });
  });

  it("parses /color brighten -30%", () => {
    expect(parseCommand("/color brighten -30%")).toEqual({
      type: "color",
      subcommand: { action: "brighten", amount: -0.3 },
    });
  });

  it("errors on missing subcommand", () => {
    const result = parseCommand("/color");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on unknown subcommand", () => {
    const result = parseCommand("/color foobar");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on /color shift without degrees", () => {
    const result = parseCommand("/color shift");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on /color shift with invalid value", () => {
    const result = parseCommand("/color shift abc");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on /color swap with missing args", () => {
    expect(parseCommand("/color swap #ff0000")).toEqual(expect.objectContaining({ type: "error" }));
    expect(parseCommand("/color swap")).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on /color saturate without amount", () => {
    const result = parseCommand("/color saturate");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("errors on /color brighten without amount", () => {
    const result = parseCommand("/color brighten");
    expect(result).toEqual(expect.objectContaining({ type: "error" }));
  });
});

describe("handleColor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAnimationExists.mockReturnValue(true);
  });

  const makeLottie = (layers: unknown[]) => ({
    w: 512,
    h: 512,
    fr: 30,
    ip: 0,
    op: 60,
    layers,
  });

  const makeShapeLayer = (shapes: unknown[], nm = "Shape Layer") => ({
    ty: 4,
    nm,
    ks: { p: { a: 0, k: [0, 0, 0] } },
    shapes,
  });

  it("returns error when no animationId", async () => {
    await handleColor(undefined, { action: "palette" }, "/color palette");
    expect(mockedSendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reply: expect.stringContaining("Create an animation") })
    );
  });

  it("returns 404 when animation not found", async () => {
    mockedAnimationExists.mockReturnValue(false);
    const response = await handleColor("test-id", { action: "palette" }, "/color palette");
    expect(response.status).toBe(404);
  });

  it("returns error when no animation file", async () => {
    mockedReadAnimationFile.mockReturnValue(null);
    await handleColor("test-id", { action: "palette" }, "/color palette");
    expect(mockedSendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reply: expect.stringContaining("No animation file") })
    );
  });

  describe("palette", () => {
    it("extracts unique colors from fills", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
          { ty: "fl", c: { a: 0, k: [0, 1, 0, 1] } },
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }, // duplicate
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "palette" }, "/color palette");
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: expect.stringMatching(/2 unique colors/),
        })
      );
    });

    it("extracts colors from strokes", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "st", c: { a: 0, k: [0, 0, 1, 1] } },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "palette" }, "/color palette");
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: expect.stringContaining("#0000ff"),
        })
      );
    });

    it("extracts colors from animated keyframes", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          {
            ty: "fl",
            c: {
              a: 1,
              k: [
                { t: 0, s: [1, 0, 0, 1], e: [0, 1, 0, 1] },
                { t: 30, s: [0, 1, 0, 1] },
              ],
            },
          },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "palette" }, "/color palette");
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: expect.stringMatching(/2 unique colors/),
        })
      );
    });

    it("reports no colors when animation has no fills/strokes", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "rc", s: { a: 0, k: [100, 100] } },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "palette" }, "/color palette");
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("No colors found") })
      );
    });

    it("handles nested groups", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          {
            ty: "gr",
            it: [
              { ty: "fl", c: { a: 0, k: [1, 1, 0, 1] } },
              { ty: "tr", p: { a: 0, k: [0, 0] } },
            ],
          },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "palette" }, "/color palette");
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: expect.stringContaining("#ffff00"),
        })
      );
    });
  });

  describe("invert", () => {
    it("inverts static fill colors", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "invert" }, "/color invert");

      expect(mockedWriteAnimationFile).toHaveBeenCalled();
      const written = mockedWriteAnimationFile.mock.calls[0][1] as Record<string, unknown>;
      const layers = written.layers as Record<string, unknown>[];
      const shapes = layers[0].shapes as Record<string, unknown>[];
      const fill = shapes[0] as { c: { k: number[] } };
      expect(fill.c.k[0]).toBeCloseTo(0);
      expect(fill.c.k[1]).toBeCloseTo(1);
      expect(fill.c.k[2]).toBeCloseTo(1);
      expect(fill.c.k[3]).toBe(1);
    });

    it("inverts animated keyframe colors", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          {
            ty: "fl",
            c: {
              a: 1,
              k: [
                { t: 0, s: [1, 0, 0, 1], e: [0, 1, 0, 1] },
                { t: 30, s: [0, 1, 0, 1] },
              ],
            },
          },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "invert" }, "/color invert");

      const written = mockedWriteAnimationFile.mock.calls[0][1] as Record<string, unknown>;
      const layers = written.layers as Record<string, unknown>[];
      const shapes = layers[0].shapes as Record<string, unknown>[];
      const fill = shapes[0] as { c: { k: Array<{ s?: number[]; e?: number[] }> } };
      expect(fill.c.k[0].s![0]).toBeCloseTo(0);
      expect(fill.c.k[0].s![1]).toBeCloseTo(1);
      expect(fill.c.k[0].s![2]).toBeCloseTo(1);
      expect(fill.c.k[0].e![0]).toBeCloseTo(1);
      expect(fill.c.k[0].e![1]).toBeCloseTo(0);
      expect(fill.c.k[0].e![2]).toBeCloseTo(1);
    });

    it("reports correct stats", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
          { ty: "st", c: { a: 0, k: [0, 1, 0, 1] } },
        ], "Layer A"),
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [0, 0, 1, 1] } },
        ], "Layer B"),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "invert" }, "/color invert");
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: expect.stringMatching(/3 color values.*2 layers/),
        })
      );
    });
  });

  describe("mono", () => {
    it("converts colors to grayscale", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "mono" }, "/color mono");

      const written = mockedWriteAnimationFile.mock.calls[0][1] as Record<string, unknown>;
      const layers = written.layers as Record<string, unknown>[];
      const shapes = layers[0].shapes as Record<string, unknown>[];
      const fill = shapes[0] as { c: { k: number[] } };
      // Red → gray (luminance ~0.2126)
      expect(fill.c.k[0]).toBeCloseTo(0.2126);
      expect(fill.c.k[1]).toBeCloseTo(0.2126);
      expect(fill.c.k[2]).toBeCloseTo(0.2126);
    });
  });

  describe("shift", () => {
    it("shifts hue by specified degrees", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }, // red
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "shift", degrees: 120 }, "/color shift 120");

      const written = mockedWriteAnimationFile.mock.calls[0][1] as Record<string, unknown>;
      const layers = written.layers as Record<string, unknown>[];
      const shapes = layers[0].shapes as Record<string, unknown>[];
      const fill = shapes[0] as { c: { k: number[] } };
      // Red shifted 120° → green
      expect(fill.c.k[0]).toBeCloseTo(0);
      expect(fill.c.k[1]).toBeCloseTo(1);
      expect(fill.c.k[2]).toBeCloseTo(0);
    });
  });

  describe("warm", () => {
    it("applies +15 degree hue shift", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [0, 0, 1, 1] } }, // blue
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "warm" }, "/color warm");

      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("+15°") })
      );
      expect(mockedWriteAnimationFile).toHaveBeenCalled();
    });
  });

  describe("cool", () => {
    it("applies -15 degree hue shift", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "cool" }, "/color cool");

      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("-15°") })
      );
    });
  });

  describe("swap", () => {
    it("swaps matching colors", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } }, // red - should be swapped
          { ty: "fl", c: { a: 0, k: [0, 1, 0, 1] } }, // green - should stay
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor(
        "test-id",
        { action: "swap", from: "#ff0000", to: "#0000ff" },
        "/color swap #ff0000 #0000ff"
      );

      const written = mockedWriteAnimationFile.mock.calls[0][1] as Record<string, unknown>;
      const layers = written.layers as Record<string, unknown>[];
      const shapes = layers[0].shapes as Record<string, unknown>[];
      const fill1 = shapes[0] as { c: { k: number[] } };
      const fill2 = shapes[1] as { c: { k: number[] } };
      // Red swapped to blue
      expect(fill1.c.k[0]).toBeCloseTo(0);
      expect(fill1.c.k[1]).toBeCloseTo(0);
      expect(fill1.c.k[2]).toBeCloseTo(1);
      // Green unchanged
      expect(fill2.c.k[0]).toBeCloseTo(0);
      expect(fill2.c.k[1]).toBeCloseTo(1);
      expect(fill2.c.k[2]).toBeCloseTo(0);
    });

    it("returns error for invalid from hex", async () => {
      const lottie = makeLottie([makeShapeLayer([])]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor(
        "test-id",
        { action: "swap", from: "xyz", to: "#00ff00" },
        "/color swap xyz #00ff00"
      );
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("Invalid source color") })
      );
    });

    it("returns error for invalid to hex", async () => {
      const lottie = makeLottie([makeShapeLayer([])]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor(
        "test-id",
        { action: "swap", from: "#ff0000", to: "xyz" },
        "/color swap #ff0000 xyz"
      );
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("Invalid target color") })
      );
    });

    it("reports no colors when none match", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [0, 1, 0, 1] } }, // green, not red
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor(
        "test-id",
        { action: "swap", from: "#ff0000", to: "#0000ff" },
        "/color swap #ff0000 #0000ff"
      );
      // swap transform returns original color for non-matches, so colorsModified counts them
      // Actually let me check - swap only modifies if colorsEqual matches
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("No colors found to transform") })
      );
    });
  });

  describe("saturate", () => {
    it("adjusts saturation", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [0.8, 0.2, 0.2, 1] } },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "saturate", amount: 0.2 }, "/color saturate +20");

      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("+20%") })
      );
      expect(mockedWriteAnimationFile).toHaveBeenCalled();
    });
  });

  describe("brighten", () => {
    it("adjusts brightness", async () => {
      const lottie = makeLottie([
        makeShapeLayer([
          { ty: "fl", c: { a: 0, k: [0.5, 0.2, 0.2, 1] } },
        ]),
      ]);
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "brighten", amount: 0.2 }, "/color brighten +20");

      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({ reply: expect.stringContaining("+20%") })
      );
      expect(mockedWriteAnimationFile).toHaveBeenCalled();
    });
  });

  describe("precomp layers", () => {
    it("walks into precomp assets", async () => {
      const lottie = {
        w: 512,
        h: 512,
        fr: 30,
        ip: 0,
        op: 60,
        assets: [
          {
            id: "comp_1",
            layers: [
              makeShapeLayer([
                { ty: "fl", c: { a: 0, k: [1, 0, 0, 1] } },
              ], "Nested Layer"),
            ],
          },
        ],
        layers: [
          {
            ty: 0,
            nm: "Precomp",
            refId: "comp_1",
            ks: { p: { a: 0, k: [0, 0, 0] } },
          },
        ],
      };
      mockedReadAnimationFile.mockReturnValue(lottie);
      await handleColor("test-id", { action: "invert" }, "/color invert");

      expect(mockedWriteAnimationFile).toHaveBeenCalled();
      expect(mockedSendDoneEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: expect.stringMatching(/1 color value.*1 layer/),
        })
      );
    });
  });
});
