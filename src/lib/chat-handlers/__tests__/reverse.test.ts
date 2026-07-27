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
              p: { a: 1, k: [{ t: 0, s: [0, 0, 0] }, { t: 60, s: [100, 100, 0] }] },
              s: { a: 0, k: [100, 100, 100] },
            },
          },
        ],
      })
    ),
    writeFileSync: vi.fn(),
  },
}));

import { handleReverse } from "../reverse";

describe("handleReverse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleReverse(undefined, "/reverse");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 404 for non-existent animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleReverse("missing-id", "/reverse");
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

    const res = await handleReverse("test-id", "/reverse");
    const text = await res.text();
    expect(text).toContain("No animation file found");
  });

  it("successfully reverses and returns result", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX"))
        return { get: () => ({ max_num: 1 }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);

    const res = await handleReverse("test-id", "/reverse");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("reversed");
  });

  it("saves version history", async () => {
    const { db } = await import("@/lib/db");
    const runFn = vi.fn();
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX"))
        return { get: () => ({ max_num: 1 }) };
      return { run: runFn, get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);

    await handleReverse("test-id", "/reverse");
    expect(runFn).toHaveBeenCalled();
  });
});
