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

vi.mock("@/lib/compose", () => ({
  composeLayers: vi.fn((target, source) => ({
    ...(target as object),
    layers: [
      ...((target as { layers?: unknown[] }).layers || []),
      ...((source as { layers?: unknown[] }).layers || []),
    ],
  })),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("chat-handlers/compose", () => {
  let handleCompose: typeof import("../compose").handleCompose;
  let fsMock: typeof import("node:fs");

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../compose");
    handleCompose = mod.handleCompose;
    fsMock = await import("node:fs");
  });

  it("returns error when source animation not in DB", async () => {
    dbGetMock.mockReturnValueOnce(undefined);
    const resp = handleCompose("target1", "missing-source", "compose");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("not found");
  });

  it("returns error when source file does not exist", async () => {
    dbGetMock.mockReturnValueOnce({ id: "src1", name: "Source Anim" });
    vi.mocked(fsMock.default.existsSync).mockReturnValueOnce(false);
    const resp = handleCompose("target1", "src1", "compose");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("no saved JSON file");
  });

  it("returns error when source JSON is invalid", async () => {
    dbGetMock.mockReturnValueOnce({ id: "src1", name: "Source Anim" });
    vi.mocked(fsMock.default.existsSync).mockReturnValue(true);
    vi.mocked(fsMock.default.readFileSync).mockReturnValueOnce("not json");
    const resp = handleCompose("target1", "src1", "compose");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("Failed to parse");
  });

  it("merges layers from source into target", async () => {
    const sourceJson = JSON.stringify({ v: "5", layers: [{ nm: "L1" }, { nm: "L2" }], assets: [] });
    const targetJson = JSON.stringify({ v: "5", fr: 30, op: 60, layers: [{ nm: "Base" }], assets: [] });

    dbGetMock.mockReturnValueOnce({ id: "src1", name: "Source Anim" });
    vi.mocked(fsMock.default.existsSync).mockReturnValue(true);
    vi.mocked(fsMock.default.readFileSync)
      .mockReturnValueOnce(sourceJson)
      .mockReturnValueOnce(targetJson);
    // saveVersion getMax
    dbGetMock.mockReturnValueOnce({ max_num: 1 });

    const resp = handleCompose("target1", "src1", "compose with source");
    const text = await resp.text();
    const data = JSON.parse(text.replace("data: ", "").trim());
    expect(data.reply).toContain("2 layers");
    expect(data.reply).toContain("Source Anim");
    expect(data.lottieJson.layers).toHaveLength(3);
  });
});
