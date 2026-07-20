/* eslint-disable @typescript-eslint/no-explicit-any */
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

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { animationEvents } from "@/lib/events";
import fs from "node:fs";
import { diagnoseAndFix, handleFix } from "../fix";

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to collect SSE stream chunks
async function collectSSE(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value));
  }
  return chunks;
}


describe("diagnoseAndFix", () => {
  describe("no layers", () => {
    it("returns empty issues when animation has no layers property", () => {
      const anim = { w: 500, h: 500, ip: 0, op: 60, fr: 30 };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toEqual([]);
      expect(result.fixed).toBe(false);
    });
  });

  describe("zero-duration layers", () => {
    it("fixes layer where ip >= op", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "broken", ip: 30, op: 10 }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe("Zero-duration layer");
      expect(result.issues[0].severity).toBe("error");
      expect(result.issues[0].autoFixed).toBe(true);
      expect(result.fixed).toBe(true);
      expect(anim.layers[0].op).toBe(60);
    });

    it("fixes layer where ip === op", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 90, fr: 30,
        layers: [{ nm: "stalled", ip: 45, op: 45 }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe("Zero-duration layer");
      expect(result.fixed).toBe(true);
      expect(anim.layers[0].op).toBe(90);
    });

    it("uses default layer name when nm is missing", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ ip: 30, op: 10 }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues[0].description).toContain("Layer 0");
    });
  });

  describe("offscreen elements", () => {
    it("fixes layer positioned outside viewport (positive overflow)", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "offscreen", ks: { p: { a: 0, k: [600, 700, 0] } } }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe("Offscreen element");
      expect(result.issues[0].severity).toBe("warning");
      expect(result.issues[0].autoFixed).toBe(true);
      expect(result.fixed).toBe(true);
      expect(anim.layers[0].ks.p.k[0]).toBe(500);
      expect(anim.layers[0].ks.p.k[1]).toBe(500);
    });

    it("fixes layer positioned outside viewport (negative)", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "neg", ks: { p: { a: 0, k: [-10, -20, 0] } } }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe("Offscreen element");
      expect(anim.layers[0].ks.p.k[0]).toBe(0);
      expect(anim.layers[0].ks.p.k[1]).toBe(0);
    });

    it("does not flag layer within viewport", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "ok", ks: { p: { a: 0, k: [250, 250, 0] } } }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toHaveLength(0);
      expect(result.fixed).toBe(false);
    });

    it("skips animated position (a=1)", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "animated", ks: { p: { a: 1, k: [{ t: 0, s: [600, 600] }] } } }],
      };
      const result = diagnoseAndFix(anim as any);
      // Should not detect offscreen since position is animated
      expect(result.issues.filter(i => i.category === "Offscreen element")).toHaveLength(0);
    });

    it("skips position with less than 2 values", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "short", ks: { p: { a: 0, k: [600] } } }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Offscreen element")).toHaveLength(0);
    });
  });

  describe("zero opacity layers", () => {
    it("reports static zero opacity as warning (not auto-fixed)", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "ghost", ks: { o: { a: 0, k: 0 } } }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe("Zero opacity");
      expect(result.issues[0].severity).toBe("warning");
      expect(result.issues[0].autoFixed).toBe(false);
      expect(result.fixed).toBe(false);
    });

    it("does not flag non-zero opacity", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "visible", ks: { o: { a: 0, k: 100 } } }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues).toHaveLength(0);
    });

    it("does not flag animated opacity", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "fading", ks: { o: { a: 1, k: [{ t: 0, s: [0] }] } } }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Zero opacity")).toHaveLength(0);
    });
  });

  describe("duplicate keyframes", () => {
    it("removes duplicate keyframes at the same time", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "dups",
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0] },
                { t: 10, s: [100, 100] },
                { t: 10, s: [200, 200] }, // duplicate at t=10
              ],
            },
          },
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.some(i => i.category === "Duplicate keyframes")).toBe(true);
      const dupIssue = result.issues.find(i => i.category === "Duplicate keyframes")!;
      expect(dupIssue.autoFixed).toBe(true);
      expect(dupIssue.severity).toBe("warning");
      expect(result.fixed).toBe(true);
      // Keyframe array should have the duplicate removed
      expect((anim.layers[0].ks.p as any).k).toHaveLength(2);
    });

    it("handles multiple duplicates at different times", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "multi-dup",
          ks: {
            s: {
              a: 1,
              k: [
                { t: 0, s: [100] },
                { t: 0, s: [100] },
                { t: 20, s: [200] },
                { t: 20, s: [200] },
              ],
            },
          },
        }],
      };
      const result = diagnoseAndFix(anim as any);
      const dupIssue = result.issues.find(i => i.category === "Duplicate keyframes")!;
      expect(dupIssue.description).toContain("2 duplicate keyframe(s)");
      expect((anim.layers[0].ks as any).s.k).toHaveLength(2);
    });
  });

  describe("zero-duration keyframes", () => {
    it("reports keyframes with identical start/end values", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "static-kf",
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [100, 100], e: [100, 100] },
                { t: 30, s: [200, 200], e: [300, 300] },
              ],
            },
          },
        }],
      };
      const result = diagnoseAndFix(anim as any);
      const zeroKf = result.issues.find(i => i.category === "Zero-duration keyframe");
      expect(zeroKf).toBeDefined();
      expect(zeroKf!.severity).toBe("info");
      expect(zeroKf!.autoFixed).toBe(false);
      expect(zeroKf!.description).toContain("t=0");
    });

    it("does not report keyframes with different start/end", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "moving",
          ks: {
            p: {
              a: 1,
              k: [
                { t: 0, s: [0, 0], e: [100, 100] },
              ],
            },
          },
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Zero-duration keyframe")).toHaveLength(0);
    });
  });

  describe("empty shape groups", () => {
    it("removes empty groups (only transform inside)", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "shapes",
          ty: 4,
          shapes: [
            { ty: "gr", nm: "Empty", it: [{ ty: "tr" }] },
          ],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      const emptyGroup = result.issues.find(i => i.category === "Empty group");
      expect(emptyGroup).toBeDefined();
      expect(emptyGroup!.autoFixed).toBe(true);
      expect(emptyGroup!.severity).toBe("warning");
      expect(anim.layers[0].shapes).toHaveLength(0);
    });

    it("removes empty groups (only nested groups inside)", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "nested",
          ty: 4,
          shapes: [
            { ty: "gr", nm: "Container", it: [{ ty: "tr" }, { ty: "gr", it: [] }] },
          ],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      const emptyGroup = result.issues.find(i => i.category === "Empty group");
      expect(emptyGroup).toBeDefined();
      expect(anim.layers[0].shapes).toHaveLength(0);
    });

    it("does not remove groups with visible items", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "full",
          ty: 4,
          shapes: [
            { ty: "gr", nm: "HasShape", it: [{ ty: "sh" }, { ty: "fl" }, { ty: "tr" }] },
          ],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Empty group")).toHaveLength(0);
      expect(anim.layers[0].shapes).toHaveLength(1);
    });

    it("uses 'unnamed' when group has no nm", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "layer1",
          ty: 4,
          shapes: [
            { ty: "gr", it: [{ ty: "tr" }] },
          ],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues[0].description).toContain("unnamed");
    });
  });

  describe("invisible shapes (no fill or stroke)", () => {
    it("adds default fill when shape has no fill or stroke", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "invisible",
          ty: 4,
          shapes: [
            { ty: "sh" },
          ],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      const invisible = result.issues.find(i => i.category === "Invisible shape");
      expect(invisible).toBeDefined();
      expect(invisible!.severity).toBe("error");
      expect(invisible!.autoFixed).toBe(true);
      // Should have added a fill
      expect(anim.layers[0].shapes).toHaveLength(2);
      expect(anim.layers[0].shapes[1].ty).toBe("fl");
    });

    it("does not flag shapes with fill", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "filled",
          ty: 4,
          shapes: [{ ty: "rc" }, { ty: "fl" }],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Invisible shape")).toHaveLength(0);
    });

    it("does not flag shapes with stroke", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "stroked",
          ty: 4,
          shapes: [{ ty: "el" }, { ty: "st" }],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Invisible shape")).toHaveLength(0);
    });

    it("does not flag shapes with gradient fill", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "gradient",
          ty: 4,
          shapes: [{ ty: "sr" }, { ty: "gf" }],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Invisible shape")).toHaveLength(0);
    });

    it("does not flag shapes with gradient stroke", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "gs-layer",
          ty: 4,
          shapes: [{ ty: "sh" }, { ty: "gs" }],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Invisible shape")).toHaveLength(0);
    });

    it("does not flag when no path shapes exist", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "no-paths",
          ty: 4,
          shapes: [{ ty: "tr" }],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Invisible shape")).toHaveLength(0);
    });
  });

  describe("non-shape layers", () => {
    it("skips shape checks for non-shape layers (ty !== 4)", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "text-layer",
          ty: 5,
          shapes: [{ ty: "sh" }], // hypothetically has shapes but wrong layer type
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Invisible shape")).toHaveLength(0);
      expect(result.issues.filter(i => i.category === "Empty group")).toHaveLength(0);
    });
  });

  describe("multiple issues combined", () => {
    it("reports and fixes multiple issues in one pass", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [
          { nm: "zero-dur", ip: 50, op: 10 },
          { nm: "ghost", ks: { o: { a: 0, k: 0 } } },
          {
            nm: "shapes-layer",
            ty: 4,
            shapes: [{ ty: "sh" }],
          },
        ],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
      expect(result.fixed).toBe(true);
    });
  });

  describe("recursive group fixing", () => {
    it("recurses into nested groups to fix shapes", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "deep",
          ty: 4,
          shapes: [
            {
              ty: "gr",
              nm: "Outer",
              it: [
                { ty: "sh" }, // visible item so outer group isn't empty
                { ty: "gr", nm: "Inner", it: [{ ty: "tr" }] }, // empty inner group
                { ty: "tr" },
              ],
            },
          ],
        }],
      };
      const result = diagnoseAndFix(anim as any);
      const emptyGroup = result.issues.find(i => i.category === "Empty group");
      expect(emptyGroup).toBeDefined();
      expect(emptyGroup!.description).toContain("Inner");
    });
  });

  describe("keyframe without t property", () => {
    it("skips keyframes without t for duplicate check", () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{
          nm: "no-t",
          ks: {
            p: {
              a: 1,
              k: [
                { s: [0, 0], e: [100, 100] },
                { s: [100, 100], e: [200, 200] },
              ],
            },
          },
        }],
      };
      const result = diagnoseAndFix(anim as any);
      expect(result.issues.filter(i => i.category === "Duplicate keyframes")).toHaveLength(0);
    });
  });
});

