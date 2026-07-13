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

vi.mock("@/lib/layer-ops", () => ({
  listLayers: vi.fn(() => [
    { name: "Shape", typeName: "Shape", index: 0, inPoint: 0, outPoint: 60, hidden: false, parent: null },
  ]),
  duplicateLayer: vi.fn((anim, name) => ({
    animation: { ...anim, layers: [...anim.layers, { nm: name + " Copy" }] },
    newLayerName: name + " Copy",
  })),
  deleteLayer: vi.fn((anim) => ({ ...anim, layers: [] })),
  renameLayer: vi.fn((anim, _old, newName) => {
    const copy = { ...anim, layers: anim.layers.map((l: { nm: string }) => ({ ...l, nm: newName })) };
    return copy;
  }),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => JSON.stringify({ v: "5", layers: [{ nm: "Shape" }] })),
    writeFileSync: vi.fn(),
  },
}));

describe("chat-handlers/layers", () => {
  let handleLayerCommand: typeof import("../layers").handleLayerCommand;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../layers");
    handleLayerCommand = mod.handleLayerCommand;
  });

  describe("list layers", () => {
    it("lists layers for current animation", async () => {
      dbGetMock.mockReturnValueOnce({ id: "anim1" });
      const resp = handleLayerCommand({ type: "layers" }, "anim1", "/layers");
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Shape");
      expect(data.reply).toContain("1.");
    });

    it("reports no layers when animation is empty", async () => {
      dbGetMock.mockReturnValueOnce({ id: "anim1" });
      const { listLayers } = await import("@/lib/layer-ops");
      vi.mocked(listLayers).mockReturnValueOnce([]);
      const resp = handleLayerCommand({ type: "layers" }, "anim1", "/layers");
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("No layers found");
    });
  });

  describe("duplicate layer", () => {
    it("duplicates a layer by name", async () => {
      dbGetMock
        .mockReturnValueOnce({ id: "anim1" }) // animation exists check
        .mockReturnValueOnce({ max_num: 1 }); // saveVersion
      const resp = handleLayerCommand({ type: "duplicate_layer", name: "Shape" }, "anim1", "/dup Shape");
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Duplicated");
      expect(data.reply).toContain("Shape Copy");
    });
  });

  describe("delete layer", () => {
    it("deletes a layer by name", async () => {
      dbGetMock
        .mockReturnValueOnce({ id: "anim1" })
        .mockReturnValueOnce({ max_num: 2 });
      const resp = handleLayerCommand({ type: "delete_layer", name: "Shape" }, "anim1", "/del Shape");
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Deleted");
      expect(data.reply).toContain("Shape");
    });
  });

  describe("rename layer", () => {
    it("renames a layer", async () => {
      dbGetMock
        .mockReturnValueOnce({ id: "anim1" })
        .mockReturnValueOnce({ max_num: 2 });
      const resp = handleLayerCommand(
        { type: "rename_layer", oldName: "Shape", newName: "Circle" },
        "anim1",
        "/rename Shape Circle"
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Renamed");
      expect(data.reply).toContain("Circle");
    });
  });

  describe("error cases", () => {
    it("returns error when no animation ID for mutation", async () => {
      const resp = handleLayerCommand({ type: "duplicate_layer", name: "X" }, undefined, "/dup X");
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("no current animation");
    });

    it("returns 404 when animation not in DB", async () => {
      dbGetMock.mockReturnValueOnce(undefined);
      const resp = handleLayerCommand({ type: "duplicate_layer", name: "X" }, "bad-id", "/dup X");
      expect(resp.status).toBe(404);
    });

    it("handles layer operation throwing an error", async () => {
      dbGetMock.mockReturnValueOnce({ id: "anim1" });
      const { duplicateLayer } = await import("@/lib/layer-ops");
      vi.mocked(duplicateLayer).mockImplementationOnce(() => { throw new Error("Layer not found"); });
      const resp = handleLayerCommand({ type: "duplicate_layer", name: "Missing" }, "anim1", "/dup Missing");
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Layer not found");
    });
  });
});
