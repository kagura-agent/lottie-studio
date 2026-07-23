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
              r: { a: 0, k: 0 },
              p: { a: 0, k: [100, 50, 0] },
              s: { a: 0, k: [100, 100, 100] },
            },
          },
        ],
      })
    ),
    writeFileSync: vi.fn(),
  },
}));

import { handleRotate } from "../rotate";

describe("handleRotate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleRotate(undefined, 90, "/rotate 90");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 404 for non-existent animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleRotate("missing-id", 90, "/rotate 90");
    expect(res.status).toBe(404);
  });

  it("returns done event with rotated animation (clockwise)", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX"))
        return { get: () => ({ max_num: 1 }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const res = await handleRotate("test-id", 90, "/rotate 90");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("90° clockwise");
  });

  it("returns done event with rotated animation (counter-clockwise)", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX"))
        return { get: () => ({ max_num: 1 }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const res = await handleRotate("test-id", -45, "/rotate 45 ccw");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("45° counter-clockwise");
  });
});
