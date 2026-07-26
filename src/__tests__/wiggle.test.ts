import { describe, it, expect } from "vitest";
import { parseCommand } from "@/lib/commands";
import {
  generateWiggleKeyframes,
  resolveWiggleOptions,
  WiggleOptions,
  VALID_WIGGLE_PROPERTIES,
} from "@/lib/wiggle";

describe("generateWiggleKeyframes", () => {
  const defaultOpts: WiggleOptions = { freq: 3, amp: 20, smooth: true, seed: 42 };

  it("generates keyframes spanning the frame range", () => {
    const kfs = generateWiggleKeyframes("position", defaultOpts, 0, 90, 30);
    expect(kfs[0].t).toBe(0);
    expect(kfs[kfs.length - 1].t).toBe(90);
  });

  it("number of keyframes matches frequency * duration + 1", () => {
    const kfs = generateWiggleKeyframes("rotation", defaultOpts, 0, 90, 30);
    // duration = 90/30 = 3s, freq=3 → 9+1=10
    expect(kfs.length).toBe(10);
  });

  it("smooth mode adds bezier handles", () => {
    const kfs = generateWiggleKeyframes("position", defaultOpts, 0, 60, 30);
    expect(kfs[0].o).toBeDefined();
    expect(kfs[0].i).toBeDefined();
    // last keyframe should not have handles
    expect(kfs[kfs.length - 1].o).toBeUndefined();
  });

  it("non-smooth mode omits bezier handles", () => {
    const opts: WiggleOptions = { ...defaultOpts, smooth: false };
    const kfs = generateWiggleKeyframes("position", opts, 0, 60, 30);
    expect(kfs[0].o).toBeUndefined();
  });

  it("position wiggle produces [x, y] values", () => {
    const kfs = generateWiggleKeyframes("position", defaultOpts, 0, 60, 30);
    for (const kf of kfs) {
      expect(kf.s).toHaveLength(2);
    }
  });

  it("rotation wiggle produces single-element arrays", () => {
    const kfs = generateWiggleKeyframes("rotation", { ...defaultOpts, amp: 15 }, 0, 60, 30);
    for (const kf of kfs) {
      expect(kf.s).toHaveLength(1);
    }
  });

  it("scale wiggle produces [x, y] values", () => {
    const kfs = generateWiggleKeyframes("scale", { ...defaultOpts, amp: 10 }, 0, 60, 30);
    for (const kf of kfs) {
      expect(kf.s).toHaveLength(2);
    }
  });

  it("opacity wiggle clamps values between 0 and 100", () => {
    const opts: WiggleOptions = { freq: 3, amp: 200, smooth: true, seed: 42 };
    const kfs = generateWiggleKeyframes("opacity", opts, 0, 60, 30);
    for (const kf of kfs) {
      expect(kf.s[0]).toBeGreaterThanOrEqual(0);
      expect(kf.s[0]).toBeLessThanOrEqual(100);
    }
  });

  it("same seed produces identical results", () => {
    const a = generateWiggleKeyframes("position", defaultOpts, 0, 60, 30);
    const b = generateWiggleKeyframes("position", defaultOpts, 0, 60, 30);
    expect(a).toEqual(b);
  });

  it("different seeds produce different results", () => {
    const a = generateWiggleKeyframes("position", defaultOpts, 0, 60, 30);
    const b = generateWiggleKeyframes("position", { ...defaultOpts, seed: 99 }, 0, 60, 30);
    expect(a).not.toEqual(b);
  });

  it("uses base value when provided", () => {
    const kfs = generateWiggleKeyframes("position", defaultOpts, 0, 60, 30, [500, 500]);
    for (const kf of kfs) {
      expect(kf.s[0]).toBeGreaterThan(400);
      expect(kf.s[0]).toBeLessThan(600);
    }
  });

  it("handles minimum 2 keyframes for very short durations", () => {
    const opts: WiggleOptions = { freq: 1, amp: 20, smooth: true, seed: 42 };
    const kfs = generateWiggleKeyframes("position", opts, 0, 5, 30);
    expect(kfs.length).toBeGreaterThanOrEqual(2);
  });

  it("amplitude controls range of values for rotation", () => {
    const smallAmp: WiggleOptions = { freq: 3, amp: 5, smooth: true, seed: 42 };
    const largeAmp: WiggleOptions = { freq: 3, amp: 50, smooth: true, seed: 42 };
    const small = generateWiggleKeyframes("rotation", smallAmp, 0, 60, 30);
    const large = generateWiggleKeyframes("rotation", largeAmp, 0, 60, 30);
    const smallRange = Math.max(...small.map(k => Math.abs(k.s[0])));
    const largeRange = Math.max(...large.map(k => Math.abs(k.s[0])));
    expect(largeRange).toBeGreaterThan(smallRange);
  });
});

