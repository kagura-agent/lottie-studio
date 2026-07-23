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

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() =>
      JSON.stringify({
        w: 200,
        h: 100,
        fr: 30,
        ip: 0,
        op: 60,
        layers: [
          {
            ip: 0,
            op: 60,
            ks: {
              p: { a: 0, k: [100, 50, 0] },
              a: { a: 0, k: [50, 25, 0] },
              s: { a: 0, k: [100, 100, 100] },
            },
          },
        ],
      })
    ),
    writeFileSync: vi.fn(),
  },
}));

import { handleScale } from "../scale";

describe("handleScale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleScale(undefined, 2, "/scale 2x");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 404 for non-existent animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleScale("missing-id", 2, "/scale 2x");
    expect(res.status).toBe(404);
  });

  it("returns done event with scaled animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX"))
        return { get: () => ({ max_num: 1 }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const res = await handleScale("test-id", 2, "/scale 2x");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("200%");
    expect(text).toContain("2x");
  });

  it("returns done event with scale down", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX"))
        return { get: () => ({ max_num: 1 }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const res = await handleScale("test-id", 0.5, "/scale 0.5x");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("50%");
  });
});
