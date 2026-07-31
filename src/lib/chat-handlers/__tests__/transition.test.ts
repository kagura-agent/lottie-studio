import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    prepare: () => ({ run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) }),
  },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

const baseLottie = {
  v: "5.7.1",
  w: 512,
  h: 512,
  fr: 30,
  ip: 0,
  op: 60,
  layers: [
    { nm: "layer1", ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [256, 256] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } } },
    { nm: "layer2", ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [128, 128] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } } },
  ],
  assets: [],
};

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => JSON.stringify(baseLottie)),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

import { handleTransition } from "../transition";
import { generateTransitionKeyframes, TransitionCommandOptions } from "@/lib/transition";
import { parseCommand } from "@/lib/commands";

function parseData(text: string) {
  const dataLine = text.split("\n").find((l: string) => l.startsWith("data: "));
  return JSON.parse(dataLine!.slice(6));
}

describe("handleTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns message when no animationId", async () => {
    const res = await handleTransition(undefined, { type: "fade" }, "/transition fade");
    const parsed = parseData(await res.text());
    expect(parsed.reply).toContain("Create an animation first");
  });

  it("returns 404 when animation does not exist", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => undefined };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("missing", { type: "fade" }, "/transition fade");
    expect(res.status).toBe(404);
  });

  it("applies fade transition to all layers", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "fade" }, "/transition fade");
    const parsed = parseData(await res.text());
    expect(parsed.reply).toContain("fade");
    expect(parsed.lottieJson.layers[0].ks.o.a).toBe(1);
    expect(parsed.lottieJson.layers[0].ks.o.k.length).toBeGreaterThan(1);
  });

  it("applies slide transition with direction", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "slide", direction: "right" }, "/transition slide --direction right");
    const parsed = parseData(await res.text());
    expect(parsed.reply).toContain("slide");
    expect(parsed.lottieJson.layers[0].ks.p.a).toBe(1);
  });

  it("applies wipe transition with mask", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "wipe", direction: "left" }, "/transition wipe");
    const parsed = parseData(await res.text());
    expect(parsed.lottieJson.layers[0].hasMask).toBe(true);
    expect(parsed.lottieJson.layers[0].masksProperties).toBeDefined();
  });

  it("applies zoom transition to scale", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "zoom" }, "/transition zoom");
    const parsed = parseData(await res.text());
    expect(parsed.lottieJson.layers[0].ks.s.a).toBe(1);
  });

  it("applies flip transition to rotation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "flip", direction: "up" }, "/transition flip --direction up");
    const parsed = parseData(await res.text());
    expect(parsed.lottieJson.layers[0].ks.r.a).toBe(1);
  });

  it("applies dissolve transition to opacity", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "dissolve" }, "/transition dissolve");
    const parsed = parseData(await res.text());
    expect(parsed.lottieJson.layers[0].ks.o.a).toBe(1);
  });

  it("filters by layer name", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "fade", layer: "layer1" }, "/transition fade --layer layer1");
    const parsed = parseData(await res.text());
    expect(parsed.reply).toContain("1 layer");
    expect(parsed.reply).toContain("layer1");
  });

  it("applies stagger offset between layers", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "fade", stagger: 100 }, "/transition fade --stagger 100");
    const parsed = parseData(await res.text());
    const layer1Start = parsed.lottieJson.layers[0].ks.o.k[0].t;
    const layer2Start = parsed.lottieJson.layers[1].ks.o.k[0].t;
    expect(layer2Start).toBeGreaterThan(layer1Start);
  });

  it("respects custom duration", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "fade", duration: 1000 }, "/transition fade --duration 1000");
    const parsed = parseData(await res.text());
    expect(parsed.reply).toContain("duration=1000ms");
  });

  it("returns no-layers message when no layers match", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "fade", layer: "nonexistent" }, "/transition fade --layer nonexistent");
    const parsed = parseData(await res.text());
    expect(parsed.reply).toContain("No layers found");
  });

  it("includes previousLottieJson in response", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const res = await handleTransition("test-id", { type: "fade" }, "/transition fade");
    const parsed = parseData(await res.text());
    expect(parsed.previousLottieJson).toBeDefined();
    expect(parsed.animationId).toBe("test-id");
  });
});

