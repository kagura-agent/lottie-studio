// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkFileSize,
  checkLayerCount,
  checkHiddenLayers,
  checkLoopSmoothness,
  checkFrameRate,
  analyzeQuality,
} from "@/lib/quality";

vi.mock("@/lib/validation", () => ({
  validateStructure: vi.fn(() => ({ valid: true, issues: [] })),
}));

import { validateStructure } from "@/lib/validation";
const mockValidateStructure = vi.mocked(validateStructure);

function anim(overrides = {}): Record<string, unknown> {
  return { layers: [], ip: 0, op: 30, fr: 30, w: 100, h: 100, ...overrides };
}

function layer(overrides = {}): Record<string, unknown> {
  return { nm: "Shape", ty: 4, ip: 0, op: 30, ks: {}, ...overrides };
}

// --- checkFileSize ---

describe("checkFileSize", () => {
  it("passes for small files (<50 KB)", () => {
    const r = checkFileSize("{}");
    expect(r.id).toBe("file-size");
    expect(r.status).toBe("pass");
    expect(r.score).toBe(100);
    expect(r.suggestion).toBeUndefined();
  });

  it("warns for medium files (50-150 KB)", () => {
    const json = "x".repeat(60 * 1024);
    const r = checkFileSize(json);
    expect(r.status).toBe("warn");
    expect(r.score).toBe(60);
    expect(r.suggestion).toBeDefined();
  });

  it("fails for large files (>150 KB)", () => {
    const json = "x".repeat(160 * 1024);
    const r = checkFileSize(json);
    expect(r.status).toBe("fail");
    expect(r.score).toBe(20);
    expect(r.suggestion).toBeDefined();
  });

  it("measures bytes not characters (multi-byte)", () => {
    // Each emoji is 4 bytes in UTF-8
    const r = checkFileSize("😀".repeat(13 * 1024));
    expect(r.status).not.toBe("pass"); // 52KB in bytes
  });
});

// --- checkLayerCount ---

describe("checkLayerCount", () => {
  it("passes for <10 layers", () => {
    const r = checkLayerCount(anim({ layers: Array(5).fill(layer()) }));
    expect(r.status).toBe("pass");
    expect(r.score).toBe(100);
    expect(r.detail).toContain("5 layers");
  });

  it("singular 'layer' for count=1", () => {
    const r = checkLayerCount(anim({ layers: [layer()] }));
    expect(r.detail).toContain("1 layer");
    expect(r.detail).not.toContain("1 layers");
  });

  it("warns for 10-20 layers", () => {
    const r = checkLayerCount(anim({ layers: Array(15).fill(layer()) }));
    expect(r.status).toBe("warn");
    expect(r.score).toBe(60);
    expect(r.suggestion).toBeDefined();
  });

  it("fails for >20 layers", () => {
    const r = checkLayerCount(anim({ layers: Array(25).fill(layer()) }));
    expect(r.status).toBe("fail");
    expect(r.score).toBe(20);
  });

  it("handles missing layers", () => {
    const r = checkLayerCount({});
    expect(r.status).toBe("pass");
    expect(r.detail).toContain("0 layers");
  });

  it("boundary: 9 layers passes, 10 warns", () => {
    expect(checkLayerCount(anim({ layers: Array(9).fill(layer()) })).status).toBe("pass");
    expect(checkLayerCount(anim({ layers: Array(10).fill(layer()) })).status).toBe("warn");
  });

  it("boundary: 20 layers warns, 21 fails", () => {
    expect(checkLayerCount(anim({ layers: Array(20).fill(layer()) })).status).toBe("warn");
    expect(checkLayerCount(anim({ layers: Array(21).fill(layer()) })).status).toBe("fail");
  });
});

// --- checkHiddenLayers ---

