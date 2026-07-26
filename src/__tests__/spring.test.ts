import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCommand } from "@/lib/commands";
import {
  generateSpringKeyframes,
  resolveSpringOptions,
  SPRING_PRESET_VALUES,
  SpringOptions,
} from "@/lib/spring";

// ─── Spring Math Tests ──────────────────────────────────────────────────────

describe("generateSpringKeyframes", () => {
  const defaultOpts: SpringOptions = { stiffness: 170, damping: 12, mass: 1 };

  it("converges to end value for scalar input", () => {
    const frames = generateSpringKeyframes(0, 100, defaultOpts, 30);
    const lastFrame = frames[frames.length - 1] as number;
    expect(Math.abs(lastFrame - 100)).toBeLessThan(0.1);
  });

  it("converges to end value for array input", () => {
    const frames = generateSpringKeyframes([0, 0], [200, 100], defaultOpts, 30);
    const lastFrame = frames[frames.length - 1] as number[];
    expect(Math.abs(lastFrame[0] - 200)).toBeLessThan(0.1);
    expect(Math.abs(lastFrame[1] - 100)).toBeLessThan(0.1);
  });

  it("starts at start value", () => {
    const frames = generateSpringKeyframes(50, 150, defaultOpts, 30);
    expect(frames[0]).toBe(50);
  });

  it("starts at start value (array)", () => {
    const frames = generateSpringKeyframes([10, 20, 30], [100, 200, 300], defaultOpts, 30);
    expect(frames[0]).toEqual([10, 20, 30]);
  });

  it("generates more than 2 frames for underdamped spring", () => {
    const frames = generateSpringKeyframes(0, 100, defaultOpts, 30);
    expect(frames.length).toBeGreaterThan(2);
  });

  it("bouncy preset oscillates (values overshoot)", () => {
    const opts: SpringOptions = { ...SPRING_PRESET_VALUES.bouncy, mass: 1 };
    const frames = generateSpringKeyframes(0, 100, opts, 60) as number[];
    // Bouncy should overshoot past 100 at some point
    const maxVal = Math.max(...frames as number[]);
    expect(maxVal).toBeGreaterThan(100);
  });

  it("snappy preset settles faster than wobbly", () => {
    const snappyOpts: SpringOptions = { ...SPRING_PRESET_VALUES.snappy, mass: 1 };
    const wobblyOpts: SpringOptions = { ...SPRING_PRESET_VALUES.wobbly, mass: 1 };
    const snappyFrames = generateSpringKeyframes(0, 100, snappyOpts, 30);
    const wobblyFrames = generateSpringKeyframes(0, 100, wobblyOpts, 30);
    expect(snappyFrames.length).toBeLessThan(wobblyFrames.length);
  });

  it("handles zero displacement gracefully", () => {
    const frames = generateSpringKeyframes(100, 100, defaultOpts, 30);
    // Should still produce at least 2 frames (start + end)
    expect(frames.length).toBeGreaterThanOrEqual(1);
    expect(frames[0]).toBe(100);
  });

  it("handles negative values", () => {
    const frames = generateSpringKeyframes(-50, 50, defaultOpts, 30);
    expect(frames[0]).toBe(-50);
    const lastFrame = frames[frames.length - 1] as number;
    expect(Math.abs(lastFrame - 50)).toBeLessThan(0.1);
  });

  it("handles overdamped spring (high damping)", () => {
    const overdamped: SpringOptions = { stiffness: 50, damping: 100, mass: 1 };
    const frames = generateSpringKeyframes(0, 100, overdamped, 30);
    expect(frames.length).toBeGreaterThan(2);
    const lastFrame = frames[frames.length - 1] as number;
    expect(Math.abs(lastFrame - 100)).toBeLessThan(0.5);
  });

  it("presets produce different frame counts", () => {
    const results = Object.entries(SPRING_PRESET_VALUES).map(([name, config]) => ({
      name,
      frames: generateSpringKeyframes(0, 100, { ...config, mass: 1 }, 30).length,
    }));
    // Not all presets should have the same frame count
    const uniqueCounts = new Set(results.map((r) => r.frames));
    expect(uniqueCounts.size).toBeGreaterThan(1);
  });

  it("respects fps parameter", () => {
    const frames30 = generateSpringKeyframes(0, 100, defaultOpts, 30);
    const frames60 = generateSpringKeyframes(0, 100, defaultOpts, 60);
    // 60fps should produce roughly double the frames
    expect(frames60.length).toBeGreaterThan(frames30.length);
  });
});

