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
    readFileSync: vi.fn(() => JSON.stringify({ v: "5.7.1", w: 512, h: 512, fr: 30, ip: 0, op: 60, layers: [], assets: [] })),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

import { handleWave } from "../wave";

describe("handleWave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new animation when no animationId", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => ({ max_num: 1 })),
    } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleWave(undefined, {}, "/wave");
    const text = await res.text();
    const dataLine = text.split("\n").find((l: string) => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine!.slice(6));
    expect(parsed.animationId).toBeDefined();
    expect(parsed.lottieJson).toBeDefined();
    expect(parsed).not.toHaveProperty("previousLottieJson");
  });

  it("returns 404 when animationId does not exist", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => undefined };
      return { run: vi.fn(), get: vi.fn() };
    }) as unknown as typeof db.prepare);

    const res = await handleWave("missing-id", {}, "/wave");
    expect(res.status).toBe(404);
  });

  it("replaces existing animation when animationId exists", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (sql.includes("SELECT id FROM animations"))
        return { get: () => ({ id: "test" }) };
      return { run: vi.fn(), get: vi.fn(() => ({ max_num: 1 })) };
    }) as unknown as typeof db.prepare);

    const fs = (await import("node:fs")).default;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ v: "5.7.1", w: 512, h: 512, fr: 30, ip: 0, op: 60, layers: [{ nm: "old" }], assets: [] })
    );

    const res = await handleWave("test-id", { type: "ocean" }, "/wave --type ocean");
    const text = await res.text();
    const dataLine = text.split("\n").find((l: string) => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine!.slice(6));
    expect(parsed.animationId).toBe("test-id");
    expect(parsed.previousLottieJson).toBeDefined();
  });

  it("reply includes wave type name", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => ({ max_num: 1 })),
    } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleWave(undefined, { type: "flag" }, "/wave --type flag");
    const text = await res.text();
    const dataLine = text.split("\n").find((l: string) => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine!.slice(6));
    expect(parsed.reply).toContain("flag");
  });

  it("calls sendDoneEvent with correct shape", async () => {
    const { db } = await import("@/lib/db");
    vi.spyOn(db, "prepare").mockReturnValue({
      run: vi.fn(),
      get: vi.fn(() => ({ max_num: 1 })),
    } as unknown as ReturnType<typeof db.prepare>);

    const res = await handleWave(undefined, { type: "pulse" }, "/wave --type pulse");
    const text = await res.text();
    const dataLine = text.split("\n").find((l: string) => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine!.slice(6));
    expect(parsed).toHaveProperty("reply");
    expect(parsed).toHaveProperty("lottieJson");
    expect(parsed).toHaveProperty("animationId");
    expect(parsed.lottieJson).toHaveProperty("layers");
    expect(parsed.lottieJson.layers.length).toBeGreaterThan(0);
  });
});