describe("handleFix", () => {
  function setupDbMock(animRow?: Record<string, unknown>) {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      get: () => animRow,
      run: vi.fn(),
    });
  }

  describe("no animationId", () => {
    it("returns done event asking to create animation first", async () => {
      const res = await handleFix(undefined, "/fix");
      const text = await res.text();
      expect(text).toContain("Create an animation first");
    });
  });

  describe("animation not found", () => {
    it("returns 404 when animation does not exist in DB", async () => {
      setupDbMock(undefined);
      const res = await handleFix("nonexistent", "/fix");
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Animation not found");
    });
  });

  describe("no animation data", () => {
    it("returns done event when file does not exist", async () => {
      setupDbMock({ id: "anim1" });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const res = await handleFix("anim1", "/fix");
      const text = await res.text();
      expect(text).toContain("No animation data found");
    });
  });

  describe("zero issues", () => {
    it("returns no-issues message when animation is healthy", async () => {
      const healthyAnim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "good", ip: 0, op: 60, ks: { p: { a: 0, k: [250, 250, 0] } } }],
      };
      setupDbMock({ id: "anim1" });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(healthyAnim));

      const res = await handleFix("anim1", "/fix");
      const chunks = await collectSSE(res);
      const combined = chunks.join("");
      expect(combined).toContain("No issues found");
      expect(combined).toContain("looks good");
      // Should not write file
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe("issues found with auto-fix", () => {
    it("writes back fixed animation and emits events", async () => {
      const brokenAnim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "broken", ip: 50, op: 10 }],
      };
      setupDbMock({ id: "anim1", max_num: 2 });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(brokenAnim));

      const res = await handleFix("anim1", "/fix");
      const chunks = await collectSSE(res);
      const combined = chunks.join("");

      // Check report content
      expect(combined).toContain("Animation Diagnostics");
      expect(combined).toContain("Auto-fixed");
      expect(combined).toContain("Zero-duration layer");

      // Verify write-back
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
    });

    it("includes lottieJson in done event when fixed", async () => {
      const brokenAnim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "bad", ip: 30, op: 5 }],
      };
      setupDbMock({ id: "anim1", max_num: 1 });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(brokenAnim));

      const res = await handleFix("anim1", "/fix my animation");
      const chunks = await collectSSE(res);
      const combined = chunks.join("");
      // The done event should contain lottieJson
      expect(combined).toContain('"type":"done"');
      expect(combined).toContain('"lottieJson"');
    });
  });

  describe("issues found without auto-fix", () => {
    it("reports issues but does not write file when only manual issues", async () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [{ nm: "ghost", ks: { o: { a: 0, k: 0 } } }],
      };
      setupDbMock({ id: "anim1", max_num: 1 });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(anim));

      const res = await handleFix("anim1", "/fix");
      const chunks = await collectSSE(res);
      const combined = chunks.join("");

      expect(combined).toContain("Requires attention");
      expect(combined).toContain("Zero opacity");
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(animationEvents.emit).not.toHaveBeenCalled();
    });
  });

  describe("mixed severity issues", () => {
    it("reports errors, warnings, and info in proper sections", async () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [
          // Error: zero-duration (auto-fixed)
          { nm: "errLayer", ip: 50, op: 10 },
          // Warning: zero opacity (manual)
          { nm: "warnLayer", ks: { o: { a: 0, k: 0 } } },
          // Info: zero-duration keyframe (manual)
          {
            nm: "infoLayer",
            ks: {
              p: {
                a: 1,
                k: [{ t: 0, s: [100, 100], e: [100, 100] }],
              },
            },
          },
        ],
      };
      setupDbMock({ id: "anim1", max_num: 3 });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(anim));

      const res = await handleFix("anim1", "/fix");
      const chunks = await collectSSE(res);
      const combined = chunks.join("");

      expect(combined).toContain("1 error(s)");
      expect(combined).toContain("1 warning(s)");
      expect(combined).toContain("1 info");
      expect(combined).toContain("Auto-fixed");
      expect(combined).toContain("Requires attention");
      // Write-back happens because there is an auto-fix
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("saveUserMessage is called", () => {
    it("saves the user message before processing", async () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [],
      };
      setupDbMock({ id: "anim1", max_num: 0 });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(anim));

      await handleFix("anim1", "/fix please");
      // db.prepare should have been called for INSERT user message
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  describe("SSE response format", () => {
    it("returns response with correct SSE headers", async () => {
      const anim = {
        w: 500, h: 500, ip: 0, op: 60, fr: 30,
        layers: [],
      };
      setupDbMock({ id: "anim1", max_num: 0 });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(anim));

      const res = await handleFix("anim1", "/fix");
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache");
    });
  });
});