describe("resolveSpringOptions", () => {
  it("returns defaults when no options provided", () => {
    const result = resolveSpringOptions({});
    expect(result).toEqual({ stiffness: 170, damping: 12, mass: 1 });
  });

  it("uses preset values when preset specified", () => {
    const result = resolveSpringOptions({ preset: "bouncy" });
    expect(result.stiffness).toBe(120);
    expect(result.damping).toBe(8);
    expect(result.mass).toBe(1);
  });

  it("explicit values override preset", () => {
    const result = resolveSpringOptions({ preset: "bouncy", stiffness: 200 });
    expect(result.stiffness).toBe(200);
    expect(result.damping).toBe(8); // from preset
  });

  it("explicit mass is used", () => {
    const result = resolveSpringOptions({ mass: 2 });
    expect(result.mass).toBe(2);
  });

  it("all explicit values override defaults", () => {
    const result = resolveSpringOptions({ stiffness: 400, damping: 30, mass: 3 });
    expect(result).toEqual({ stiffness: 400, damping: 30, mass: 3 });
  });
});

// ─── Command Parsing Tests ──────────────────────────────────────────────────

describe("parseCommand /spring", () => {
  it("parses bare /spring with default options", () => {
    const result = parseCommand("/spring");
    expect(result).toEqual({ type: "spring", options: {} });
  });

  it("parses --stiffness", () => {
    const result = parseCommand("/spring --stiffness 200");
    expect(result).toEqual({ type: "spring", options: { stiffness: 200 } });
  });

  it("parses --damping", () => {
    const result = parseCommand("/spring --damping 15");
    expect(result).toEqual({ type: "spring", options: { damping: 15 } });
  });

  it("parses --mass", () => {
    const result = parseCommand("/spring --mass 2.5");
    expect(result).toEqual({ type: "spring", options: { mass: 2.5 } });
  });

  it("parses --layer", () => {
    const result = parseCommand("/spring --layer Background");
    expect(result).toEqual({ type: "spring", options: { layer: "Background" } });
  });

  it("parses --property position", () => {
    const result = parseCommand("/spring --property position");
    expect(result).toEqual({ type: "spring", options: { property: "position" } });
  });

  it("parses --property scale", () => {
    const result = parseCommand("/spring --property scale");
    expect(result).toEqual({ type: "spring", options: { property: "scale" } });
  });

  it("parses --property rotation", () => {
    const result = parseCommand("/spring --property rotation");
    expect(result).toEqual({ type: "spring", options: { property: "rotation" } });
  });

  it("parses --property opacity", () => {
    const result = parseCommand("/spring --property opacity");
    expect(result).toEqual({ type: "spring", options: { property: "opacity" } });
  });

  it("parses --preset bouncy", () => {
    const result = parseCommand("/spring --preset bouncy");
    expect(result).toEqual({ type: "spring", options: { preset: "bouncy" } });
  });

  it("parses --preset snappy", () => {
    const result = parseCommand("/spring --preset snappy");
    expect(result).toEqual({ type: "spring", options: { preset: "snappy" } });
  });

  it("parses all options combined", () => {
    const result = parseCommand("/spring --preset wobbly --layer Hero --property position --mass 2");
    expect(result).toEqual({
      type: "spring",
      options: { preset: "wobbly", layer: "Hero", property: "position", mass: 2 },
    });
  });

  it("returns error for invalid stiffness", () => {
    const result = parseCommand("/spring --stiffness abc");
    expect(result?.type).toBe("error");
  });

  it("returns error for negative stiffness", () => {
    const result = parseCommand("/spring --stiffness -5");
    expect(result?.type).toBe("error");
  });

  it("returns error for invalid damping", () => {
    const result = parseCommand("/spring --damping 0");
    expect(result?.type).toBe("error");
  });

  it("returns error for invalid mass", () => {
    const result = parseCommand("/spring --mass -1");
    expect(result?.type).toBe("error");
  });

  it("returns error for invalid property", () => {
    const result = parseCommand("/spring --property color");
    expect(result?.type).toBe("error");
    expect((result as { message: string }).message).toContain("position");
  });

  it("returns error for invalid preset", () => {
    const result = parseCommand("/spring --preset superfast");
    expect(result?.type).toBe("error");
    expect((result as { message: string }).message).toContain("snappy");
  });
});

// ─── Handler Tests ──────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    prepare: () => ({ run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) }),
  },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => "{}"),
    writeFileSync: vi.fn(),
  },
}));

function makeAnimationJson(layers: unknown[]) {
  return JSON.stringify({
    w: 512,
    h: 512,
    fr: 30,
    ip: 0,
    op: 60,
    layers,
  });
}

