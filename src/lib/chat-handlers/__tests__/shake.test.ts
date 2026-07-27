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

const makeAnimation = (layers?: unknown[]) =>
  JSON.stringify({
    w: 200,
    h: 100,
    fr: 30,
    ip: 0,
    op: 60,
    layers: layers ?? [
      {
        nm: "circle",
        ip: 0,
        op: 60,
        ks: {
          p: { a: 0, k: [100, 100, 0] },
          r: { a: 0, k: [0] },
        },
      },
      {
        nm: "square",
        ip: 0,
        op: 60,
        ks: {
          p: { a: 0, k: [50, 50, 0] },
          r: { a: 0, k: [0] },
        },
      },
    ],
  });

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => makeAnimation()),
    writeFileSync: vi.fn(),
  },
}));

import { handleShake } from "../shake";

describe("handleShake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleShake(undefined, {}, "/shake");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 404 for non-existent animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleShake("missing-id", {}, "/shake");
    expect(res.status).toBe(404);
  });

  it("returns error when no animation file", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const res = await handleShake("test-id", {}, "/shake");
    const text = await res.text();
    expect(text).toContain("No animation file found");
  });

  it("applies shake to all layers when no layer filter", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(makeAnimation());

    const res = await handleShake("test-id", {}, "/shake");
    const text = await res.text();
    expect(text).toContain("circle");
    expect(text).toContain("square");
    expect(text).toContain("intensity=10");
  });

  it("applies shake to specific layer when layer filter provided", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(makeAnimation());

    const res = await handleShake("test-id", { layer: "circle" }, "/shake --layer circle");
    const text = await res.text();
    // Parse the SSE data line to get the reply
    const dataLine = text.split("\n").find((l: string) => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine!.slice(6));
    expect(parsed.reply).toContain("circle");
    expect(parsed.reply).not.toContain("square");
    expect(parsed.reply).toContain("1 layer");
  });

  it("handles rotation axis", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(makeAnimation());

    const res = await handleShake("test-id", { axis: "rotation" }, "/shake --axis rotation");
    const text = await res.text();
    expect(text).toContain("rotation");
    expect(text).toContain("circle");

    // Verify ks.r was set to animated
    const writeSpy = fs.writeFileSync as unknown as ReturnType<typeof vi.fn>;
    const lastCall = writeSpy.mock.calls[writeSpy.mock.calls.length - 1];
    const written = JSON.parse(lastCall[1] as string);
    expect(written.layers[0].ks.r.a).toBe(1);
    expect(Array.isArray(written.layers[0].ks.r.k)).toBe(true);
  });

  it("returns no-layers message when animation has no layers", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ w: 200, h: 100, fr: 30, ip: 0, op: 60, layers: [] })
    );

    const res = await handleShake("test-id", {}, "/shake");
    const text = await res.text();
    expect(text).toContain("No layers found");
  });

  it("respects custom intensity and frequency", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(makeAnimation());

    const res = await handleShake(
      "test-id",
      { intensity: 25, frequency: 20, decay: 0.9 },
      "/shake --intensity 25 --frequency 20 --decay 0.9"
    );
    const text = await res.text();
    expect(text).toContain("intensity=25");
    expect(text).toContain("frequency=20");
    expect(text).toContain("decay=0.9");
  });
});