describe("generateTransitionKeyframes", () => {
  it("generates fade keyframes from 0 to 100", () => {
    const kf = generateTransitionKeyframes("fade", { type: "fade" }, 0, 30);
    expect(kf[0].s[0]).toBe(0);
    expect(kf[kf.length - 1].s[0]).toBe(100);
  });

  it("generates slide keyframes ending at 0,0", () => {
    const kf = generateTransitionKeyframes("slide", { type: "slide", direction: "left" }, 0, 30);
    expect(kf[kf.length - 1].s[0]).toBeCloseTo(0);
    expect(kf[kf.length - 1].s[1]).toBeCloseTo(0);
  });

  it("generates zoom keyframes from 0 to 100", () => {
    const kf = generateTransitionKeyframes("zoom", { type: "zoom" }, 0, 30);
    expect(kf[0].s[0]).toBe(0);
    expect(kf[kf.length - 1].s[0]).toBe(100);
  });

  it("generates flip keyframes ending at 0 rotation", () => {
    const kf = generateTransitionKeyframes("flip", { type: "flip", direction: "left" }, 0, 30);
    expect(kf[kf.length - 1].s[0]).toBe(0);
    expect(kf[kf.length - 1].s[1]).toBe(0);
  });

  it("generates dissolve keyframes with opacity and noise", () => {
    const kf = generateTransitionKeyframes("dissolve", { type: "dissolve" }, 0, 30);
    expect(kf[0].s[0]).toBe(0);
    expect(kf[0].s[1]).toBe(100);
    expect(kf[kf.length - 1].s[0]).toBe(100);
    expect(kf[kf.length - 1].s[1]).toBe(0);
  });

  it("generates wipe keyframes with x,y,w,h", () => {
    const kf = generateTransitionKeyframes("wipe", { type: "wipe", direction: "left" }, 0, 30);
    expect(kf[0].s.length).toBe(4);
    expect(kf[kf.length - 1].s[2]).toBe(512);
  });

  it("respects custom duration", () => {
    const kf = generateTransitionKeyframes("fade", { type: "fade", duration: 1000 }, 0, 30);
    expect(kf.length).toBe(31);
  });

  it("respects custom start frame", () => {
    const kf = generateTransitionKeyframes("fade", { type: "fade" }, 10, 30);
    expect(kf[0].t).toBe(10);
  });

  it("linear easing produces linear progress", () => {
    const kf = generateTransitionKeyframes("fade", { type: "fade", easing: "linear", duration: 1000 }, 0, 10);
    const mid = kf[Math.floor(kf.length / 2)];
    expect(mid.s[0]).toBeCloseTo(50, 0);
  });

  it("ease-in starts slower than linear", () => {
    const kf = generateTransitionKeyframes("fade", { type: "fade", easing: "ease-in", duration: 1000 }, 0, 10);
    const quarter = kf[Math.floor(kf.length / 4)];
    expect(quarter.s[0]).toBeLessThan(25);
  });

  it("slide direction right starts from positive offset", () => {
    const kf = generateTransitionKeyframes("slide", { type: "slide", direction: "right" }, 0, 30);
    expect(kf[0].s[0]).toBeGreaterThan(0);
  });

  it("slide direction up starts from negative y offset", () => {
    const kf = generateTransitionKeyframes("slide", { type: "slide", direction: "up" }, 0, 30);
    expect(kf[0].s[1]).toBeLessThan(0);
  });

  it("slide direction down starts from positive y offset", () => {
    const kf = generateTransitionKeyframes("slide", { type: "slide", direction: "down" }, 0, 30);
    expect(kf[0].s[1]).toBeGreaterThan(0);
  });

  it("wipe direction right expands from right", () => {
    const kf = generateTransitionKeyframes("wipe", { type: "wipe", direction: "right" }, 0, 30);
    expect(kf[0].s[0]).toBeGreaterThan(0);
    expect(kf[kf.length - 1].s[0]).toBe(0);
  });

  it("wipe direction up expands from top", () => {
    const kf = generateTransitionKeyframes("wipe", { type: "wipe", direction: "up" }, 0, 30);
    expect(kf[kf.length - 1].s[3]).toBe(512);
  });

  it("wipe direction down expands from bottom", () => {
    const kf = generateTransitionKeyframes("wipe", { type: "wipe", direction: "down" }, 0, 30);
    expect(kf[0].s[1]).toBeGreaterThan(0);
  });

  it("flip direction up uses x-axis rotation", () => {
    const kf = generateTransitionKeyframes("flip", { type: "flip", direction: "up" }, 0, 30);
    expect(kf[0].s[0]).toBeGreaterThan(0);
    expect(kf[0].s[1]).toBe(0);
  });

  it("flip direction right uses y-axis rotation", () => {
    const kf = generateTransitionKeyframes("flip", { type: "flip", direction: "right" }, 0, 30);
    expect(kf[0].s[1]).toBeGreaterThan(0);
    expect(kf[0].s[0]).toBe(0);
  });
});

