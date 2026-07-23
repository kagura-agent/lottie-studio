import { describe, it, expect } from "vitest";
import type { LottieTestObj } from "./test-types";
import { parseCommand } from "@/lib/commands";
import { diagnoseAndFix } from "@/lib/chat-handlers/fix";

type LottieParam = Parameters<typeof diagnoseAndFix>[0];

function makeAnimation(overrides: Record<string, unknown> = {}): LottieParam {
  return {
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [],
    ...overrides,
  } as LottieParam;
}

describe("parseCommand /fix", () => {
  it("parses /fix command", () => {
    expect(parseCommand("/fix")).toEqual({ type: "fix" });
  });

  it("parses /fix with extra spaces", () => {
    expect(parseCommand("  /fix  ")).toEqual({ type: "fix" });
  });
});

describe("diagnoseAndFix", () => {
  it("returns no issues for a healthy animation", () => {
    const anim = makeAnimation({
      layers: [{
        ty: 4,
        nm: "Good Layer",
        ip: 0,
        op: 60,
        ks: { p: { a: 0, k: [256, 256, 0] }, o: { a: 0, k: 100 } },
        shapes: [
          { ty: "sh", nm: "Path" },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0, 0, 1] } },
        ],
      }],
    });
    const { issues, fixed } = diagnoseAndFix(anim);
    expect(issues).toHaveLength(0);
    expect(fixed).toBe(false);
  });

  it("returns no issues for animation with no layers", () => {
    const anim = makeAnimation({ layers: undefined });
    const { issues, fixed } = diagnoseAndFix(anim);
    expect(issues).toHaveLength(0);
    expect(fixed).toBe(false);
  });

  describe("(a) offscreen elements", () => {
    it("detects and fixes elements outside viewport", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "Offscreen", ip: 0, op: 60,
          ks: { p: { a: 0, k: [600, -50, 0] } },
          shapes: [{ ty: "sh" }, { ty: "fl" }],
        }],
      });
      const { issues, fixed } = diagnoseAndFix(anim);
      expect(fixed).toBe(true);
      const offscreen = issues.find(i => i.category === "Offscreen element");
      expect(offscreen).toBeDefined();
      expect(offscreen!.autoFixed).toBe(true);
      expect((anim as LottieTestObj).layers[0].ks.p.k[0]).toBe(512);
      expect((anim as LottieTestObj).layers[0].ks.p.k[1]).toBe(0);
    });
  });

  describe("(b) zero opacity", () => {
    it("detects static zero opacity layers", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "Invisible", ip: 0, op: 60,
          ks: { o: { a: 0, k: 0 } },
          shapes: [{ ty: "sh" }, { ty: "fl" }],
        }],
      });
      const { issues } = diagnoseAndFix(anim);
      const zeroOp = issues.find(i => i.category === "Zero opacity");
      expect(zeroOp).toBeDefined();
      expect(zeroOp!.autoFixed).toBe(false);
    });
  });

  describe("(c) zero-duration keyframes", () => {
    it("detects keyframes with same start/end values", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "Static KF", ip: 0, op: 60,
          ks: {
            p: { a: 1, k: [
              { t: 0, s: [100, 100], e: [100, 100] },
              { t: 30, s: [200, 200], e: [200, 200] },
            ] },
          },
          shapes: [{ ty: "sh" }, { ty: "fl" }],
        }],
      });
      const { issues } = diagnoseAndFix(anim);
      const zeroKf = issues.filter(i => i.category === "Zero-duration keyframe");
      expect(zeroKf.length).toBe(2);
      expect(zeroKf[0].autoFixed).toBe(false);
    });
  });

  describe("(d) empty shape groups", () => {
    it("detects and removes empty groups", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "Has Empty Group", ip: 0, op: 60,
          ks: {},
          shapes: [
            { ty: "gr", nm: "Empty", it: [{ ty: "tr" }] },
            { ty: "sh" },
            { ty: "fl" },
          ],
        }],
      });
      const { issues, fixed } = diagnoseAndFix(anim);
      expect(fixed).toBe(true);
      const emptyGroup = issues.find(i => i.category === "Empty group");
      expect(emptyGroup).toBeDefined();
      expect(emptyGroup!.autoFixed).toBe(true);
      expect((anim as LottieTestObj).layers[0].shapes).toHaveLength(2);
    });
  });

  describe("(e) missing fill and stroke", () => {
    it("detects and adds default fill to shapes without fill or stroke", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "No Fill", ip: 0, op: 60,
          ks: {},
          shapes: [{ ty: "sh", nm: "Path" }],
        }],
      });
      const { issues, fixed } = diagnoseAndFix(anim);
      expect(fixed).toBe(true);
      const invisible = issues.find(i => i.category === "Invisible shape");
      expect(invisible).toBeDefined();
      expect(invisible!.autoFixed).toBe(true);
      const shapes = (anim as LottieTestObj).layers[0].shapes as unknown as Record<string, unknown>[];
      expect(shapes.some((s: Record<string, unknown>) => s.ty === "fl")).toBe(true);
    });

    it("does not flag shapes that have a stroke", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "Stroked", ip: 0, op: 60,
          ks: {},
          shapes: [{ ty: "sh" }, { ty: "st" }],
        }],
      });
      const { issues } = diagnoseAndFix(anim);
      expect(issues.find(i => i.category === "Invisible shape")).toBeUndefined();
    });
  });

  describe("(f) zero-duration layers", () => {
    it("detects and fixes layers where ip >= op", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "Zero Duration", ip: 30, op: 30,
          ks: {},
          shapes: [{ ty: "sh" }, { ty: "fl" }],
        }],
      });
      const { issues, fixed } = diagnoseAndFix(anim);
      expect(fixed).toBe(true);
      const zeroDur = issues.find(i => i.category === "Zero-duration layer");
      expect(zeroDur).toBeDefined();
      expect(zeroDur!.autoFixed).toBe(true);
      expect((anim as LottieTestObj).layers[0].op).toBe(60);
    });
  });

  describe("(g) duplicate keyframes", () => {
    it("detects and removes duplicate keyframes at same time", () => {
      const anim = makeAnimation({
        layers: [{
          ty: 4, nm: "Dupe KF", ip: 0, op: 60,
          ks: {
            p: { a: 1, k: [
              { t: 0, s: [0, 0] },
              { t: 0, s: [10, 10] },
              { t: 30, s: [100, 100] },
            ] },
          },
          shapes: [{ ty: "sh" }, { ty: "fl" }],
        }],
      });
      const { issues, fixed } = diagnoseAndFix(anim);
      expect(fixed).toBe(true);
      const dupes = issues.find(i => i.category === "Duplicate keyframes");
      expect(dupes).toBeDefined();
      expect(dupes!.autoFixed).toBe(true);
      expect((anim as LottieTestObj).layers[0].ks.p.k).toHaveLength(2);
    });
  });

  it("handles multiple issues in one animation", () => {
    const anim = makeAnimation({
      layers: [
        { ty: 4, nm: "Bad1", ip: 60, op: 30, ks: {}, shapes: [{ ty: "sh" }] },
        { ty: 4, nm: "Bad2", ip: 0, op: 60, ks: { p: { a: 0, k: [1000, 1000, 0] } }, shapes: [{ ty: "el" }] },
      ],
    });
    const { issues, fixed } = diagnoseAndFix(anim);
    expect(fixed).toBe(true);
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });
});
