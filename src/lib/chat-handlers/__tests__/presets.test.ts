import { describe, it, expect, vi, beforeEach } from "vitest";

const dbGetMock = vi.fn();
const dbPrepareMock = vi.fn(() => ({ run: vi.fn(), get: dbGetMock }));

vi.mock("@/lib/db", () => ({
  db: { prepare: dbPrepareMock },
  getAllPresets: vi.fn(() => []),
  getPresetByName: vi.fn(),
  createPreset: vi.fn(),
  deletePresetByName: vi.fn(),
  renamePreset: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/chat", { headers });
}

describe("chat-handlers/presets", () => {
  let handlePresetCommand: typeof import("../presets").handlePresetCommand;
  let dbModule: typeof import("@/lib/db");

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../presets");
    handlePresetCommand = mod.handlePresetCommand;
    dbModule = await import("@/lib/db");
  });

  describe("list", () => {
    it("returns message when no presets exist", async () => {
      vi.mocked(dbModule.getAllPresets).mockReturnValue([]);
      const resp = handlePresetCommand({ subcommand: "list" }, "anim1", makeRequest());
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("No presets available");
    });

    it("lists available presets", async () => {
      vi.mocked(dbModule.getAllPresets).mockReturnValue([
        { id: "1", name: "bounce", description: "Bouncy", instructions: "x", is_builtin: 0, created_at: "2024-01-01", creator_id: null },
        { id: "2", name: "fade", description: null, instructions: "y", is_builtin: 1, created_at: "2024-01-01", creator_id: null },
      ] as never);
      const resp = handlePresetCommand({ subcommand: "list" }, "anim1", makeRequest());
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("bounce");
      expect(data.reply).toContain("fade");
      expect(data.reply).toContain("built-in");
    });
  });

  describe("save", () => {
    it("saves preset from last assistant message", async () => {
      dbGetMock.mockReturnValueOnce({ content: "make it bounce" });
      const resp = handlePresetCommand(
        { subcommand: { action: "save", name: "mybounce", description: "A bounce" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Saved preset");
      expect(data.reply).toContain("mybounce");
      expect(dbModule.createPreset).toHaveBeenCalledWith("mybounce", "A bounce", "make it bounce", undefined);
    });

    it("fails when no assistant message exists", async () => {
      dbGetMock.mockReturnValueOnce(undefined);
      const resp = handlePresetCommand(
        { subcommand: { action: "save", name: "test" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Cannot save preset");
    });

    it("handles duplicate name error", async () => {
      dbGetMock.mockReturnValueOnce({ content: "instructions" });
      vi.mocked(dbModule.createPreset).mockImplementationOnce(() => {
        throw new Error("UNIQUE constraint failed");
      });
      const resp = handlePresetCommand(
        { subcommand: { action: "save", name: "dup" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("already exists");
    });
  });

  describe("delete", () => {
    it("deletes a preset", async () => {
      vi.mocked(dbModule.deletePresetByName).mockReturnValue(true as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "delete", name: "old" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Deleted");
    });

    it("reports not found for missing preset", async () => {
      vi.mocked(dbModule.deletePresetByName).mockReturnValue(false as never);
      vi.mocked(dbModule.getPresetByName).mockReturnValue(undefined as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "delete", name: "ghost" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("not found");
    });

    it("prevents deleting built-in presets", async () => {
      vi.mocked(dbModule.deletePresetByName).mockReturnValue(false as never);
      vi.mocked(dbModule.getPresetByName).mockReturnValue({ is_builtin: 1 } as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "delete", name: "builtin" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("built-in");
    });
  });

  describe("rename", () => {
    it("renames a preset", async () => {
      vi.mocked(dbModule.renamePreset).mockReturnValue(true as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "rename", oldName: "old", newName: "new" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Renamed");
      expect(data.reply).toContain("new");
    });

    it("reports not found for missing preset", async () => {
      vi.mocked(dbModule.renamePreset).mockReturnValue(false as never);
      vi.mocked(dbModule.getPresetByName).mockReturnValue(undefined as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "rename", oldName: "ghost", newName: "x" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("not found");
    });

    it("prevents renaming built-in presets", async () => {
      vi.mocked(dbModule.renamePreset).mockReturnValue(false as never);
      vi.mocked(dbModule.getPresetByName).mockReturnValue({ is_builtin: 1 } as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "rename", oldName: "builtin", newName: "x" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("built-in");
    });
  });

  describe("info", () => {
    it("shows preset details", async () => {
      vi.mocked(dbModule.getPresetByName).mockReturnValue({
        name: "bounce", description: "Bouncy effect", instructions: "add bounce", is_builtin: 0, created_at: "2024-01-01",
      } as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "info", name: "bounce" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("bounce");
      expect(data.reply).toContain("add bounce");
    });

    it("reports not found for missing preset", async () => {
      vi.mocked(dbModule.getPresetByName).mockReturnValue(undefined as never);
      const resp = handlePresetCommand(
        { subcommand: { action: "info", name: "ghost" } },
        "anim1",
        makeRequest()
      );
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("not found");
    });
  });

  describe("unknown command", () => {
    it("returns unknown preset command", async () => {
      const resp = handlePresetCommand({ subcommand: "invalid" }, "anim1", makeRequest());
      const text = await resp.text();
      const data = JSON.parse(text.replace("data: ", "").trim());
      expect(data.reply).toContain("Unknown preset command");
    });
  });
});
