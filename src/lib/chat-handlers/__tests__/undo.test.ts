import { describe, it, expect, vi, beforeEach } from "vitest";

const dbRunMock = vi.fn();
const dbGetMock = vi.fn();
const dbPrepareMock = vi.fn(() => ({ run: dbRunMock, get: dbGetMock }));

vi.mock("@/lib/db", () => ({
  db: { prepare: dbPrepareMock },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:fs", () => ({
  default: { existsSync: vi.fn(() => true), readFileSync: vi.fn(), writeFileSync: vi.fn() },
  writeFileSync: vi.fn(),
}));

describe("chat-handlers/undo", () => {
  let handleUndo: typeof import("../undo").handleUndo;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../undo");
    handleUndo = mod.handleUndo;
  });

  it("returns 'nothing to undo' when at version 1", async () => {
    dbGetMock.mockReturnValueOnce({ max_num: 1 });
    const resp = handleUndo("anim1", "undo");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Nothing to undo");
    expect(data.reply).toContain("first version");
  });

  it("returns 'nothing to undo' when no versions exist", async () => {
    dbGetMock.mockReturnValueOnce({ max_num: 0 });
    const resp = handleUndo("anim1", "undo");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Nothing to undo");
  });

  it("returns 'previous version not found' when version row is missing", async () => {
    dbGetMock
      .mockReturnValueOnce({ max_num: 3 })
      .mockReturnValueOnce(undefined);
    const resp = handleUndo("anim1", "undo");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("previous version not found");
  });

  it("restores previous version successfully", async () => {
    const lottie = JSON.stringify({ v: "5.7.1", fr: 30, op: 60, layers: [] });
    // First call: get max version
    dbGetMock.mockReturnValueOnce({ max_num: 3 });
    // Second call: get previous version
    dbGetMock.mockReturnValueOnce({ lottie_json: lottie });
    // Subsequent prepare calls for saveVersion and message inserts
    dbPrepareMock.mockImplementation(() => ({ run: dbRunMock, get: dbGetMock }));
    // saveVersion's getMax call
    dbGetMock.mockReturnValueOnce({ max_num: 3 });

    const resp = handleUndo("anim1", "undo");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Reverted");
    expect(data.lottieJson).toEqual(JSON.parse(lottie));
    expect(data.animationId).toBe("anim1");
  });
});
