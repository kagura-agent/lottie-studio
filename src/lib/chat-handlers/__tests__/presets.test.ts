import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
  getAllPresets: vi.fn(),
  getPresetByName: vi.fn(),
  createPreset: vi.fn(),
  deletePresetByName: vi.fn(),
  renamePreset: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

import { db, getAllPresets, getPresetByName, createPreset, deletePresetByName, renamePreset } from "@/lib/db";
import { handlePresetCommand } from "../presets";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/chat", { headers });
}

describe("handlePresetCommand", () => {
  describe("list", () => {
    it("returns empty message when no presets", async () => {
      (getAllPresets as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const res = handlePresetCommand({ subcommand: "list" }, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("No presets available");
    });

    it("returns formatted list of presets", async () => {
      (getAllPresets as ReturnType<typeof vi.fn>).mockReturnValue([
        { name: "bounce", description: "Bouncy motion", is_builtin: true },
        { name: "custom1", description: null, is_builtin: false },
      ]);
      const res = handlePresetCommand({ subcommand: "list" }, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("bounce");
      expect(text).toContain("built-in");
      expect(text).toContain("custom1");
    });
  });

  describe("save", () => {
    it("returns error when no previous assistant message", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => undefined });
      const cmd = { subcommand: { action: "save", name: "test", description: "desc" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("Cannot save preset");
    });

    it("saves preset successfully", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ content: "make a ball bounce" }) });
      (createPreset as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
      const cmd = { subcommand: { action: "save", name: "mybounce", description: "A bounce" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest({ "x-creator-id": "user1" }));
      const text = await res.text();
      expect(text).toContain("Saved preset");
      expect(createPreset).toHaveBeenCalledWith("mybounce", "A bounce", "make a ball bounce", "user1");
    });

    it("handles duplicate name error", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ content: "instructions" }) });
      (createPreset as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("UNIQUE constraint failed"); });
      const cmd = { subcommand: { action: "save", name: "dupe", description: null } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("already exists");
    });
  });

  describe("delete", () => {
    it("deletes a preset successfully", async () => {
      (deletePresetByName as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const cmd = { subcommand: { action: "delete", name: "custom1" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("Deleted preset");
    });

    it("cannot delete built-in preset", async () => {
      (deletePresetByName as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (getPresetByName as ReturnType<typeof vi.fn>).mockReturnValue({ name: "bounce", is_builtin: true });
      const cmd = { subcommand: { action: "delete", name: "bounce" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("built-in");
    });

    it("returns not found for missing preset", async () => {
      (deletePresetByName as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (getPresetByName as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
      const cmd = { subcommand: { action: "delete", name: "nope" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("not found");
    });
  });

  describe("rename", () => {
    it("renames a preset successfully", async () => {
      (renamePreset as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const cmd = { subcommand: { action: "rename", oldName: "a", newName: "b" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("Renamed");
    });

    it("cannot rename built-in preset", async () => {
      (renamePreset as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (getPresetByName as ReturnType<typeof vi.fn>).mockReturnValue({ name: "a", is_builtin: true });
      const cmd = { subcommand: { action: "rename", oldName: "a", newName: "b" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("built-in");
    });

    it("returns not found when preset missing", async () => {
      (renamePreset as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (getPresetByName as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
      const cmd = { subcommand: { action: "rename", oldName: "x", newName: "y" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("not found");
    });
  });

  describe("info", () => {
    it("shows preset details", async () => {
      (getPresetByName as ReturnType<typeof vi.fn>).mockReturnValue({
        name: "bounce", description: "Bouncy", instructions: "make it bounce", is_builtin: true, created_at: "2024-01-01",
      });
      const cmd = { subcommand: { action: "info", name: "bounce" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("bounce");
      expect(text).toContain("make it bounce");
    });

    it("returns not found for missing preset", async () => {
      (getPresetByName as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
      const cmd = { subcommand: { action: "info", name: "nope" } };
      const res = handlePresetCommand(cmd, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("not found");
    });
  });

  describe("unknown command", () => {
    it("returns unknown preset command", async () => {
      const res = handlePresetCommand({ subcommand: "invalid" }, "anim1", makeRequest());
      const text = await res.text();
      expect(text).toContain("Unknown preset command");
    });
  });
});
