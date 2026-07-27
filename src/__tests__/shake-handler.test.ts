import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/chat-handlers/helpers", () => ({
  sendDoneEvent: vi.fn((payload: unknown) => Response.json(payload)),
  saveVersion: vi.fn(),
  updateAnimationMetadata: vi.fn(),
  emitUpdated: vi.fn(),
  animationExists: vi.fn(),
  readAnimationFile: vi.fn(),
  writeAnimationFile: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAssistantMessage: vi.fn(),
}));

vi.mock("@/lib/shake", () => ({
  generateShakeKeyframes: vi.fn(
    (start: number, end: number) =>
      Array.from({ length: end - start }, (_, i) => ({ t: start + i, s: [i * 0.5] }))
  ),
  resolveShakeOptions: vi.fn((opts: Record<string, unknown>) => ({
    intensity: opts.intensity ?? 10,
    frequency: opts.frequency ?? 12,
    decay: opts.decay ?? 0.85,
    seed: undefined,
  })),
}));

import { handleShake } from "@/lib/chat-handlers/shake";
import {
  sendDoneEvent,
  animationExists,
  readAnimationFile,
  writeAnimationFile,
} from "@/lib/chat-handlers/helpers";
import { resolveShakeOptions } from "@/lib/shake";

function makeAnimation(layers: Record<string, unknown>[] = []) {
  return {
    fr: 30,
    ip: 0,
    op: 60,
    layers,
  };
}

function makeLayer(name: string, ks: Record<string, unknown> = {}) {
  return { nm: name, ip: 0, op: 60, ks };
}

describe("handleShake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when animationId is undefined", async () => {
    const res = await handleShake(undefined, {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Create an animation first");
  });

  it("returns 404 when animation does not exist", async () => {
    vi.mocked(animationExists).mockReturnValue(false);
    const res = await handleShake("id-1", {}, "/shake");
    expect(res.status).toBe(404);
  });

  it("returns error when readAnimationFile returns null", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(null as unknown as ReturnType<typeof readAnimationFile>);
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("No animation file found");
  });

  it("returns error when no layers match", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(makeAnimation([{ nm: "bg" }]) as ReturnType<typeof readAnimationFile>);
    const res = await handleShake("id-1", { layer: "nonexistent" }, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("No layers found");
  });

  it("returns error when layers have no ks", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(makeAnimation([{ nm: "bg" }]) as ReturnType<typeof readAnimationFile>);
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("No layers found");
  });

  it("applies shake with axis=both (default) happy path", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("Layer 1", { p: { a: 0, k: [100, 200] } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
    expect(data.reply).toContain("Layer 1");
    expect(writeAnimationFile).toHaveBeenCalled();
    expect(resolveShakeOptions).toHaveBeenCalled();
  });

  it("applies shake with axis=x (y offset is null)", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { p: { a: 0, k: [100, 200] } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", { axis: "x" }, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("(x)");
  });

  it("applies shake with axis=y (x offset is null)", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { p: { a: 0, k: [100, 200] } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", { axis: "y" }, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("(y)");
  });

  it("applies shake with axis=rotation", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { r: { a: 0, k: 45 } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", { axis: "rotation" }, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("(rotation)");
  });

  it("getBaseValue: returns fallback when prop is undefined", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", {})]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", { axis: "rotation" }, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
  });

  it("getBaseValue: handles number k value", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { p: { a: 0, k: 50 } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
  });

  it("getBaseValue: falls back for non-number array", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { p: { a: 1, k: [{ t: 0, s: [0] }] } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
  });

  it("getBaseValue: falls back for empty array", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { p: { a: 0, k: [] } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
  });

  it("filters layers by name when layer option is set", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([
        makeLayer("bg", { p: { a: 0, k: [0, 0] } }),
        makeLayer("fg", { p: { a: 0, k: [0, 0] } }),
      ]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", { layer: "fg" }, "/shake");
    const data = await res.json();
    expect(data.reply).toContain('"fg"');
    expect(data.reply).not.toContain('"bg"');
  });

  it("handles multiple layers and shows count for >3 layers", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    const layers = Array.from({ length: 4 }, (_, i) =>
      makeLayer(`L${i}`, { p: { a: 0, k: [0, 0] } })
    );
    vi.mocked(readAnimationFile).mockReturnValue(makeAnimation(layers) as ReturnType<typeof readAnimationFile>);
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("4 layers");
  });

  it("uses duration option to compute layerEnd", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { p: { a: 0, k: [0, 0] } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", { duration: 0.5 }, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
  });

  it("handles 3D position (base.length > 2)", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([makeLayer("L", { p: { a: 0, k: [100, 200, 300] } })]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
  });

  it("deduplicates layer names in output", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([
        makeLayer("Same", { p: { a: 0, k: [0, 0] } }),
        makeLayer("Same", { p: { a: 0, k: [0, 0] } }),
      ]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain('1 layer');
  });

  it("uses 'unnamed' for layers without nm", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue(
      makeAnimation([{ ks: { p: { a: 0, k: [0, 0] } }, ip: 0, op: 60 }]) as ReturnType<typeof readAnimationFile>
    );
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("unnamed");
  });

  it("uses animation defaults when fr/ip/op are missing", async () => {
    vi.mocked(animationExists).mockReturnValue(true);
    vi.mocked(readAnimationFile).mockReturnValue({
      layers: [{ nm: "L", ks: { p: { a: 0, k: [0, 0] } } }],
    } as ReturnType<typeof readAnimationFile>);
    const res = await handleShake("id-1", {}, "/shake");
    const data = await res.json();
    expect(data.reply).toContain("Applied shake");
  });
});
