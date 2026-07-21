import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
}));

const mockEncodeSSE = vi.fn((data: string) => new TextEncoder().encode(`data: ${data}\n\n`));
const mockCreateStreamingSSEResponse = vi.fn((stream: ReadableStream) => new Response(stream, {
  headers: { "Content-Type": "text/event-stream" },
}));
const mockAnimationExists = vi.fn();
const mockReadAnimationFile = vi.fn();
const mockWriteAnimationFile = vi.fn();
const mockSaveUserMessage = vi.fn();
const mockSaveAssistantMessage = vi.fn();
const mockSaveVersion = vi.fn();
const mockEmitUpdated = vi.fn();
const mockUpdateAnimationMetadata = vi.fn();
const mockSendDoneEvent = vi.fn((data: Record<string, unknown>) => {
  const body = JSON.stringify({ type: "done", ...data });
  return new Response(`data: ${body}\n\n`, {
    headers: { "Content-Type": "text/event-stream" },
  });
});

vi.mock("../helpers", () => ({
  encodeSSE: (...args: unknown[]) => mockEncodeSSE(...args),
  createStreamingSSEResponse: (...args: unknown[]) => mockCreateStreamingSSEResponse(...args),
  animationExists: (...args: unknown[]) => mockAnimationExists(...args),
  readAnimationFile: (...args: unknown[]) => mockReadAnimationFile(...args),
  writeAnimationFile: (...args: unknown[]) => mockWriteAnimationFile(...args),
  saveUserMessage: (...args: unknown[]) => mockSaveUserMessage(...args),
  saveAssistantMessage: (...args: unknown[]) => mockSaveAssistantMessage(...args),
  saveVersion: (...args: unknown[]) => mockSaveVersion(...args),
  emitUpdated: (...args: unknown[]) => mockEmitUpdated(...args),
  updateAnimationMetadata: (...args: unknown[]) => mockUpdateAnimationMetadata(...args),
  sendDoneEvent: (...args: unknown[]) => mockSendDoneEvent(...args),
}));

import { diagnoseAndFix, handleFix } from "../fix";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("diagnoseAndFix", () => {
  it("returns empty issues for animation with no layers", () => {
    const result = diagnoseAndFix({ w: 100, h: 100, ip: 0, op: 60, fr: 30 });
    expect(result).toEqual({ issues: [], fixed: false });
  });

  it("returns empty issues for clean animation", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{ nm: "Good", ip: 0, op: 60, ks: { p: { a: 0, k: [50, 50] } } }],
    });
    expect(result.issues).toHaveLength(0);
    expect(result.fixed).toBe(false);
  });

  it("detects and fixes zero-duration layers (ip >= op)", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{ nm: "Bad", ip: 30, op: 10 }],
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe("Zero-duration layer");
    expect(result.issues[0].autoFixed).toBe(true);
    expect(result.fixed).toBe(true);
  });

  it("detects and fixes offscreen elements", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{ nm: "Off", ks: { p: { a: 0, k: [200, -50] } } }],
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe("Offscreen element");
    expect(result.issues[0].autoFixed).toBe(true);
    expect(result.fixed).toBe(true);
  });

  it("detects zero opacity layers (not auto-fixed)", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{ nm: "Invisible", ks: { o: { a: 0, k: 0 } } }],
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe("Zero opacity");
    expect(result.issues[0].autoFixed).toBe(false);
    expect(result.fixed).toBe(false);
  });

  it("detects and fixes duplicate keyframes", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{
        nm: "Dup",
        ks: { p: { a: 1, k: [{ t: 0, s: [0] }, { t: 0, s: [10] }, { t: 30, s: [50] }] } },
      }],
    });
    expect(result.issues.some(i => i.category === "Duplicate keyframes")).toBe(true);
    expect(result.fixed).toBe(true);
  });

  it("detects zero-duration keyframes (identical start/end)", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{
        nm: "Static",
        ks: { p: { a: 1, k: [{ t: 0, s: [10, 20], e: [10, 20] }] } },
      }],
    });
    expect(result.issues.some(i => i.category === "Zero-duration keyframe")).toBe(true);
    expect(result.issues[0].autoFixed).toBe(false);
  });

  it("detects and removes empty shape groups", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{
        nm: "ShapeLayer", ty: 4,
        shapes: [{ ty: "gr", it: [{ ty: "tr" }], nm: "EmptyGroup" }],
      }],
    });
    expect(result.issues.some(i => i.category === "Empty group")).toBe(true);
    expect(result.fixed).toBe(true);
  });

  it("detects invisible shapes (no fill/stroke) and adds default fill", () => {
    const anim = {
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{
        nm: "NoFill", ty: 4,
        shapes: [{ ty: "sh" }],
      }],
    };
    const result = diagnoseAndFix(anim);
    expect(result.issues.some(i => i.category === "Invisible shape")).toBe(true);
    expect(result.fixed).toBe(true);
    expect(anim.layers[0].shapes).toHaveLength(2);
    expect(anim.layers[0].shapes[1].ty).toBe("fl");
  });

  it("recurses into nested shape groups", () => {
    const anim = {
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{
        nm: "Nested", ty: 4,
        shapes: [{
          ty: "gr",
          it: [
            { ty: "gr", it: [{ ty: "tr" }], nm: "InnerEmpty" },
            { ty: "sh" },
            { ty: "tr" },
          ],
        }],
      }],
    };
    const result = diagnoseAndFix(anim);
    expect(result.issues.some(i => i.category === "Empty group" && i.description.includes("InnerEmpty"))).toBe(true);
  });

  it("handles multiple issues in one animation", () => {
    const result = diagnoseAndFix({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [
        { nm: "ZeroDur", ip: 50, op: 10 },
        { nm: "Offscreen", ks: { p: { a: 0, k: [-100, 500] } } },
        { nm: "ZeroOp", ks: { o: { a: 0, k: 0 } } },
      ],
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
    expect(result.fixed).toBe(true);
  });
});

