import { describe, it, expect } from "vitest";
import { parseCommand } from "../commands";
import { buildPresetPrompt } from "../prompts";
import { getAllPresets, getPresetByName, createPreset, deletePreset, deletePresetByName, renamePreset } from "../db";

// --- parseCommand: /presets ---

describe("parseCommand /presets", () => {
  it("parses /presets as list", () => {
    expect(parseCommand("/presets")).toEqual({ type: "presets", subcommand: "list" });
  });

  it("parses /presets list", () => {
    expect(parseCommand("/presets list")).toEqual({ type: "presets", subcommand: "list" });
  });

  it("parses /preset (singular alias) as list", () => {
    expect(parseCommand("/preset")).toEqual({ type: "presets", subcommand: "list" });
  });

  it("is case-insensitive", () => {
    expect(parseCommand("/PRESETS")).toEqual({ type: "presets", subcommand: "list" });
    expect(parseCommand("/Presets List")).toEqual({ type: "presets", subcommand: "list" });
  });

  it("parses /presets save mypreset", () => {
    expect(parseCommand("/presets save mypreset")).toEqual({
      type: "presets",
      subcommand: { action: "save", name: "mypreset" },
    });
  });

  it("parses /presets save mypreset with description", () => {
    expect(parseCommand("/presets save mypreset a cool bounce effect")).toEqual({
      type: "presets",
      subcommand: { action: "save", name: "mypreset", description: "a cool bounce effect" },
    });
  });

  it("lowercases the preset name on save", () => {
    expect(parseCommand("/presets save MyPreset")).toEqual({
      type: "presets",
      subcommand: { action: "save", name: "mypreset" },
    });
  });

  it("returns error for /presets save without name", () => {
    const result = parseCommand("/presets save");
    expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
  });

  it("returns error for unknown subcommand", () => {
    const result = parseCommand("/presets foo");
    expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown presets subcommand") });
  });

  // --- /presets delete ---

  it("parses /presets delete mypreset", () => {
    expect(parseCommand("/presets delete mypreset")).toEqual({
      type: "presets",
      subcommand: { action: "delete", name: "mypreset" },
    });
  });

  it("parses /presets remove (alias for delete)", () => {
    expect(parseCommand("/presets remove mypreset")).toEqual({
      type: "presets",
      subcommand: { action: "delete", name: "mypreset" },
    });
  });

  it("lowercases the preset name on delete", () => {
    expect(parseCommand("/presets delete MyPreset")).toEqual({
      type: "presets",
      subcommand: { action: "delete", name: "mypreset" },
    });
  });

  it("returns error for /presets delete without name", () => {
    const result = parseCommand("/presets delete");
    expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
  });

  // --- /presets rename ---

  it("parses /presets rename old new", () => {
    expect(parseCommand("/presets rename old-name new-name")).toEqual({
      type: "presets",
      subcommand: { action: "rename", oldName: "old-name", newName: "new-name" },
    });
  });

  it("lowercases both names on rename", () => {
    expect(parseCommand("/presets rename OldName NewName")).toEqual({
      type: "presets",
      subcommand: { action: "rename", oldName: "oldname", newName: "newname" },
    });
  });

  it("returns error for /presets rename with missing args", () => {
    expect(parseCommand("/presets rename")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    expect(parseCommand("/presets rename old")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
  });

  // --- /presets info ---

  it("parses /presets info mypreset", () => {
    expect(parseCommand("/presets info mypreset")).toEqual({
      type: "presets",
      subcommand: { action: "info", name: "mypreset" },
    });
  });

  it("parses /presets show (alias for info)", () => {
    expect(parseCommand("/presets show mypreset")).toEqual({
      type: "presets",
      subcommand: { action: "info", name: "mypreset" },
    });
  });

  it("returns error for /presets info without name", () => {
    const result = parseCommand("/presets info");
    expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
  });
});

// --- buildPresetPrompt ---

describe("buildPresetPrompt", () => {
  it("returns a string containing the instructions", () => {
    const result = buildPresetPrompt("Apply a bounce effect with overshoot");
    expect(result).toContain("Apply a bounce effect with overshoot");
  });

  it("includes context about applying a motion preset", () => {
    const result = buildPresetPrompt("Spin the element 360 degrees");
    expect(result).toContain("motion preset");
  });

  it("returns a non-empty string", () => {
    const result = buildPresetPrompt("test");
    expect(result.length).toBeGreaterThan(0);
  });
});

// --- DB functions ---

describe("preset DB functions", () => {
  it("getAllPresets returns built-in presets", () => {
    const presets = getAllPresets();
    expect(presets.length).toBeGreaterThanOrEqual(6);
    const names = presets.map((p) => p.name);
    expect(names).toContain("bounce");
    expect(names).toContain("fade-in");
    expect(names).toContain("slide-up");
    expect(names).toContain("pulse");
    expect(names).toContain("wiggle");
    expect(names).toContain("spin");
  });

  it("built-in presets have is_builtin = 1", () => {
    const presets = getAllPresets();
    const builtins = presets.filter((p) => p.is_builtin === 1);
    expect(builtins.length).toBeGreaterThanOrEqual(6);
    for (const preset of builtins) {
      expect(preset.instructions).toBeTruthy();
      expect(preset.name).toBeTruthy();
    }
  });

  it("getPresetByName returns a preset", () => {
    const preset = getPresetByName("bounce");
    expect(preset).toBeDefined();
    expect(preset!.name).toBe("bounce");
    expect(preset!.instructions).toBeTruthy();
    expect(preset!.is_builtin).toBe(1);
  });

  it("getPresetByName returns undefined for non-existent preset", () => {
    const preset = getPresetByName("nonexistent-preset-xyz");
    expect(preset).toBeUndefined();
  });

  it("createPreset creates a new user preset", () => {
    const name = `test-preset-${Date.now()}`;
    const preset = createPreset(name, "test description", "test instructions", "test-creator");
    expect(preset).toBeDefined();
    expect(preset.name).toBe(name);
    expect(preset.description).toBe("test description");
    expect(preset.instructions).toBe("test instructions");
    expect(preset.is_builtin).toBe(0);
    expect(preset.creator_id).toBe("test-creator");

    // Clean up
    deletePreset(preset.id);
  });

  it("createPreset works without creatorId", () => {
    const name = `test-preset-no-creator-${Date.now()}`;
    const preset = createPreset(name, null, "some instructions");
    expect(preset).toBeDefined();
    expect(preset.creator_id).toBeNull();

    // Clean up
    deletePreset(preset.id);
  });

  it("deletePreset deletes a user preset", () => {
    const name = `test-delete-${Date.now()}`;
    const preset = createPreset(name, null, "to be deleted");
    const deleted = deletePreset(preset.id);
    expect(deleted).toBe(true);

    const found = getPresetByName(name);
    expect(found).toBeUndefined();
  });

  it("deletePreset refuses to delete built-in presets", () => {
    const bounce = getPresetByName("bounce");
    expect(bounce).toBeDefined();
    const deleted = deletePreset(bounce!.id);
    expect(deleted).toBe(false);

    // Confirm it still exists
    const stillExists = getPresetByName("bounce");
    expect(stillExists).toBeDefined();
  });

  it("deletePreset returns false for non-existent preset", () => {
    const deleted = deletePreset("non-existent-id");
    expect(deleted).toBe(false);
  });

  // --- deletePresetByName ---

  it("deletePresetByName deletes a user preset by name", () => {
    const name = `test-delete-by-name-${Date.now()}`;
    const preset = createPreset(name, null, "to be deleted by name");
    expect(preset).toBeDefined();

    const deleted = deletePresetByName(name);
    expect(deleted).toBe(true);

    const found = getPresetByName(name);
    expect(found).toBeUndefined();
  });

  it("deletePresetByName refuses to delete built-in presets", () => {
    const deleted = deletePresetByName("bounce");
    expect(deleted).toBe(false);

    const stillExists = getPresetByName("bounce");
    expect(stillExists).toBeDefined();
  });

  it("deletePresetByName returns false for non-existent preset", () => {
    const deleted = deletePresetByName("nonexistent-preset-xyz");
    expect(deleted).toBe(false);
  });

  // --- renamePreset ---

  it("renamePreset renames a user preset", () => {
    const oldName = `test-rename-old-${Date.now()}`;
    const newName = `test-rename-new-${Date.now()}`;
    const preset = createPreset(oldName, "rename test", "rename instructions");
    expect(preset).toBeDefined();

    const renamed = renamePreset(oldName, newName);
    expect(renamed).toBe(true);

    const found = getPresetByName(newName);
    expect(found).toBeDefined();
    expect(found!.instructions).toBe("rename instructions");

    const oldFound = getPresetByName(oldName);
    expect(oldFound).toBeUndefined();

    // Clean up
    deletePresetByName(newName);
  });

  it("renamePreset refuses to rename built-in presets", () => {
    const renamed = renamePreset("bounce", "my-bounce");
    expect(renamed).toBe(false);

    const stillExists = getPresetByName("bounce");
    expect(stillExists).toBeDefined();
  });

  it("renamePreset returns false for non-existent source", () => {
    const renamed = renamePreset("nonexistent-preset-xyz", "new-name");
    expect(renamed).toBe(false);
  });

  it("renamePreset returns false when target name already exists", () => {
    const name1 = `test-rename-dup-1-${Date.now()}`;
    const name2 = `test-rename-dup-2-${Date.now()}`;
    createPreset(name1, null, "preset 1");
    createPreset(name2, null, "preset 2");

    const renamed = renamePreset(name1, name2);
    expect(renamed).toBe(false);

    // Both should still exist with original names
    expect(getPresetByName(name1)).toBeDefined();
    expect(getPresetByName(name2)).toBeDefined();

    // Clean up
    deletePresetByName(name1);
    deletePresetByName(name2);
  });
});