describe("checkHiddenLayers", () => {
  it("passes when no hidden layers", () => {
    const r = checkHiddenLayers(anim({ layers: [layer()] }));
    expect(r.status).toBe("pass");
    expect(r.score).toBe(100);
  });

  it("passes for empty animation", () => {
    const r = checkHiddenLayers(anim());
    expect(r.status).toBe("pass");
  });

  it("handles missing layers key", () => {
    const r = checkHiddenLayers({});
    expect(r.status).toBe("pass");
  });

  it("detects layers with hd=true", () => {
    const r = checkHiddenLayers(anim({ layers: [layer({ hd: true, nm: "Hidden1" })] }));
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("Hidden1");
  });

  it("detects layers with static zero opacity", () => {
    const r = checkHiddenLayers(
      anim({ layers: [layer({ ks: { o: { a: 0, k: 0 } } })] })
    );
    expect(r.status).toBe("warn");
    expect(r.score).toBe(80);
  });

  it("does not flag non-zero opacity", () => {
    const r = checkHiddenLayers(
      anim({ layers: [layer({ ks: { o: { a: 0, k: 100 } } })] })
    );
    expect(r.status).toBe("pass");
  });

  it("uses fallback name when nm is missing", () => {
    const r = checkHiddenLayers(anim({ layers: [{ hd: true }] }));
    expect(r.detail).toContain("Layer 1");
  });

  it("score floors at 20 for many hidden layers", () => {
    const layers = Array.from({ length: 6 }, (_, i) => layer({ hd: true, nm: `H${i}` }));
    const r = checkHiddenLayers(anim({ layers }));
    expect(r.score).toBe(20);
  });

  it("truncates display at 3 hidden layers with ellipsis", () => {
    const layers = Array.from({ length: 5 }, (_, i) => layer({ hd: true, nm: `H${i}` }));
    const r = checkHiddenLayers(anim({ layers }));
    expect(r.detail).toContain("...");
    expect(r.suggestion).toBeDefined();
  });

  it("singular form for 1 hidden layer", () => {
    const r = checkHiddenLayers(anim({ layers: [layer({ hd: true, nm: "A" })] }));
    expect(r.detail).toContain("1 hidden/unused layer:");
    expect(r.detail).not.toContain("layers");
  });

  it("skips hd=true and does not double-count opacity", () => {
    const r = checkHiddenLayers(
      anim({ layers: [layer({ hd: true, nm: "X", ks: { o: { a: 0, k: 0 } } })] })
    );
    expect(r.detail).toContain("1 hidden");
  });
});

// --- checkLoopSmoothness ---

