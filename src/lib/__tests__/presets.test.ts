import { describe, it, expect } from "vitest";
import { parseCommand } from "../commands";
import { buildPresetPrompt } from "../prompts";
import { getAllPresets, getPresetByName, createPreset, deletePreset } from "../db";

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
});