describe("resolveWiggleOptions", () => {
  it("uses defaults when no options provided", () => {
    const opts = resolveWiggleOptions({}, "position");
    expect(opts.freq).toBe(3);
    expect(opts.amp).toBe(20);
    expect(opts.smooth).toBe(true);
    expect(opts.seed).toBe(42);
  });

  it("uses property-specific default amplitudes", () => {
    expect(resolveWiggleOptions({}, "position").amp).toBe(20);
    expect(resolveWiggleOptions({}, "rotation").amp).toBe(15);
    expect(resolveWiggleOptions({}, "scale").amp).toBe(10);
    expect(resolveWiggleOptions({}, "opacity").amp).toBe(20);
  });

  it("overrides defaults with provided values", () => {
    const opts = resolveWiggleOptions({ freq: 5, amp: 50, smooth: false, seed: 123 }, "position");
    expect(opts.freq).toBe(5);
    expect(opts.amp).toBe(50);
    expect(opts.smooth).toBe(false);
    expect(opts.seed).toBe(123);
  });
});

describe("parseCommand /wiggle", () => {
  it("parses basic wiggle command", () => {
    const result = parseCommand("/wiggle");
    expect(result).toEqual({ type: "wiggle", options: {} });
  });

  it("parses --freq option", () => {
    const result = parseCommand("/wiggle --freq 5");
    expect(result).toHaveProperty("type", "wiggle");
    if (result?.type === "wiggle") {
      expect(result.options.freq).toBe(5);
    }
  });

  it("parses --amp option", () => {
    const result = parseCommand("/wiggle --amp 30");
    if (result?.type === "wiggle") {
      expect(result.options.amp).toBe(30);
    }
  });

  it("parses --smooth flag", () => {
    const result = parseCommand("/wiggle --smooth");
    if (result?.type === "wiggle") {
      expect(result.options.smooth).toBe(true);
    }
  });

  it("parses --no-smooth flag", () => {
    const result = parseCommand("/wiggle --no-smooth");
    if (result?.type === "wiggle") {
      expect(result.options.smooth).toBe(false);
    }
  });

  it("parses --layer option", () => {
    const result = parseCommand("/wiggle --layer MyLayer");
    if (result?.type === "wiggle") {
      expect(result.options.layer).toBe("MyLayer");
    }
  });

  it("parses --property option", () => {
    const result = parseCommand("/wiggle --property rotation");
    if (result?.type === "wiggle") {
      expect(result.options.property).toBe("rotation");
    }
  });

  it("parses --seed option", () => {
    const result = parseCommand("/wiggle --seed 123");
    if (result?.type === "wiggle") {
      expect(result.options.seed).toBe(123);
    }
  });

  it("returns error for invalid property", () => {
    const result = parseCommand("/wiggle --property invalid");
    expect(result?.type).toBe("error");
  });

  it("returns error for invalid freq", () => {
    const result = parseCommand("/wiggle --freq -1");
    expect(result?.type).toBe("error");
  });

  it("returns error for invalid amp", () => {
    const result = parseCommand("/wiggle --amp abc");
    expect(result?.type).toBe("error");
  });

  it("returns error for invalid seed", () => {
    const result = parseCommand("/wiggle --seed abc");
    expect(result?.type).toBe("error");
  });

  it("parses all options together", () => {
    const result = parseCommand("/wiggle --freq 2 --amp 10 --smooth --layer bg --property scale --seed 7");
    if (result?.type === "wiggle") {
      expect(result.options.freq).toBe(2);
      expect(result.options.amp).toBe(10);
      expect(result.options.smooth).toBe(true);
      expect(result.options.layer).toBe("bg");
      expect(result.options.property).toBe("scale");
      expect(result.options.seed).toBe(7);
    }
  });
});
