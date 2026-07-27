import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCommand } from "@/lib/commands";

// ─── Command Parser Tests ───────────────────────────────────────────────────

describe("/loop command parsing", () => {
  it("defaults to seamless mode with no args", () => {
    expect(parseCommand("/loop")).toEqual({ type: "loop", mode: "seamless" });
  });

  it("parses /loop seamless", () => {
    expect(parseCommand("/loop seamless")).toEqual({ type: "loop", mode: "seamless" });
  });

  it("parses /loop pingpong", () => {
    expect(parseCommand("/loop pingpong")).toEqual({ type: "loop", mode: "pingpong" });
  });

  it("parses /loop freeze", () => {
    expect(parseCommand("/loop freeze")).toEqual({ type: "loop", mode: "freeze" });
  });

  it("returns error for invalid mode", () => {
    const result = parseCommand("/loop invalid");
    expect(result).toEqual({ type: "error", message: "Usage: /loop [seamless|pingpong|freeze]" });
  });
});

// ─── Handler Tests ──────────────────────────────────────────────────────────

vi.mock("@/lib/chat-handlers/helpers", () => ({
  sendDoneEvent: vi.fn((payload: unknown) => Response.json(payload)),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(() => true),
  readAnimationFile: vi.fn(),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

import { handleLoop } from "@/lib/chat-handlers/loop";
import {
  animationExists,
  readAnimationFile,
  writeAnimationFile,
  sendDoneEvent,
} from "@/lib/chat-handlers/helpers";

const mockedAnimationExists = vi.mocked(animationExists);
const mockedReadAnimationFile = vi.mocked(readAnimationFile);
const mockedWriteAnimationFile = vi.mocked(writeAnimationFile);

function makeLottie(keyframes: Array<{ t: number; s: number[]; e?: number[] }>) {
  return {
    fr: 30,
    ip: 0,
    op: 60,
    layers: [
      {
        nm: "Layer 1",
        ks: {
          p: {
            a: 1,
            k: keyframes.map((kf, i) => ({
              ...kf,
              ...(i < keyframes.length - 1
                ? { i: { x: [0.5], y: [0.5] }, o: { x: [0.5], y: [0.5] } }
                : {}),
            })),
          },
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAnimationExists.mockReturnValue(true);
});

describe("handleLoop", () => {
  it("returns error when no animation exists", async () => {
    await handleLoop(undefined, "seamless", "/loop");
    expect(sendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reply: expect.stringContaining("Create an animation first") })
    );
  });

  it("returns 404 when animation not found", async () => {
    mockedAnimationExists.mockReturnValue(false);
    const res = await handleLoop("test-id", "seamless", "/loop");
    expect(res.status).toBe(404);
  });

  it("seamless mode sets last keyframe start to first keyframe start", async () => {
    const lottie = makeLottie([
      { t: 0, s: [100, 200] },
      { t: 30, s: [200, 300] },
      { t: 60, s: [300, 400] },
    ]);
    mockedReadAnimationFile.mockReturnValue(lottie);

    await handleLoop("test-id", "seamless", "/loop seamless");

    const written = mockedWriteAnimationFile.mock.calls[0][1] as typeof lottie;
    const kf = (written.layers[0].ks!.p as { k: Array<{ s: number[] }> }).k;
    expect(kf[kf.length - 1].s).toEqual([100, 200]);
  });

  it("pingpong mode doubles op and reverses keyframes", async () => {
    const lottie = makeLottie([
      { t: 0, s: [0, 0] },
      { t: 30, s: [100, 100] },
      { t: 60, s: [200, 200] },
    ]);
    mockedReadAnimationFile.mockReturnValue(lottie);

    await handleLoop("test-id", "pingpong", "/loop pingpong");

    const written = mockedWriteAnimationFile.mock.calls[0][1] as typeof lottie;
    expect(written.op).toBe(120);
    const kf = (written.layers[0].ks!.p as { k: Array<{ t: number; s: number[] }> }).k;
    expect(kf.length).toBe(5); // 3 original + 2 reversed
  });

  it("freeze mode does not modify animation file", async () => {
    const lottie = makeLottie([
      { t: 0, s: [0, 0] },
      { t: 60, s: [100, 100] },
    ]);
    mockedReadAnimationFile.mockReturnValue(lottie);

    await handleLoop("test-id", "freeze", "/loop freeze");

    expect(mockedWriteAnimationFile).not.toHaveBeenCalled();
  });

  it("returns message when no animated properties found (seamless)", async () => {
    mockedReadAnimationFile.mockReturnValue({
      fr: 30, ip: 0, op: 60, layers: [{ nm: "Static", ks: { p: { a: 0, k: [100, 200] } } }],
    });

    await handleLoop("test-id", "seamless", "/loop");

    expect(sendDoneEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reply: expect.stringContaining("No animated properties") })
    );
  });
});