describe("handleFix", () => {
  it("returns done event when no animationId", async () => {
    const res = await handleFix(undefined, "/fix");
    expect(mockSendDoneEvent).toHaveBeenCalledWith({
      reply: "Create an animation first, then I can fix issues in it.",
    });
    expect(res).toBeDefined();
  });

  it("returns 404 when animation does not exist", async () => {
    mockAnimationExists.mockReturnValue(false);
    const res = await handleFix("anim1", "/fix");
    expect(res.status).toBe(404);
  });

  it("returns done event when readAnimationFile returns null", async () => {
    mockAnimationExists.mockReturnValue(true);
    mockReadAnimationFile.mockReturnValue(null);
    const res = await handleFix("anim1", "/fix");
    expect(mockSendDoneEvent).toHaveBeenCalledWith({
      reply: "No animation data found. Create an animation first.",
      animationId: "anim1",
    });
    expect(res).toBeDefined();
  });

  it("streams report for clean animation (zero issues)", async () => {
    mockAnimationExists.mockReturnValue(true);
    mockReadAnimationFile.mockReturnValue({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{ nm: "Good", ip: 0, op: 60 }],
    });

    const res = await handleFix("anim1", "/fix");
    expect(mockSaveUserMessage).toHaveBeenCalledWith("anim1", "/fix");
    expect(mockCreateStreamingSSEResponse).toHaveBeenCalled();
    expect(mockWriteAnimationFile).not.toHaveBeenCalled();

    const text = await res.text();
    expect(text).toContain("No issues found");
  });

  it("streams report and writes file when auto-fixes applied", async () => {
    mockAnimationExists.mockReturnValue(true);
    mockReadAnimationFile.mockReturnValue({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{ nm: "Bad", ip: 50, op: 10 }],
    });

    const res = await handleFix("anim1", "/fix");
    expect(mockWriteAnimationFile).toHaveBeenCalledWith("anim1", expect.any(Object));
    expect(mockSaveVersion).toHaveBeenCalledWith("anim1", expect.any(String), "/fix auto-repair");
    expect(mockUpdateAnimationMetadata).toHaveBeenCalledWith("anim1", expect.any(Object));
    expect(mockEmitUpdated).toHaveBeenCalledWith("anim1");
    expect(mockSaveAssistantMessage).toHaveBeenCalled();

    const text = await res.text();
    expect(text).toContain("Auto-fixed");
  });

  it("streams report without writing file when no auto-fixes", async () => {
    mockAnimationExists.mockReturnValue(true);
    mockReadAnimationFile.mockReturnValue({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [{ nm: "Invisible", ks: { o: { a: 0, k: 0 } } }],
    });

    const res = await handleFix("anim1", "/fix");
    expect(mockWriteAnimationFile).not.toHaveBeenCalled();
    expect(mockSaveVersion).not.toHaveBeenCalled();
    expect(mockSaveAssistantMessage).toHaveBeenCalledWith("anim1", expect.any(String));

    const text = await res.text();
    expect(text).toContain("Requires attention");
  });

  it("generates mixed severity report", async () => {
    mockAnimationExists.mockReturnValue(true);
    mockReadAnimationFile.mockReturnValue({
      w: 100, h: 100, ip: 0, op: 60, fr: 30,
      layers: [
        { nm: "ZeroDur", ip: 50, op: 10 },
        { nm: "ZeroOp", ks: { o: { a: 0, k: 0 } } },
        { nm: "StaticKF", ks: { p: { a: 1, k: [{ t: 0, s: [5], e: [5] }] } } },
      ],
    });

    const res = await handleFix("anim1", "/fix");
    const text = await res.text();
    expect(text).toContain("error");
    expect(text).toContain("warning");
    expect(text).toContain("info");
    expect(text).toContain("Auto-fixed");
    expect(text).toContain("Requires attention");
  });
});
