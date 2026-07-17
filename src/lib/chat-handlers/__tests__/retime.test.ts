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
    readFileSync: vi.fn(() => JSON.stringify({ fr: 30, ip: 0, op: 60, layers: [{ ip: 0, op: 60 }] })),
    writeFileSync: vi.fn(),
  },
}));

import { handleRetime } from "../retime";

describe("handleRetime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no animationId", async () => {
    const res = await handleRetime(undefined, 4000, "/duration 4s");
    const text = await res.text();
    expect(text).toContain("Create an animation first");
  });

  it("returns 404 for non-existent animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({ run: vi.fn(), get: vi.fn(() => undefined) } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleRetime("missing-id", 4000, "/duration 4s");
    expect(res.status).toBe(404);
  });

  it("returns done event with retimed animation", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations")) return { get: () => ({ id: "test" }) };
      if (sql.includes("SELECT MAX")) return { get: () => ({ max_num: 1 }) };
      return { run: vi.fn(), get: vi.fn() };
    }) as typeof db.prepare);

    const res = await handleRetime("test-id", 4000, "/duration 4s");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).toContain("4000ms");
    expect(text).toContain('"op":120');
  });
});