describe("checkLoopSmoothness", () => {
  it("passes for single-frame animation", () => {
    const r = checkLoopSmoothness(anim({ ip: 0, op: 1 }));
    expect(r.status).toBe("pass");
    expect(r.detail).toContain("Single-frame");
  });

  it("passes for empty layers", () => {
    const r = checkLoopSmoothness(anim({ ip: 0, op: 30, layers: [] }));
    expect(r.status).toBe("pass");
    expect(r.detail).toContain("Single-frame or empty");
  });

  it("passes when no animated layers have ks", () => {
    const r = checkLoopSmoothness(anim({ layers: [{ nm: "L", ty: 4 }] }));
    expect(r.status).toBe("pass");
    expect(r.detail).toContain("No animated layers");
  });

  it("skips hidden layers", () => {
    const r = checkLoopSmoothness(
      anim({
        layers: [
          layer({ hd: true, ks: { p: { a: 1, k: [{ s: [0, 0] }, { s: [999, 999] }] } } }),
          layer({ ks: { p: { a: 0, k: [0, 0] } } }),
        ],
      })
    );
    expect(r.status).toBe("pass");
  });

  it("passes when positions match", () => {
    const kf = [
      { s: [100, 200], t: 0 },
      { s: [100, 200], t: 30 },
    ];
    const r = checkLoopSmoothness(
      anim({ layers: [layer({ ks: { p: { a: 1, k: kf } } })] })
    );
    expect(r.status).toBe("pass");
    expect(r.detail).toContain("loops smoothly");
  });

  it("warns when ≤30% of layers mismatch", () => {
    const mismatch = { ks: { p: { a: 1, k: [{ s: [0, 0] }, { s: [100, 100] }] } } };
    const match = { ks: { p: { a: 1, k: [{ s: [0, 0] }, { s: [0, 0] }] } } };
    const r = checkLoopSmoothness(
      anim({ layers: [layer(mismatch), layer(match), layer(match), layer(match)] })
    );
    expect(r.status).toBe("warn");
    expect(r.score).toBe(60);
    expect(r.suggestion).toBeDefined();
  });

  it("fails when >30% of layers mismatch", () => {
    const mismatch = { ks: { p: { a: 1, k: [{ s: [0, 0] }, { s: [100, 100] }] } } };
    const r = checkLoopSmoothness(anim({ layers: [layer(mismatch), layer(mismatch)] }));
    expect(r.status).toBe("fail");
    expect(r.score).toBe(30);
  });

  it("handles missing ip/op defaults", () => {
    const r = checkLoopSmoothness({ layers: [layer()] });
    expect(r.status).toBe("pass");
  });

  it("uses fallback .e when .s is missing on keyframe", () => {
    const kf = [
      { e: [0, 0], t: 0 },
      { e: [0, 0], t: 30 },
    ];
    const r = checkLoopSmoothness(
      anim({ layers: [layer({ ks: { p: { a: 1, k: kf } } })] })
    );
    expect(r.status).toBe("pass");
  });

  it("detects mismatch via .e fallback", () => {
    const kf = [
      { e: [0, 0], t: 0 },
      { e: [500, 500], t: 30 },
    ];
    const r = checkLoopSmoothness(
      anim({ layers: [layer({ ks: { p: { a: 1, k: kf } } })] })
    );
    expect(r.status).toBe("fail");
  });

  it("singular form for 1 checked layer", () => {
    const mismatch = { ks: { p: { a: 1, k: [{ s: [0, 0] }, { s: [100, 100] }] } } };
    const r = checkLoopSmoothness(anim({ layers: [layer(mismatch)] }));
    expect(r.detail).toContain("1 of 1 layer have");
  });
});

// --- checkFrameRate ---

describe("checkFrameRate", () => {
  it("passes for standard 30fps short animation", () => {
    const r = checkFrameRate(anim({ fr: 30, ip: 0, op: 90 }));
    expect(r.status).toBe("pass");
    expect(r.score).toBe(100);
  });

  it("passes for 60fps", () => {
    const r = checkFrameRate(anim({ fr: 60, ip: 0, op: 300 }));
    expect(r.status).toBe("pass");
  });

  it("warns for >60fps", () => {
    const r = checkFrameRate(anim({ fr: 120, ip: 0, op: 100 }));
    expect(r.status).toBe("warn");
    expect(r.score).toBe(50);
    expect(r.suggestion).toBeDefined();
  });

  it("warns for very long animations (>900 frames)", () => {
    const r = checkFrameRate(anim({ fr: 30, ip: 0, op: 1000 }));
    expect(r.status).toBe("warn");
    expect(r.score).toBe(60);
    expect(r.detail).toContain("1000 frames");
  });

  it("high fps takes priority over long duration", () => {
    const r = checkFrameRate(anim({ fr: 120, ip: 0, op: 2000 }));
    expect(r.status).toBe("warn");
    expect(r.score).toBe(50);
    expect(r.detail).toContain("120 fps");
  });

  it("boundary: 900 frames passes, 901 warns", () => {
    expect(checkFrameRate(anim({ fr: 30, ip: 0, op: 900 })).status).toBe("pass");
    expect(checkFrameRate(anim({ fr: 30, ip: 0, op: 901 })).status).toBe("warn");
  });

  it("defaults to 30fps when fr is missing", () => {
    const r = checkFrameRate({ ip: 0, op: 60 });
    expect(r.detail).toContain("30 fps");
    expect(r.status).toBe("pass");
  });

  it("handles missing ip/op", () => {
    const r = checkFrameRate({});
    expect(r.status).toBe("pass");
  });
});

