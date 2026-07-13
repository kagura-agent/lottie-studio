import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("@/lib/layer-ops", () => ({
  listLayers: vi.fn(),
  duplicateLayer: vi.fn(),
  deleteLayer: vi.fn(),
  renameLayer: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { animationEvents } from "@/lib/events";
import { listLayers, duplicateLayer, deleteLayer, renameLayer } from "@/lib/layer-ops";
import fs from "node:fs";
import { handleLayerCommand } from "../layers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleLayerCommand", () => {
  describe("layers list", () => {
    it("returns no layers message when animation has no data", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (listLayers as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const res = handleLayerCommand({ type: "layers" }, "anim1", "/layers");
      const text = await res.text();
      expect(text).toContain("No layers found");
    });

    it("returns formatted layer list", async () => {
      const animJson = { layers: [{ nm: "bg" }] };
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(animJson));
      (listLayers as ReturnType<typeof vi.fn>).mockReturnValue([
        { name: "bg", typeName: "shape", index: 0, inPoint: 0, outPoint: 60, hidden: false, parent: null },
      ]);

      const res = handleLayerCommand({ type: "layers" }, "anim1", "/layers");
      const text = await res.text();
      expect(text).toContain("bg");
      expect(text).toContain("Layers");
    });
  });

  describe("mutation commands without animationId", () => {
    it("returns error for duplicate without animation", async () => {
      const res = handleLayerCommand({ type: "duplicate_layer", name: "bg" }, undefined, "/dup bg");
      const text = await res.text();
      expect(text).toContain("no current animation");
    });
  });

  describe("duplicate_layer", () => {
    it("duplicates a layer", async () => {
      const animJson = { layers: [{ nm: "bg" }], op: 60, fr: 30 };
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1", max_num: 1 }), run: vi.fn() });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(animJson));
      (duplicateLayer as ReturnType<typeof vi.fn>).mockReturnValue({ animation: animJson, newLayerName: "bg copy" });

      const res = handleLayerCommand({ type: "duplicate_layer", name: "bg" }, "anim1", "/dup bg");
      const text = await res.text();
      expect(text).toContain("Duplicated");
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(animationEvents.emit).toHaveBeenCalled();
    });
  });

  describe("delete_layer", () => {
    it("deletes a layer", async () => {
      const animJson = { layers: [{ nm: "bg" }], op: 60, fr: 30 };
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1", max_num: 1 }), run: vi.fn() });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(animJson));
      (deleteLayer as ReturnType<typeof vi.fn>).mockReturnValue({ layers: [] });

      const res = handleLayerCommand({ type: "delete_layer", name: "bg" }, "anim1", "/del bg");
      const text = await res.text();
      expect(text).toContain("Deleted");
    });
  });

  describe("rename_layer", () => {
    it("renames a layer", async () => {
      const animJson = { layers: [{ nm: "bg" }], op: 60, fr: 30 };
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1", max_num: 1 }), run: vi.fn() });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(animJson));
      (renameLayer as ReturnType<typeof vi.fn>).mockReturnValue({ layers: [{ nm: "background" }] });

      const res = handleLayerCommand({ type: "rename_layer", oldName: "bg", newName: "background" }, "anim1", "/rename bg background");
      const text = await res.text();
      expect(text).toContain("Renamed");
    });
  });

  describe("error handling", () => {
    it("returns error when layer op throws", async () => {
      const animJson = { layers: [{ nm: "bg" }], op: 60, fr: 30 };
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "anim1" }), run: vi.fn() });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(animJson));
      (deleteLayer as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("Layer not found"); });

      const res = handleLayerCommand({ type: "delete_layer", name: "missing" }, "anim1", "/del missing");
      const text = await res.text();
      expect(text).toContain("Layer not found");
    });

    it("returns 404 when animation not in DB", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => undefined, run: vi.fn() });
      const res = handleLayerCommand({ type: "duplicate_layer", name: "bg" }, "anim1", "/dup bg");
      expect(res.status).toBe(404);
    });
  });
});