describe("parseCommand /transition", () => {
  it("parses /transition with no args as fade", () => {
    const cmd = parseCommand("/transition");
    expect(cmd).toEqual({ type: "transition", options: { type: "fade" } });
  });

  it("parses /transition slide", () => {
    const cmd = parseCommand("/transition slide");
    expect(cmd!.type).toBe("transition");
    if (cmd!.type === "transition") {
      expect(cmd!.options.type).toBe("slide");
    }
  });

  it("parses all options", () => {
    const cmd = parseCommand("/transition wipe --duration 800 --easing ease-out --direction right --stagger 50 --layer myLayer");
    expect(cmd!.type).toBe("transition");
    if (cmd!.type === "transition") {
      expect(cmd!.options.type).toBe("wipe");
      expect(cmd!.options.duration).toBe(800);
      expect(cmd!.options.easing).toBe("ease-out");
      expect(cmd!.options.direction).toBe("right");
      expect(cmd!.options.stagger).toBe(50);
      expect(cmd!.options.layer).toBe("myLayer");
    }
  });

  it("returns error for invalid type", () => {
    const cmd = parseCommand("/transition invalid");
    expect(cmd!.type).toBe("error");
  });

  it("returns error for invalid easing", () => {
    const cmd = parseCommand("/transition fade --easing bogus");
    expect(cmd!.type).toBe("error");
  });

  it("returns error for invalid direction", () => {
    const cmd = parseCommand("/transition fade --direction diagonal");
    expect(cmd!.type).toBe("error");
  });

  it("returns error for invalid duration", () => {
    const cmd = parseCommand("/transition fade --duration -5");
    expect(cmd!.type).toBe("error");
  });

  it("returns error for invalid stagger", () => {
    const cmd = parseCommand("/transition fade --stagger -1");
    expect(cmd!.type).toBe("error");
  });

  it("parses each valid transition type", () => {
    for (const t of ["fade", "slide", "wipe", "zoom", "flip", "dissolve"]) {
      const cmd = parseCommand(`/transition ${t}`);
      expect(cmd!.type).toBe("transition");
      if (cmd!.type === "transition") {
        expect(cmd!.options.type).toBe(t);
      }
    }
  });

  it("parses each valid easing", () => {
    for (const e of ["linear", "ease-in", "ease-out", "ease-in-out"]) {
      const cmd = parseCommand(`/transition fade --easing ${e}`);
      expect(cmd!.type).toBe("transition");
      if (cmd!.type === "transition") {
        expect(cmd!.options.easing).toBe(e);
      }
    }
  });

  it("parses each valid direction", () => {
    for (const d of ["left", "right", "up", "down"]) {
      const cmd = parseCommand(`/transition slide --direction ${d}`);
      expect(cmd!.type).toBe("transition");
      if (cmd!.type === "transition") {
        expect(cmd!.options.direction).toBe(d);
      }
    }
  });
});