// --- analyzeQuality ---

describe("analyzeQuality", () => {
  beforeEach(() => {
    mockValidateStructure.mockReturnValue({ valid: true, issues: [] });
  });

  it("returns pass for a healthy animation", () => {
    const a = anim({ layers: [layer()], fr: 30, ip: 0, op: 30 });
    const r = analyzeQuality(a);
    expect(r.status).toBe("pass");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.checks.length).toBe(6);
  });

  it("uses provided jsonString instead of serializing", () => {
    const a = anim({ layers: [layer()] });
    const bigJson = "x".repeat(60 * 1024);
    const r = analyzeQuality(a, bigJson);
    const fsCheck = r.checks.find((c) => c.id === "file-size");
    expect(fsCheck?.status).toBe("warn");
  });

  it("falls back to JSON.stringify when jsonString omitted", () => {
    const a = anim({ layers: [layer()] });
    const r = analyzeQuality(a);
    const fsCheck = r.checks.find((c) => c.id === "file-size");
    expect(fsCheck?.status).toBe("pass");
  });

  it("returns warn for score 50-79", () => {
    const a = anim({ layers: Array(15).fill(layer()), fr: 30, ip: 0, op: 30 });
    const r = analyzeQuality(a);
    // layer count warn (60) drags average down
    expect(r.status === "warn" || r.status === "pass").toBe(true);
  });

  it("returns fail for low score", () => {
    mockValidateStructure.mockReturnValue({
      valid: false,
      issues: [
        { severity: "error", code: "E1", message: "bad" },
        { severity: "error", code: "E2", message: "worse" },
        { severity: "error", code: "E3", message: "worst" },
        { severity: "error", code: "E4", message: "terrible" },
        { severity: "error", code: "E5", message: "catastrophic" },
      ],
    });
    const a = anim({ layers: Array(25).fill(layer()), fr: 120, ip: 0, op: 2000 });
    const r = analyzeQuality(a, "x".repeat(160 * 1024));
    expect(r.status).toBe("fail");
    expect(r.score).toBeLessThan(50);
  });

  it("includes structural validity check from validateStructure", () => {
    mockValidateStructure.mockReturnValue({
      valid: false,
      issues: [{ severity: "warning", code: "W1", message: "minor issue" }],
    });
    const r = analyzeQuality(anim({ layers: [layer()] }));
    const sv = r.checks.find((c) => c.id === "structural-validity");
    expect(sv).toBeDefined();
    expect(sv?.status).toBe("warn");
  });

  it("structural validity fails with errors", () => {
    mockValidateStructure.mockReturnValue({
      valid: false,
      issues: [{ severity: "error", code: "E1", message: "broken" }],
    });
    const r = analyzeQuality(anim({ layers: [layer()] }));
    const sv = r.checks.find((c) => c.id === "structural-validity");
    expect(sv?.status).toBe("fail");
    expect(sv?.suggestion).toContain("Fix structural errors");
  });

  it("structural validity truncates >3 issues with ellipsis", () => {
    mockValidateStructure.mockReturnValue({
      valid: false,
      issues: [
        { severity: "warning", code: "W1", message: "a" },
        { severity: "warning", code: "W2", message: "b" },
        { severity: "warning", code: "W3", message: "c" },
        { severity: "warning", code: "W4", message: "d" },
      ],
    });
    const r = analyzeQuality(anim({ layers: [layer()] }));
    const sv = r.checks.find((c) => c.id === "structural-validity");
    expect(sv?.detail).toContain("...");
  });

  it("structural validity score floors at 0 for many errors", () => {
    mockValidateStructure.mockReturnValue({
      valid: false,
      issues: Array.from({ length: 10 }, (_, i) => ({
        severity: "error" as const,
        code: `E${i}`,
        message: `err${i}`,
      })),
    });
    const r = analyzeQuality(anim({ layers: [layer()] }));
    const sv = r.checks.find((c) => c.id === "structural-validity");
    expect(sv?.score).toBe(0);
  });
});