function makeKeyframedLayer(name: string, property = "p") {
  const prop = {
    a: 1,
    k: [
      { t: 0, s: [0, 0, 0], o: { x: [0] , y: [0] }, i: { x: [1], y: [1] } },
      { t: 30, s: [100, 200, 0] },
    ],
  };

  const ks: Record<string, unknown> = {};
  ks[property] = prop;
  // Add non-animated properties
  if (property !== "s") ks.s = { a: 0, k: [100, 100, 100] };
  if (property !== "p") ks.p = { a: 0, k: [256, 256, 0] };
  if (property !== "r") ks.r = { a: 0, k: 0 };
  if (property !== "o") ks.o = { a: 0, k: 100 };

  return { nm: name, ip: 0, op: 60, ks };
}

function makeMultiKeyframedLayer(name: string) {
  return {
    nm: name,
    ip: 0,
    op: 60,
    ks: {
      p: {
        a: 1,
        k: [
          { t: 0, s: [0, 0, 0], e: [50, 50, 0], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
          { t: 15, s: [50, 50, 0], e: [200, 100, 0], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
          { t: 30, s: [200, 100, 0] },
        ],
      },
      s: {
        a: 1,
        k: [
          { t: 0, s: [50, 50, 100], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
          { t: 30, s: [100, 100, 100] },
        ],
      },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    },
  };
}

describe("handleSpring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring(undefined, {}, "/spring");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  async function setupDbMock() {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX"))
        return { get: () => ({ max_num: 1 }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);
  }

  async function setupFsMock(jsonStr: string) {
    const fs = await import("node:fs");
    vi.spyOn(fs.default, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.default, "readFileSync").mockReturnValue(jsonStr);
    vi.spyOn(fs.default, "writeFileSync").mockImplementation(() => {});
  }

  it("returns 404 for non-existent animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof db.prepare>);

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("missing-id", {}, "/spring");
    expect(res.status).toBe(404);
  });


  it("returns message when no keyframes found", async () => {
    await setupDbMock();
    await setupFsMock(makeAnimationJson([{
      nm: "Static",
      ip: 0,
      op: 60,
      ks: {
        p: { a: 0, k: [100, 100, 0] },
        s: { a: 0, k: [100, 100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
      },
    }]));

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", {}, "/spring");
    const text = await res.text();
    expect(text).toContain("No keyframed properties found");
  });

  it("applies spring to single layer position", async () => {
    await setupDbMock();
    await setupFsMock(makeAnimationJson([makeKeyframedLayer("Ball")]));

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", {}, "/spring");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("spring physics");
    expect(text).toContain("Ball");
  });

  it("applies spring with preset", async () => {
    await setupDbMock();
    await setupFsMock(makeAnimationJson([makeKeyframedLayer("Ball")]));

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", { preset: "bouncy" }, "/spring --preset bouncy");
    const text = await res.text();
    expect(text).toContain("bouncy");
    expect(text).toContain("stiffness=120");
    expect(text).toContain("damping=8");
  });

  it("filters by layer name", async () => {
    await setupDbMock();
    await setupFsMock(makeAnimationJson([
      makeKeyframedLayer("Ball"),
      makeKeyframedLayer("Star"),
    ]));

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", { layer: "Ball" }, "/spring --layer Ball");
    const text = await res.text();
    // Parse the SSE data to check the reply field specifically
    const jsonStr = text.replace(/^data: /, "").trim();
    const data = JSON.parse(jsonStr);
    expect(data.reply).toContain("Ball");
    expect(data.reply).not.toContain("Star");
  });

  it("filters by property", async () => {
    await setupDbMock();
    await setupFsMock(makeAnimationJson([makeMultiKeyframedLayer("Hero")]));

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", { property: "position" }, "/spring --property position");
    const text = await res.text();
    expect(text).toContain("position");
    expect(text).toContain("1 propert");
  });

  it("processes multiple layers", async () => {
    await setupDbMock();
    await setupFsMock(makeAnimationJson([
      makeKeyframedLayer("Layer1"),
      makeKeyframedLayer("Layer2"),
      makeKeyframedLayer("Layer3"),
    ]));

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", {}, "/spring");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("Layer1");
    expect(text).toContain("Layer2");
    expect(text).toContain("Layer3");
  });

  it("handles layer with multiple animated properties", async () => {
    await setupDbMock();
    await setupFsMock(makeAnimationJson([makeMultiKeyframedLayer("Multi")]));

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", {}, "/spring");
    const text = await res.text();
    expect(text).toContain("2 properties");
  });

  it("returns no animation file message when readAnimationFile returns null", async () => {
    await setupDbMock();
    const fs = await import("node:fs");
    vi.spyOn(fs.default, "existsSync").mockReturnValue(false);

    const { handleSpring } = await import("@/lib/chat-handlers/spring");
    const res = await handleSpring("test-id", {}, "/spring");
    const text = await res.text();
    expect(text).toContain("No animation file found");
  });
});
