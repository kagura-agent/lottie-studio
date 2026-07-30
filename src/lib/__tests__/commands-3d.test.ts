import { describe, it, expect } from "vitest";
import {
  apply3DEffect,
  applyFlip,
  applyTilt,
  applyRotate,
  applyParallax,
  applySwing,
  LottieAnimation3D,
} from "@/lib/threed";

function makeTestAnimation(layerCount = 1): LottieAnimation3D {
  const layers = Array.from({ length: layerCount }, (_, i) => ({
    ty: 4,
    nm: `Layer ${i + 1}`,
    ind: i,
    ip: 0,
    op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] },
    },
    shapes: [],
  }));
  return { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers };
}

describe("applyFlip", () => {
  it("sets ddd=1 and animates ry by default", () => {
    const anim = makeTestAnimation();
    const modified = applyFlip(anim, { effect: "flip" });
    expect(modified).toEqual(["Layer 1"]);
    expect(anim.layers[0].ddd).toBe(1);
    expect(anim.layers[0].ks.ry).toBeDefined();
    const ry = anim.layers[0].ks.ry as { a: number; k: { t: number; s: number[] }[] };
    expect(ry.a).toBe(1);
    expect(ry.k[0].s).toEqual([0]);
    expect(ry.k[2].s).toEqual([180]);
  });

  it("uses x-axis when specified", () => {
    const anim = makeTestAnimation();
    applyFlip(anim, { effect: "flip", axis: "x" });
    expect(anim.layers[0].ks.rx).toBeDefined();
    expect(anim.layers[0].ks.ry).toBeUndefined();
  });

  it("adjusts duration based on option", () => {
    const anim = makeTestAnimation();
    applyFlip(anim, { effect: "flip", duration: 2 });
    expect(anim.op).toBe(60);
  });

  it("swaps opacity at midpoint", () => {
    const anim = makeTestAnimation();
    applyFlip(anim, { effect: "flip" });
    const o = anim.layers[0].ks.o as { a: number; k: { t: number; s: number[] }[] };
    expect(o.a).toBe(1);
    const midKf = o.k.find((kf) => kf.s[0] === 0);
    expect(midKf).toBeDefined();
  });
});

describe("applyTilt", () => {
  it("oscillates on both axes by default", () => {
    const anim = makeTestAnimation();
    const modified = applyTilt(anim, { effect: "tilt" });
    expect(modified).toEqual(["Layer 1"]);
    expect(anim.layers[0].ddd).toBe(1);
    expect(anim.layers[0].ks.rx).toBeDefined();
    expect(anim.layers[0].ks.ry).toBeDefined();
  });

  it("only tilts on x when axis=x", () => {
    const anim = makeTestAnimation();
    applyTilt(anim, { effect: "tilt", axis: "x" });
    expect(anim.layers[0].ks.rx).toBeDefined();
    expect(anim.layers[0].ks.ry).toBeUndefined();
  });

  it("respects custom angle", () => {
    const anim = makeTestAnimation();
    applyTilt(anim, { effect: "tilt", angle: 25, axis: "x" });
    const rx = anim.layers[0].ks.rx as { k: { e: number[] }[] };
    expect(rx.k[0].e).toEqual([25]);
  });
});

describe("applyRotate", () => {
  it("creates continuous rotation on y by default", () => {
    const anim = makeTestAnimation();
    const modified = applyRotate(anim, { effect: "rotate" });
    expect(modified).toEqual(["Layer 1"]);
    expect(anim.layers[0].ddd).toBe(1);
    const ry = anim.layers[0].ks.ry as { k: { s: number[]; e?: number[] }[] };
    expect(ry.k[0].s).toEqual([0]);
    expect(ry.k[0].e).toEqual([360]);
  });

  it("rotates ccw when direction=ccw", () => {
    const anim = makeTestAnimation();
    applyRotate(anim, { effect: "rotate", direction: "ccw" });
    const ry = anim.layers[0].ks.ry as { k: { e?: number[] }[] };
    expect(ry.k[0].e).toEqual([-360]);
  });

  it("uses z-axis when specified", () => {
    const anim = makeTestAnimation();
    applyRotate(anim, { effect: "rotate", axis: "z" });
    expect(anim.layers[0].ks.rz).toBeDefined();
  });

  it("adjusts frames by speed", () => {
    const anim = makeTestAnimation();
    applyRotate(anim, { effect: "rotate", speed: 2 });
    expect(anim.op).toBe(30);
  });
});

describe("applyParallax", () => {
  it("creates multiple depth layers", () => {
    const anim = makeTestAnimation();
    const modified = applyParallax(anim, { effect: "parallax", depth: 4 });
    expect(modified).toHaveLength(4);
    expect(anim.layers).toHaveLength(4);
    for (const layer of anim.layers) {
      expect(layer.ddd).toBe(1);
    }
  });

  it("animates position horizontally by default", () => {
    const anim = makeTestAnimation();
    applyParallax(anim, { effect: "parallax" });
    const p = anim.layers[0].ks.p as { a: number };
    expect(p.a).toBe(1);
  });

  it("animates position vertically when specified", () => {
    const anim = makeTestAnimation();
    applyParallax(anim, { effect: "parallax", direction: "vertical" });
    const p = anim.layers[0].ks.p as { a: number; k: { s: number[] }[] };
    expect(p.k[0].s[0]).toBe(256);
  });
});

describe("applySwing", () => {
  it("creates damped oscillation keyframes", () => {
    const anim = makeTestAnimation();
    const modified = applySwing(anim, { effect: "swing" });
    expect(modified).toEqual(["Layer 1"]);
    expect(anim.layers[0].ddd).toBe(1);
    const rx = anim.layers[0].ks.rx as { k: { t: number; s: number[] }[] };
    expect(rx.k.length).toBeGreaterThan(2);
    expect(rx.k[rx.k.length - 1].s).toEqual([0]);
  });

  it("uses y-axis when specified", () => {
    const anim = makeTestAnimation();
    applySwing(anim, { effect: "swing", axis: "y" });
    expect(anim.layers[0].ks.ry).toBeDefined();
  });

  it("respects custom damping", () => {
    const anim = makeTestAnimation();
    applySwing(anim, { effect: "swing", angle: 40, damping: 0.5 });
    const rx = anim.layers[0].ks.rx as { k: { e?: number[] }[] };
    const firstSwing = Math.abs(rx.k[0].e![0]);
    const secondSwing = Math.abs(rx.k[1].e![0]);
    expect(secondSwing).toBeLessThan(firstSwing);
  });
});

describe("apply3DEffect", () => {
  it("dispatches to the correct effect function", () => {
    const anim = makeTestAnimation();
    apply3DEffect(anim, { effect: "flip" });
    expect(anim.layers[0].ks.ry).toBeDefined();
  });
});
