import { describe, it, expect } from "vitest";
import {
  analyzeQuality,
  checkFileSize,
  checkLayerCount,
  checkHiddenLayers,
  checkLoopSmoothness,
  checkFrameRate,
} from "../quality";

function makeLottie(overrides: Record<string, unknown> = {}) {
  return {
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers: [
      { nm: "Shape 1", ty: 4, ip: 0, op: 60, ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [256, 256, 0] } } },
    ],
    ...overrides,
  };
}

describe("checkFileSize", () => {
  it("passes for small files", () => {
    const json = JSON.stringify(makeLottie());
    const result = checkFileSize(json);
    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
  });

  it("warns for medium files (50-150KB)", () => {
    // Create a ~60KB string
    const padding = "x".repeat(60 * 1024);
    const json = JSON.stringify({ ...makeLottie(), _padding: padding });
    const result = checkFileSize(json);
    expect(result.status).toBe("warn");
    expect(result.score).toBe(60);
    expect(result.suggestion).toBeDefined();
  });

  it("fails for large files (>150KB)", () => {
    const padding = "x".repeat(160 * 1024);
    const json = JSON.stringify({ ...makeLottie(), _padding: padding });
    const result = checkFileSize(json);
    expect(result.status).toBe("fail");
    expect(result.score).toBe(20);
    expect(result.suggestion).toBeDefined();
  });
});

describe("checkLayerCount", () => {
  it("passes for <10 layers", () => {
    const result = checkLayerCount(makeLottie());
    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
  });

  it("warns for 10-20 layers", () => {
    const layers = Array.from({ length: 15 }, (_, i) => ({
      nm: `Layer ${i}`, ty: 4, ip: 0, op: 60, ks: {},
    }));
    const result = checkLayerCount(makeLottie({ layers }));
    expect(result.status).toBe("warn");
    expect(result.score).toBe(60);
  });

  it("fails for >20 layers", () => {
    const layers = Array.from({ length: 25 }, (_, i) => ({
      nm: `Layer ${i}`, ty: 4, ip: 0, op: 60, ks: {},
    }));
    const result = checkLayerCount(makeLottie({ layers }));
    expect(result.status).toBe("fail");
    expect(result.score).toBe(20);
  });

  it("handles missing layers array", () => {
    const result = checkLayerCount({ fr: 30, ip: 0, op: 60 });
    expect(result.status).toBe("pass");
  });
});

describe("checkHiddenLayers", () => {
  it("passes when no hidden layers", () => {
    const result = checkHiddenLayers(makeLottie());
    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
  });

  it("warns when layers have hd:true", () => {
    const layers = [
      { nm: "Visible", ty: 4, ip: 0, op: 60, ks: {} },
      { nm: "Hidden One", ty: 4, ip: 0, op: 60, hd: true, ks: {} },
    ];
    const result = checkHiddenLayers(makeLottie({ layers }));
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("Hidden One");
  });

  it("warns when layer has zero opacity (static)", () => {
    const layers = [
      { nm: "ZeroOp", ty: 4, ip: 0, op: 60, ks: { o: { a: 0, k: 0 } } },
    ];
    const result = checkHiddenLayers(makeLottie({ layers }));
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("ZeroOp");
  });

  it("passes when opacity is non-zero", () => {
    const layers = [
      { nm: "Visible", ty: 4, ip: 0, op: 60, ks: { o: { a: 0, k: 50 } } },
    ];
    const result = checkHiddenLayers(makeLottie({ layers }));
    expect(result.status).toBe("pass");
  });
});

describe("checkLoopSmoothness", () => {
  it("passes for static animations (no animated position)", () => {
    const result = checkLoopSmoothness(makeLottie());
    expect(result.status).toBe("pass");
  });

  it("passes when first and last keyframes match", () => {
    const layers = [
      {
        nm: "Looper",
        ty: 4,
        ip: 0,
        op: 60,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [100, 100, 0] },
              { t: 30, s: [200, 200, 0] },
              { t: 60, s: [100, 100, 0] },
            ],
          },
        },
      },
    ];
    const result = checkLoopSmoothness(makeLottie({ layers }));
    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
  });

  it("warns/fails when first and last keyframes mismatch", () => {
    const layers = [
      {
        nm: "NoLoop",
        ty: 4,
        ip: 0,
        op: 60,
        ks: {
          p: {
            a: 1,
            k: [
              { t: 0, s: [0, 0, 0] },
              { t: 60, s: [500, 500, 0] },
            ],
          },
        },
      },
    ];
    const result = checkLoopSmoothness(makeLottie({ layers }));
    expect(result.status).not.toBe("pass");
    expect(result.suggestion).toBeDefined();
  });

  it("skips hidden layers", () => {
    const layers = [
      {
        nm: "Hidden",
        ty: 4,
        ip: 0,
        op: 60,
        hd: true,
        ks: {
          p: { a: 1, k: [{ t: 0, s: [0, 0, 0] }, { t: 60, s: [999, 999, 0] }] },
        },
      },
    ];
    const result = checkLoopSmoothness(makeLottie({ layers }));
    expect(result.status).toBe("pass");
  });

  it("handles single-frame animation", () => {
    const result = checkLoopSmoothness(makeLottie({ ip: 0, op: 1 }));
    expect(result.status).toBe("pass");
  });
});

describe("checkFrameRate", () => {
  it("passes for 30fps", () => {
    const result = checkFrameRate(makeLottie({ fr: 30 }));
    expect(result.status).toBe("pass");
    expect(result.score).toBe(100);
  });

  it("passes for 60fps", () => {
    const result = checkFrameRate(makeLottie({ fr: 60 }));
    expect(result.status).toBe("pass");
  });

  it("warns for >60fps", () => {
    const result = checkFrameRate(makeLottie({ fr: 120 }));
    expect(result.status).toBe("warn");
    expect(result.suggestion).toContain("30 or 60");
  });

  it("warns for very long animations", () => {
    const result = checkFrameRate(makeLottie({ fr: 30, ip: 0, op: 1000 }));
    expect(result.status).toBe("warn");
    expect(result.suggestion).toContain("splitting");
  });
});

describe("analyzeQuality", () => {
  it("returns overall score and all checks", () => {
    const anim = makeLottie();
    const result = analyzeQuality(anim);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.checks).toHaveLength(6);
    expect(["pass", "warn", "fail"]).toContain(result.status);
  });

  it("perfect score for minimal animation", () => {
    const anim = makeLottie();
    const result = analyzeQuality(anim);
    expect(result.score).toBe(100);
    expect(result.status).toBe("pass");
  });

  it("lower score for problematic animation", () => {
    const layers = Array.from({ length: 25 }, (_, i) => ({
      nm: `Layer ${i}`, ty: 4, ip: 0, op: 60, hd: i > 20, ks: {},
    }));
    const anim = makeLottie({ layers, fr: 120 });
    const result = analyzeQuality(anim);
    expect(result.score).toBeLessThan(80);
    expect(result.status).not.toBe("pass");
  });

  it("accepts optional jsonString parameter", () => {
    const anim = makeLottie();
    const json = JSON.stringify(anim);
    const result = analyzeQuality(anim, json);
    expect(result.score).toBe(100);
  });
});
