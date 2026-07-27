import { describe, it, expect } from "vitest";
import { parseCommand } from "@/lib/commands";
import { generateTrail, TrailOptions } from "@/lib/trail";

function makeLottie(layers: object[] = []) {
  return {
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers,
  };
}

function makeLayer(name: string, opts?: { keyframes?: boolean; ip?: number; shapes?: object[] }) {
  const layer: Record<string, unknown> = {
    nm: name,
    ty: 4,
    ip: opts?.ip ?? 0,
    op: 60,
    ks: {
      p: opts?.keyframes ? { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 30, s: [100, 100] }] } : { a: 0, k: [0, 0] },
      o: { a: 0, k: 100 },
      s: { a: 0, k: [100, 100, 100] },
    },
  };
  if (opts?.shapes) {
    layer.shapes = opts.shapes;
  }
  return layer;
}

describe("parseCommand /trail", () => {
  it("parses with defaults", () => {
    const cmd = parseCommand("/trail");
    expect(cmd).toEqual({ type: "trail", options: { count: 5, fade: "exponential", scale: false } });
  });

  it("parses custom count", () => {
    const cmd = parseCommand("/trail 3");
    expect(cmd).toMatchObject({ type: "trail", options: { count: 3 } });
  });

  it("clamps count to 1-10", () => {
    expect(parseCommand("/trail 0")).toMatchObject({ options: { count: 1 } });
    expect(parseCommand("/trail 20")).toMatchObject({ options: { count: 10 } });
  });

  it("parses fade mode", () => {
    const cmd = parseCommand("/trail --fade linear");
    expect(cmd).toMatchObject({ options: { fade: "linear" } });
  });

  it("rejects invalid fade mode", () => {
    const cmd = parseCommand("/trail --fade invalid");
    expect(cmd).toMatchObject({ type: "error" });
  });

  it("parses spacing", () => {
    const cmd = parseCommand("/trail --spacing 5");
    expect(cmd).toMatchObject({ options: { spacing: 5 } });
  });

  it("parses layer", () => {
    const cmd = parseCommand("/trail --layer myLayer");
    expect(cmd).toMatchObject({ options: { layer: "myLayer" } });
  });

  it("parses color", () => {
    const cmd = parseCommand("/trail --color #ff0000");
    expect(cmd).toMatchObject({ options: { color: "#ff0000" } });
  });

  it("parses scale flag", () => {
    const cmd = parseCommand("/trail --scale");
    expect(cmd).toMatchObject({ options: { scale: true } });
  });

  it("parses all options together", () => {
    const cmd = parseCommand("/trail 3 --fade stepped --spacing 4 --layer bg --color #00ff00 --scale");
    expect(cmd).toEqual({
      type: "trail",
      options: { count: 3, fade: "stepped", spacing: 4, layer: "bg", color: "#00ff00", scale: true },
    });
  });
});

describe("generateTrail", () => {
  it("returns unmodified JSON when no layers", () => {
    const lottie = makeLottie([]);
    const result = generateTrail(lottie, { count: 5, fade: "exponential", scale: false }) as typeof lottie;
    expect(result.layers).toHaveLength(0);
  });

  it("creates default 5 trail copies", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 5, fade: "exponential", scale: false }) as typeof lottie;
    expect(result.layers).toHaveLength(6);
  });

  it("trail copies are named correctly", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 3, fade: "exponential", scale: false }) as typeof lottie;
    expect(result.layers[1].nm).toBe("ball_trail_1");
    expect(result.layers[2].nm).toBe("ball_trail_2");
    expect(result.layers[3].nm).toBe("ball_trail_3");
  });

  it("offsets in-points by spacing", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 3, fade: "exponential", spacing: 5, scale: false }) as typeof lottie;
    expect(result.layers[1].ip).toBe(5);
    expect(result.layers[2].ip).toBe(10);
    expect(result.layers[3].ip).toBe(15);
  });

  it("auto-calculates spacing from duration", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 3, fade: "exponential", scale: false }) as typeof lottie;
    // totalDuration=60, spacing = 60/(3+1) = 15
    expect(result.layers[1].ip).toBe(15);
    expect(result.layers[2].ip).toBe(30);
  });

  it("applies exponential fade", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 3, fade: "exponential", scale: false }) as typeof lottie;
    const o1 = (result.layers[1] as any).ks.o.k;
    const o2 = (result.layers[2] as any).ks.o.k;
    const o3 = (result.layers[3] as any).ks.o.k;
    expect(o1).toBe(50); // 0.5^1 * 100
    expect(o2).toBe(25); // 0.5^2 * 100
    expect(o3).toBeCloseTo(12.5); // 0.5^3 * 100
  });

  it("applies linear fade", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 4, fade: "linear", scale: false }) as typeof lottie;
    const o1 = (result.layers[1] as any).ks.o.k;
    expect(o1).toBe(75); // (1 - 1/4) * 100
  });

  it("applies stepped fade", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 4, fade: "stepped", scale: false }) as typeof lottie;
    const o1 = (result.layers[1] as any).ks.o.k;
    const o3 = (result.layers[3] as any).ks.o.k;
    expect(o1).toBe(50); // i=1 < 4/2
    expect(o3).toBe(20); // i=3 >= 4/2
  });

  it("applies progressive scale", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 5, fade: "exponential", scale: true }) as typeof lottie;
    const s1 = (result.layers[1] as any).ks.s.k;
    const s5 = (result.layers[5] as any).ks.s.k;
    expect(s1[0]).toBe(92); // 100 - 40*1/5
    expect(s5[0]).toBe(60); // 100 - 40*5/5
  });

  it("targets layer by name", () => {
    const lottie = makeLottie([makeLayer("bg"), makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 2, fade: "exponential", scale: false, layer: "ball" }) as typeof lottie;
    expect(result.layers).toHaveLength(4);
    expect(result.layers[2].nm).toBe("ball_trail_1");
  });

  it("returns unmodified when target layer not found", () => {
    const lottie = makeLottie([makeLayer("ball", { keyframes: true })]);
    const result = generateTrail(lottie, { count: 3, fade: "exponential", scale: false, layer: "nonexistent" }) as typeof lottie;
    expect(result.layers).toHaveLength(1);
  });

  it("applies color tint to shapes", () => {
    const shapes = [{ ty: "gr", it: [{ ty: "fl", c: { a: 0, k: [1, 1, 1, 1] } }] }];
    const lottie = makeLottie([makeLayer("ball", { keyframes: true, shapes })]);
    const result = generateTrail(lottie, { count: 1, fade: "exponential", scale: false, color: "#ff0000" }) as typeof lottie;
    const fill = (result.layers[1] as any).shapes[0].it[0].c.k;
    expect(fill[0]).toBeCloseTo(1);
    expect(fill[1]).toBeCloseTo(0);
    expect(fill[2]).toBeCloseTo(0);
  });

  it("works with single layer without keyframes (falls back to last layer)", () => {
    const lottie = makeLottie([makeLayer("static")]);
    const result = generateTrail(lottie, { count: 2, fade: "linear", scale: false }) as typeof lottie;
    expect(result.layers).toHaveLength(3);
  });
});
