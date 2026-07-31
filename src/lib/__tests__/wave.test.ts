import { describe, it, expect } from "vitest";
import { generateWaveAnimation, WaveOptions, VALID_WAVE_TYPES, VALID_WAVE_DIRECTIONS } from "@/lib/wave";

interface LottieAnim {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  layers: unknown[];
  assets: unknown[];
}

function assertValidLottie(result: unknown): LottieAnim {
  const anim = result as LottieAnim;
  expect(anim.v).toBe("5.7.1");
  expect(anim.fr).toBe(30);
  expect(anim.ip).toBe(0);
  expect(anim.op).toBe(60);
  expect(anim.w).toBe(512);
  expect(anim.h).toBe(512);
  expect(Array.isArray(anim.layers)).toBe(true);
  expect(anim.layers.length).toBeGreaterThan(0);
  expect(Array.isArray(anim.assets)).toBe(true);
  return anim;
}

describe("generateWaveAnimation", () => {
  it("generates valid Lottie with default options", () => {
    const result = generateWaveAnimation({});
    assertValidLottie(result);
  });

  it("defaults to sine type", () => {
    const result = generateWaveAnimation({}) as LottieAnim;
    expect(result.layers.length).toBe(1);
    expect((result.layers[0] as { nm: string }).nm).toBe("Wave");
  });

  describe("sine preset", () => {
    it("produces a single layer with animated shape path", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "sine" }));
      expect(result.layers.length).toBe(1);
    });

    it("respects amplitude option", () => {
      const small = generateWaveAnimation({ type: "sine", amplitude: 10 });
      const large = generateWaveAnimation({ type: "sine", amplitude: 80 });
      expect(JSON.stringify(small)).not.toBe(JSON.stringify(large));
    });

    it("respects frequency option", () => {
      const low = generateWaveAnimation({ type: "sine", frequency: 1 });
      const high = generateWaveAnimation({ type: "sine", frequency: 5 });
      expect(JSON.stringify(low)).not.toBe(JSON.stringify(high));
    });

    it("respects direction option", () => {
      const h = generateWaveAnimation({ type: "sine", direction: "horizontal" });
      const v = generateWaveAnimation({ type: "sine", direction: "vertical" });
      expect(JSON.stringify(h)).not.toBe(JSON.stringify(v));
    });

    it("respects speed option", () => {
      const slow = generateWaveAnimation({ type: "sine", speed: 0.5 });
      const fast = generateWaveAnimation({ type: "sine", speed: 3 });
      expect(JSON.stringify(slow)).not.toBe(JSON.stringify(fast));
    });

    it("respects color option", () => {
      const red = generateWaveAnimation({ type: "sine", color: "#ff0000" });
      const blue = generateWaveAnimation({ type: "sine", color: "#0000ff" });
      expect(JSON.stringify(red)).not.toBe(JSON.stringify(blue));
    });
  });

  describe("ocean preset", () => {
    it("produces multiple layers (default 3)", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "ocean" }));
      expect(result.layers.length).toBe(3);
    });

    it("respects layers option", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "ocean", layers: 5 }));
      expect(result.layers.length).toBe(5);
    });
  });

  describe("flag preset", () => {
    it("produces layers including a pole and flag", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "flag" }));
      expect(result.layers.length).toBe(2);
      const names = result.layers.map((l) => (l as { nm: string }).nm);
      expect(names).toContain("Pole");
      expect(names).toContain("Flag");
    });
  });

  describe("pulse preset", () => {
    it("produces multiple ring layers (default 3)", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "pulse" }));
      expect(result.layers.length).toBe(3);
    });

    it("respects layers option", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "pulse", layers: 5 }));
      expect(result.layers.length).toBe(5);
    });

    it("has animated opacity and scale", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "pulse" }));
      const layer = result.layers[0] as { ks: { o: { a: number }; s: { a: number } } };
      expect(layer.ks.o.a).toBe(1);
      expect(layer.ks.s.a).toBe(1);
    });
  });

  describe("sound preset", () => {
    it("produces bar layers (default 3)", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "sound" }));
      expect(result.layers.length).toBe(3);
    });

    it("respects layers option for bar count", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "sound", layers: 7 }));
      expect(result.layers.length).toBe(7);
    });

    it("supports vertical direction", () => {
      const result = assertValidLottie(generateWaveAnimation({ type: "sound", direction: "vertical" }));
      expect(result.layers.length).toBeGreaterThan(0);
    });
  });

  describe("all presets produce valid output", () => {
    for (const type of VALID_WAVE_TYPES) {
      it(`${type} produces valid Lottie JSON`, () => {
        assertValidLottie(generateWaveAnimation({ type }));
      });
    }
  });

  describe("exports", () => {
    it("exports VALID_WAVE_TYPES", () => {
      expect(VALID_WAVE_TYPES).toEqual(["sine", "ocean", "flag", "pulse", "sound"]);
    });

    it("exports VALID_WAVE_DIRECTIONS", () => {
      expect(VALID_WAVE_DIRECTIONS).toEqual(["horizontal", "vertical"]);
    });
  });

  it("handles invalid color gracefully", () => {
    const result = assertValidLottie(generateWaveAnimation({ type: "sine", color: "not-a-color" }));
    expect(result.layers.length).toBe(1);
  });
});
