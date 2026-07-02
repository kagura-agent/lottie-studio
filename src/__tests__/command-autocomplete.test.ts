import { describe, it, expect } from "vitest";
import { filterCommands, COMMANDS } from "@/components/CommandAutocomplete";

describe("filterCommands", () => {
  it("returns all commands for '/'", () => {
    const result = filterCommands("/");
    expect(result).toEqual(COMMANDS);
    expect(result.length).toBe(21);
  });

  it("filters by prefix '/sp'", () => {
    const result = filterCommands("/sp");
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("/speed");
  });

  it("filters by prefix '/e'", () => {
    const result = filterCommands("/e");
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("/export");
  });

  it("filters by prefix '/re'", () => {
    const result = filterCommands("/re");
    expect(result).toHaveLength(2);
    const commands = result.map((c) => c.command);
    expect(commands).toContain("/redo");
    expect(commands).toContain("/resize");
  });

  it("is case-insensitive", () => {
    const result = filterCommands("/PLAY");
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("/play");
  });

  it("returns empty for non-matching prefix", () => {
    const result = filterCommands("/xyz");
    expect(result).toHaveLength(0);
  });

  it("returns commands with hasParams correctly set", () => {
    const speed = COMMANDS.find((c) => c.command === "/speed");
    expect(speed?.hasParams).toBe(true);

    const play = COMMANDS.find((c) => c.command === "/play");
    expect(play?.hasParams).toBe(false);
  });

  it("filters '/f' to fullscreen", () => {
    const result = filterCommands("/f");
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("/fullscreen");
  });

  it("filters '/p' to play, pause, and presets", () => {
    const result = filterCommands("/p");
    expect(result).toHaveLength(3);
    const commands = result.map((c) => c.command);
    expect(commands).toContain("/play");
    expect(commands).toContain("/pause");
    expect(commands).toContain("/presets");
  });

  it("exact match '/loop' returns one result", () => {
    const result = filterCommands("/loop");
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("/loop");
    expect(result[0].description).toBe("Loop mode");
  });

  it("filters '/an' to animate", () => {
    const result = filterCommands("/an");
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("/animate");
    expect(result[0].hasParams).toBe(true);
  });

  it("includes /animate in full command list", () => {
    const animate = COMMANDS.find((c) => c.command === "/animate");
    expect(animate).toBeDefined();
    expect(animate?.hasParams).toBe(true);
    expect(animate?.description).toContain("motion preset");
  });
});
