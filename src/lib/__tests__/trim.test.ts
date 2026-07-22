import { describe, it, expect } from "vitest";
import { trimAnimation, resolveRange } from "../trim";
import type { LottieJson } from "../retime";

function makeLottie(overrides?: Partial<LottieJson>): LottieJson {
  return {
    fr: 30,
    ip: 0,
    op: 90,
    layers: [
      { ip: 0, op: 90, nm: "full", ks: { o: { a: 1, k: [{ t: 0, s: [100] }, { t: 45, s: [50] }, { t: 90, s: [0] }] } } },
      { ip: 0, op: 30, nm: "early" },
      { ip: 60, op: 90, nm: "late" },
      { ip: 20, op: 70, nm: "mid" },
    ],
    markers: [{ tm: 10, cm: "a" }, { tm: 50, cm: "b" }, { tm: 80, cm: "c" }],
    ...overrides,
  };
}

describe("trimAnimation", () => {
  it("clips ip/op to new range and offsets to 0", () => {
    const result = trimAnimation(makeLottie(), 30, 60);
    expect(result.ip).toBe(0);
    expect(result.op).toBe(30);
  });

  it("removes layers entirely outside the range", () => {
    const result = trimAnimation(makeLottie(), 30, 60);
    const names = result.layers!.map((l: Record<string, unknown>) => l.nm);
    expect(names).not.toContain("early"); // 0-30 is outside 30-60
    expect(names).not.toContain("late"); // 60-90, op=60 not > 30
    expect(names).toContain("full");
    expect(names).toContain("mid");
  });

  it("clips partially overlapping layers", () => {
    const result = trimAnimation(makeLottie(), 30, 60);
    const full = result.layers!.find((l: Record<string, unknown>) => l.nm === "full");
    expect(full!.ip).toBe(0);
    expect(full!.op).toBe(30);
    const mid = result.layers!.find((l: Record<string, unknown>) => l.nm === "mid");
    expect(mid!.ip).toBe(0); // was 20, clipped to 30, offset -30 = 0
    expect(mid!.op).toBe(30); // was 70, clipped to 60, offset -30 = 30
  });

  it("offsets keyframes by startFrame", () => {
    const result = trimAnimation(makeLottie(), 30, 60);
    const full = result.layers!.find((l: Record<string, unknown>) => l.nm === "full") as Record<string, unknown>;
    const ks = full.ks as { o: { k: { t: number }[] } };
    // Only keyframe at t=45 is within 30-60, becomes t=15
    expect(ks.o.k.some((k) => k.t === 15)).toBe(true);
    // Keyframe at t=0 and t=90 should be removed
    expect(ks.o.k.some((k) => k.t === -30)).toBe(false);
  });

  it("filters markers within range and offsets them", () => {
    const result = trimAnimation(makeLottie(), 30, 60);
    expect(result.markers).toHaveLength(1);
    expect(result.markers![0].tm).toBe(20); // 50-30=20
  });

  it("handles trim at boundaries", () => {
    const result = trimAnimation(makeLottie(), 0, 90);
    expect(result.ip).toBe(0);
    expect(result.op).toBe(90);
    expect(result.layers).toHaveLength(4);
  });

  it("handles animation with no layers", () => {
    const result = trimAnimation({ fr: 30, ip: 0, op: 90 }, 10, 50);
    expect(result.ip).toBe(0);
    expect(result.op).toBe(40);
  });
});

describe("resolveRange", () => {
  it("resolves frame units", () => {
    const { startFrame, endFrame } = resolveRange(
      { start: { value: 10, unit: "frame" }, end: { value: 50, unit: "frame" } },
      30, 90
    );
    expect(startFrame).toBe(10);
    expect(endFrame).toBe(50);
  });

  it("resolves seconds", () => {
    const { startFrame, endFrame } = resolveRange(
      { start: { value: 1, unit: "seconds" }, end: { value: 2.5, unit: "seconds" } },
      30, 90
    );
    expect(startFrame).toBe(30);
    expect(endFrame).toBe(75);
  });

  it("resolves ms", () => {
    const { startFrame, endFrame } = resolveRange(
      { start: { value: 0, unit: "ms" }, end: { value: 500, unit: "ms" } },
      30, 90
    );
    expect(startFrame).toBe(0);
    expect(endFrame).toBe(15);
  });

  it("resolves percent", () => {
    const { startFrame, endFrame } = resolveRange(
      { start: { value: 0, unit: "start" }, end: { value: 50, unit: "percent" } },
      30, 90
    );
    expect(startFrame).toBe(0);
    expect(endFrame).toBe(45);
  });

  it("resolves start/end keywords", () => {
    const { startFrame, endFrame } = resolveRange(
      { start: { value: 0, unit: "start" }, end: { value: 0, unit: "end" } },
      30, 90
    );
    expect(startFrame).toBe(0);
    expect(endFrame).toBe(90);
  });
});
