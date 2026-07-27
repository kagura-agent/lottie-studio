import { describe, it, expect } from "vitest";
import { parseCommand } from "../commands";

describe("parseCommand", () => {
  describe("non-commands", () => {
    it("returns null for empty string", () => {
      expect(parseCommand("")).toBeNull();
    });

    it("returns null for regular text", () => {
      expect(parseCommand("make a bouncing ball")).toBeNull();
    });

    it("returns null for text starting with space then slash", () => {
      // After trim, starts with / — but let's test a non-slash string
      expect(parseCommand("hello /play")).toBeNull();
    });

    it("returns null for unknown commands", () => {
      expect(parseCommand("/foobar")).toBeNull();
      expect(parseCommand("/unknown thing")).toBeNull();
    });
  });

  describe("/play", () => {
    it("parses /play", () => {
      expect(parseCommand("/play")).toEqual({ type: "play" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/PLAY")).toEqual({ type: "play" });
      expect(parseCommand("/Play")).toEqual({ type: "play" });
    });

    it("handles leading/trailing whitespace", () => {
      expect(parseCommand("  /play  ")).toEqual({ type: "play" });
    });
  });

  describe("/pause", () => {
    it("parses /pause", () => {
      expect(parseCommand("/pause")).toEqual({ type: "pause" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/PAUSE")).toEqual({ type: "pause" });
    });
  });

  describe("/speed", () => {
    it("parses /speed 2", () => {
      expect(parseCommand("/speed 2")).toEqual({ type: "speed", speed: 2 });
    });

    it("parses /speed 2x", () => {
      expect(parseCommand("/speed 2x")).toEqual({ type: "speed", speed: 2 });
    });

    it("parses /speed 0.5x", () => {
      expect(parseCommand("/speed 0.5x")).toEqual({ type: "speed", speed: 0.5 });
    });

    it("parses /speed 1.5X (uppercase X)", () => {
      expect(parseCommand("/speed 1.5X")).toEqual({ type: "speed", speed: 1.5 });
    });

    it("returns error for missing arg", () => {
      const result = parseCommand("/speed");
      expect(result).toEqual({ type: "error", message: expect.any(String) });
    });

    it("returns error for invalid number", () => {
      const result = parseCommand("/speed abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid speed") });
    });

    it("returns error for zero", () => {
      const result = parseCommand("/speed 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid speed") });
    });

    it("returns error for negative", () => {
      const result = parseCommand("/speed -1");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid speed") });
    });
  });

  describe("/loop", () => {
    it("parses /loop", () => {
      expect(parseCommand("/loop")).toEqual({ type: "loop", mode: "seamless" });
    });
  });

  describe("/once", () => {
    it("parses /once", () => {
      expect(parseCommand("/once")).toEqual({ type: "once" });
    });
  });

  describe("/export", () => {
    it("parses /export gif", () => {
      expect(parseCommand("/export gif")).toEqual({ type: "export_gif" });
    });

    it("parses /export video", () => {
      expect(parseCommand("/export video")).toEqual({ type: "export_video" });
    });

    it("parses /export json", () => {
      expect(parseCommand("/export json")).toEqual({ type: "export_json" });
    });

    it("parses /export dotlottie", () => {
      expect(parseCommand("/export dotlottie")).toEqual({ type: "export_dotlottie" });
    });

    it("is case-insensitive for format", () => {
      expect(parseCommand("/export GIF")).toEqual({ type: "export_gif" });
      expect(parseCommand("/EXPORT Video")).toEqual({ type: "export_video" });
    });

    it("returns error for missing format", () => {
      const result = parseCommand("/export");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for unknown format", () => {
      const result = parseCommand("/export mp4");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown export format") });
    });
  });

  describe("/undo", () => {
    it("parses /undo", () => {
      expect(parseCommand("/undo")).toEqual({ type: "undo" });
    });
  });

  describe("/redo", () => {
    it("parses /redo", () => {
      expect(parseCommand("/redo")).toEqual({ type: "redo" });
    });
  });

  describe("/resize", () => {
    it("parses /resize 800x600", () => {
      expect(parseCommand("/resize 800x600")).toEqual({ type: "resize", width: 800, height: 600 });
    });

    it("parses /resize 1920x1080", () => {
      expect(parseCommand("/resize 1920x1080")).toEqual({ type: "resize", width: 1920, height: 1080 });
    });

    it("is case-insensitive for x separator", () => {
      expect(parseCommand("/resize 800X600")).toEqual({ type: "resize", width: 800, height: 600 });
    });

    it("returns error for missing arg", () => {
      const result = parseCommand("/resize");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid format", () => {
      const result = parseCommand("/resize 800");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid resize format") });
    });

    it("returns error for non-numeric dimensions", () => {
      const result = parseCommand("/resize abcxdef");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid resize format") });
    });
  });

  describe("/bg and /background", () => {
    it("parses /bg #ff0000", () => {
      expect(parseCommand("/bg #ff0000")).toEqual({ type: "background", color: "#ff0000" });
    });

    it("parses /background red", () => {
      expect(parseCommand("/background red")).toEqual({ type: "background", color: "red" });
    });

    it("parses /BG with case insensitivity", () => {
      expect(parseCommand("/BG blue")).toEqual({ type: "background", color: "blue" });
    });

    it("returns error for missing color", () => {
      const result = parseCommand("/bg");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });
  });

  describe("/fullscreen", () => {
    it("parses /fullscreen", () => {
      expect(parseCommand("/fullscreen")).toEqual({ type: "fullscreen" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/FULLSCREEN")).toEqual({ type: "fullscreen" });
    });
  });

  describe("/optimize", () => {
    it("parses /optimize", () => {
      expect(parseCommand("/optimize")).toEqual({ type: "optimize" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/OPTIMIZE")).toEqual({ type: "optimize" });
      expect(parseCommand("/Optimize")).toEqual({ type: "optimize" });
    });
  });

  describe("edge cases", () => {
    it("handles extra whitespace between command and args", () => {
      expect(parseCommand("/speed    2x")).toEqual({ type: "speed", speed: 2 });
    });

    it("handles tabs in input", () => {
      expect(parseCommand("/speed\t3")).toEqual({ type: "speed", speed: 3 });
    });

    it("slash alone returns null", () => {
      expect(parseCommand("/")).toBeNull();
    });
  });

  describe("/goto", () => {
    it("parses /goto 30 as frame", () => {
      expect(parseCommand("/goto 30")).toEqual({
        type: "goto",
        target: { value: 30, unit: "frame" },
      });
    });

    it("parses /goto 0 as frame 0", () => {
      expect(parseCommand("/goto 0")).toEqual({
        type: "goto",
        target: { value: 0, unit: "frame" },
      });
    });

    it("parses /goto 1.5s as seconds", () => {
      expect(parseCommand("/goto 1.5s")).toEqual({
        type: "goto",
        target: { value: 1.5, unit: "seconds" },
      });
    });

    it("parses /goto 500ms as milliseconds", () => {
      expect(parseCommand("/goto 500ms")).toEqual({
        type: "goto",
        target: { value: 500, unit: "ms" },
      });
    });

    it("parses /goto 50% as percent", () => {
      expect(parseCommand("/goto 50%")).toEqual({
        type: "goto",
        target: { value: 50, unit: "percent" },
      });
    });

    it("parses /goto 0% as percent", () => {
      expect(parseCommand("/goto 0%")).toEqual({
        type: "goto",
        target: { value: 0, unit: "percent" },
      });
    });

    it("parses /goto 100% as percent", () => {
      expect(parseCommand("/goto 100%")).toEqual({
        type: "goto",
        target: { value: 100, unit: "percent" },
      });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/GOTO 10")).toEqual({
        type: "goto",
        target: { value: 10, unit: "frame" },
      });
      expect(parseCommand("/Goto 2S")).toEqual({
        type: "goto",
        target: { value: 2, unit: "seconds" },
      });
      expect(parseCommand("/goto 300MS")).toEqual({
        type: "goto",
        target: { value: 300, unit: "ms" },
      });
    });

    it("returns error for missing arg", () => {
      const result = parseCommand("/goto");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for non-numeric value", () => {
      const result = parseCommand("/goto abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid") });
    });

    it("returns error for negative frame", () => {
      const result = parseCommand("/goto -5");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid") });
    });

    it("returns error for negative seconds", () => {
      const result = parseCommand("/goto -1s");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid") });
    });

    it("returns error for percentage over 100", () => {
      const result = parseCommand("/goto 150%");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid") });
    });

    it("returns error for negative percentage", () => {
      const result = parseCommand("/goto -10%");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid") });
    });
  });

  describe("/duration", () => {
    it("parses /duration 2s", () => {
      expect(parseCommand("/duration 2s")).toEqual({ type: "duration", durationMs: 2000 });
    });

    it("parses /duration 500ms", () => {
      expect(parseCommand("/duration 500ms")).toEqual({ type: "duration", durationMs: 500 });
    });

    it("parses /duration 1.5s", () => {
      expect(parseCommand("/duration 1.5s")).toEqual({ type: "duration", durationMs: 1500 });
    });

    it("parses /duration 0.5s", () => {
      expect(parseCommand("/duration 0.5s")).toEqual({ type: "duration", durationMs: 500 });
    });

    it("parses /duration 2500ms", () => {
      expect(parseCommand("/duration 2500ms")).toEqual({ type: "duration", durationMs: 2500 });
    });

    it("parses bare number as seconds", () => {
      expect(parseCommand("/duration 3")).toEqual({ type: "duration", durationMs: 3000 });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/DURATION 2s")).toEqual({ type: "duration", durationMs: 2000 });
      expect(parseCommand("/Duration 1S")).toEqual({ type: "duration", durationMs: 1000 });
      expect(parseCommand("/duration 500MS")).toEqual({ type: "duration", durationMs: 500 });
    });

    it("returns error for missing arg", () => {
      const result = parseCommand("/duration");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid format", () => {
      const result = parseCommand("/duration abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for zero duration", () => {
      const result = parseCommand("/duration 0s");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for negative duration", () => {
      const result = parseCommand("/duration -1s");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });
  });

  describe("/style", () => {
    it("parses /style with no args as style_list", () => {
      expect(parseCommand("/style")).toEqual({ type: "style_list" });
    });

    it("parses /style neon", () => {
      expect(parseCommand("/style neon")).toEqual({ type: "style", style: "neon" });
    });

    it("parses /style pastel", () => {
      expect(parseCommand("/style pastel")).toEqual({ type: "style", style: "pastel" });
    });

    it("parses /style monochrome", () => {
      expect(parseCommand("/style monochrome")).toEqual({ type: "style", style: "monochrome" });
    });

    it("parses /style gradient", () => {
      expect(parseCommand("/style gradient")).toEqual({ type: "style", style: "gradient" });
    });

    it("parses /style retro", () => {
      expect(parseCommand("/style retro")).toEqual({ type: "style", style: "retro" });
    });

    it("parses /style minimal", () => {
      expect(parseCommand("/style minimal")).toEqual({ type: "style", style: "minimal" });
    });

    it("parses /style bold", () => {
      expect(parseCommand("/style bold")).toEqual({ type: "style", style: "bold" });
    });

    it("parses /style nature", () => {
      expect(parseCommand("/style nature")).toEqual({ type: "style", style: "nature" });
    });

    it("is case-insensitive for style name", () => {
      expect(parseCommand("/style NEON")).toEqual({ type: "style", style: "neon" });
      expect(parseCommand("/style Pastel")).toEqual({ type: "style", style: "pastel" });
      expect(parseCommand("/STYLE bold")).toEqual({ type: "style", style: "bold" });
    });

    it("treats unknown single word as style_custom", () => {
      expect(parseCommand("/style foo")).toEqual({
        type: "style_custom",
        description: "foo",
      });
    });

    it("treats multi-word text as style_custom", () => {
      expect(parseCommand("/style dark gothic horror")).toEqual({
        type: "style_custom",
        description: "dark gothic horror",
      });
    });

    it("treats mixed-case unknown as style_custom", () => {
      expect(parseCommand("/style Cyberpunk Neon City")).toEqual({
        type: "style_custom",
        description: "Cyberpunk Neon City",
      });
    });
  });

  describe("/animate", () => {
    it("parses /animate bounce", () => {
      expect(parseCommand("/animate bounce")).toEqual({ type: "animate", animation: "bounce" });
    });

    it("parses /animate pulse", () => {
      expect(parseCommand("/animate pulse")).toEqual({ type: "animate", animation: "pulse" });
    });

    it("parses /animate shake", () => {
      expect(parseCommand("/animate shake")).toEqual({ type: "animate", animation: "shake" });
    });

    it("parses /animate float", () => {
      expect(parseCommand("/animate float")).toEqual({ type: "animate", animation: "float" });
    });

    it("parses /animate spin", () => {
      expect(parseCommand("/animate spin")).toEqual({ type: "animate", animation: "spin" });
    });

    it("parses /animate slide-in", () => {
      expect(parseCommand("/animate slide-in")).toEqual({ type: "animate", animation: "slide-in" });
    });

    it("parses /animate fade-in", () => {
      expect(parseCommand("/animate fade-in")).toEqual({ type: "animate", animation: "fade-in" });
    });

    it("parses /animate elastic", () => {
      expect(parseCommand("/animate elastic")).toEqual({ type: "animate", animation: "elastic" });
    });

    it("parses /animate wiggle", () => {
      expect(parseCommand("/animate wiggle")).toEqual({ type: "animate", animation: "wiggle" });
    });

    it("parses /animate typewriter", () => {
      expect(parseCommand("/animate typewriter")).toEqual({ type: "animate", animation: "typewriter" });
    });

    it("is case-insensitive for preset name", () => {
      expect(parseCommand("/animate BOUNCE")).toEqual({ type: "animate", animation: "bounce" });
      expect(parseCommand("/animate Pulse")).toEqual({ type: "animate", animation: "pulse" });
      expect(parseCommand("/ANIMATE shake")).toEqual({ type: "animate", animation: "shake" });
    });

    it("returns error for missing argument", () => {
      const result = parseCommand("/animate");
      expect(result).toEqual({
        type: "error",
        message: expect.stringContaining("Usage"),
      });
      expect((result as { message: string }).message).toContain("bounce");
    });

    it("returns error for invalid preset", () => {
      const result = parseCommand("/animate invalid");
      expect(result).toEqual({
        type: "error",
        message: expect.stringContaining("Unknown animation preset"),
      });
      expect((result as { message: string }).message).toContain("bounce");
      expect((result as { message: string }).message).toContain("typewriter");
    });
  });

  describe("/compose", () => {
    it("parses /compose with an animation id", () => {
      expect(parseCommand("/compose abc-123-def")).toEqual({ type: "compose", id: "abc-123-def" });
    });

    it("parses /compose with a UUID", () => {
      expect(parseCommand("/compose 550e8400-e29b-41d4-a716-446655440000")).toEqual({
        type: "compose",
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("is case-insensitive for command name", () => {
      expect(parseCommand("/COMPOSE my-anim")).toEqual({ type: "compose", id: "my-anim" });
      expect(parseCommand("/Compose other")).toEqual({ type: "compose", id: "other" });
    });

    it("returns error for missing argument", () => {
      const result = parseCommand("/compose");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("takes only the first argument as id", () => {
      expect(parseCommand("/compose id-1 extra-arg")).toEqual({ type: "compose", id: "id-1" });
    });
  });

  describe("/layers", () => {
    it("parses /layers", () => {
      expect(parseCommand("/layers")).toEqual({ type: "layers" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/LAYERS")).toEqual({ type: "layers" });
      expect(parseCommand("/Layers")).toEqual({ type: "layers" });
    });
  });

  describe("/duplicate-layer", () => {
    it("parses with unquoted name", () => {
      expect(parseCommand("/duplicate-layer Background")).toEqual({ type: "duplicate_layer", name: "Background" });
    });

    it("parses with quoted name", () => {
      expect(parseCommand('/duplicate-layer "My Layer"')).toEqual({ type: "duplicate_layer", name: "My Layer" });
    });

    it("parses with single-quoted name", () => {
      expect(parseCommand("/duplicate-layer 'Shape Layer 1'")).toEqual({ type: "duplicate_layer", name: "Shape Layer 1" });
    });

    it("is case-insensitive for command", () => {
      expect(parseCommand("/DUPLICATE-LAYER circle")).toEqual({ type: "duplicate_layer", name: "circle" });
    });

    it("returns error for missing name", () => {
      const result = parseCommand("/duplicate-layer");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("takes multi-word unquoted input as full name", () => {
      expect(parseCommand("/duplicate-layer Shape Layer 1")).toEqual({ type: "duplicate_layer", name: "Shape Layer 1" });
    });
  });

  describe("/delete-layer", () => {
    it("parses with unquoted name", () => {
      expect(parseCommand("/delete-layer Background")).toEqual({ type: "delete_layer", name: "Background" });
    });

    it("parses with quoted name", () => {
      expect(parseCommand('/delete-layer "My Layer"')).toEqual({ type: "delete_layer", name: "My Layer" });
    });

    it("is case-insensitive for command", () => {
      expect(parseCommand("/DELETE-LAYER test")).toEqual({ type: "delete_layer", name: "test" });
    });

    it("returns error for missing name", () => {
      const result = parseCommand("/delete-layer");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });
  });

  describe("/rename-layer", () => {
    it("parses with two unquoted names", () => {
      expect(parseCommand("/rename-layer OldName NewName")).toEqual({
        type: "rename_layer",
        oldName: "OldName",
        newName: "NewName",
      });
    });

    it("parses with two quoted names", () => {
      expect(parseCommand('/rename-layer "Old Name" "New Name"')).toEqual({
        type: "rename_layer",
        oldName: "Old Name",
        newName: "New Name",
      });
    });

    it("parses with first quoted, second unquoted", () => {
      expect(parseCommand('/rename-layer "Shape Layer" Background')).toEqual({
        type: "rename_layer",
        oldName: "Shape Layer",
        newName: "Background",
      });
    });

    it("parses with first unquoted, second quoted", () => {
      expect(parseCommand('/rename-layer Circle "My Circle"')).toEqual({
        type: "rename_layer",
        oldName: "Circle",
        newName: "My Circle",
      });
    });

    it("is case-insensitive for command", () => {
      expect(parseCommand("/RENAME-LAYER old new")).toEqual({
        type: "rename_layer",
        oldName: "old",
        newName: "new",
      });
    });

    it("returns error for missing arguments", () => {
      const result = parseCommand("/rename-layer");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for single argument", () => {
      const result = parseCommand("/rename-layer OnlyOne");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });
  });

  describe("/critique", () => {
    it("parses /critique", () => {
      expect(parseCommand("/critique")).toEqual({ type: "critique" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/CRITIQUE")).toEqual({ type: "critique" });
      expect(parseCommand("/Critique")).toEqual({ type: "critique" });
    });

    it("handles leading/trailing whitespace", () => {
      expect(parseCommand("  /critique  ")).toEqual({ type: "critique" });
    });
  });

  describe("/polish", () => {
    it("parses /polish", () => {
      expect(parseCommand("/polish")).toEqual({ type: "polish" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/POLISH")).toEqual({ type: "polish" });
      expect(parseCommand("/Polish")).toEqual({ type: "polish" });
    });

    it("handles leading/trailing whitespace", () => {
      expect(parseCommand("  /polish  ")).toEqual({ type: "polish" });
    });
  });

  describe("/sequence", () => {
    it("returns error for no subcommand", () => {
      const result = parseCommand("/sequence");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /sequence create <name>", () => {
      expect(parseCommand("/sequence create My Storyboard")).toEqual({
        type: "sequence_create",
        name: "My Storyboard",
      });
    });

    it("returns error for /sequence create without name", () => {
      const result = parseCommand("/sequence create");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /sequence add with name", () => {
      expect(parseCommand("/sequence add My Sequence")).toEqual({
        type: "sequence_add",
        name: "My Sequence",
      });
    });

    it("parses /sequence add without name", () => {
      expect(parseCommand("/sequence add")).toEqual({
        type: "sequence_add",
        name: undefined,
      });
    });

    it("parses /sequence list", () => {
      expect(parseCommand("/sequence list")).toEqual({ type: "sequence_list" });
    });

    it("parses /sequence show <name>", () => {
      expect(parseCommand("/sequence show Intro Sequence")).toEqual({
        type: "sequence_show",
        name: "Intro Sequence",
      });
    });

    it("returns error for /sequence show without name", () => {
      const result = parseCommand("/sequence show");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /sequence reorder <name> <positions>", () => {
      expect(parseCommand("/sequence reorder intro 3 1 2")).toEqual({
        type: "sequence_reorder",
        name: "intro",
        positions: "3 1 2",
      });
    });

    it("returns error for /sequence reorder without enough args", () => {
      expect(parseCommand("/sequence reorder")).toEqual({
        type: "error",
        message: expect.stringContaining("Usage"),
      });
      expect(parseCommand("/sequence reorder intro")).toEqual({
        type: "error",
        message: expect.stringContaining("Usage"),
      });
    });

    it("parses /sequence delete <name>", () => {
      expect(parseCommand("/sequence delete My Sequence")).toEqual({
        type: "sequence_delete",
        name: "My Sequence",
      });
    });

    it("returns error for /sequence delete without name", () => {
      const result = parseCommand("/sequence delete");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for unknown subcommand", () => {
      const result = parseCommand("/sequence foo");
      expect(result).toEqual({
        type: "error",
        message: expect.stringContaining("Unknown sequence subcommand"),
      });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/SEQUENCE LIST")).toEqual({ type: "sequence_list" });
      expect(parseCommand("/Sequence Create test")).toEqual({
        type: "sequence_create",
        name: "test",
      });
    });

    it("parses /sequence play <name>", () => {
      expect(parseCommand("/sequence play My Storyboard")).toEqual({
        type: "sequence_play",
        name: "My Storyboard",
      });
    });

    it("returns error for /sequence play without name", () => {
      const result = parseCommand("/sequence play");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });
  });

  describe("/trim", () => {
    it("parses frame range", () => {
      expect(parseCommand("/trim 30-60")).toEqual({
        type: "trim",
        range: { start: { value: 30, unit: "frame" }, end: { value: 60, unit: "frame" } },
      });
    });

    it("parses seconds range", () => {
      expect(parseCommand("/trim 1s-2.5s")).toEqual({
        type: "trim",
        range: { start: { value: 1, unit: "seconds" }, end: { value: 2.5, unit: "seconds" } },
      });
    });

    it("parses ms range", () => {
      expect(parseCommand("/trim 0-500ms")).toEqual({
        type: "trim",
        range: { start: { value: 0, unit: "frame" }, end: { value: 500, unit: "ms" } },
      });
    });

    it("parses percentage range with start keyword", () => {
      expect(parseCommand("/trim start-50%")).toEqual({
        type: "trim",
        range: { start: { value: 0, unit: "start" }, end: { value: 50, unit: "percent" } },
      });
    });

    it("parses percentage range with end keyword", () => {
      expect(parseCommand("/trim 50%-end")).toEqual({
        type: "trim",
        range: { start: { value: 50, unit: "percent" }, end: { value: 0, unit: "end" } },
      });
    });

    it("returns error for missing args", () => {
      const result = parseCommand("/trim");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid range", () => {
      const result = parseCommand("/trim abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid") });
    });
  });

  describe("/mirror", () => {
    it("parses /mirror h as mirror_h", () => {
      expect(parseCommand("/mirror h")).toEqual({ type: "mirror_h" });
    });

    it("parses /mirror horizontal as mirror_h", () => {
      expect(parseCommand("/mirror horizontal")).toEqual({ type: "mirror_h" });
    });

    it("parses /mirror v as mirror_v", () => {
      expect(parseCommand("/mirror v")).toEqual({ type: "mirror_v" });
    });

    it("parses /mirror vertical as mirror_v", () => {
      expect(parseCommand("/mirror vertical")).toEqual({ type: "mirror_v" });
    });

    it("is case-insensitive for command and argument", () => {
      expect(parseCommand("/MIRROR H")).toEqual({ type: "mirror_h" });
      expect(parseCommand("/Mirror Horizontal")).toEqual({ type: "mirror_h" });
      expect(parseCommand("/mirror V")).toEqual({ type: "mirror_v" });
      expect(parseCommand("/MIRROR VERTICAL")).toEqual({ type: "mirror_v" });
    });

    it("returns error for missing argument", () => {
      const result = parseCommand("/mirror");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid argument", () => {
      const result = parseCommand("/mirror diagonal");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown mirror axis") });
    });

    it("handles leading/trailing whitespace", () => {
      expect(parseCommand("  /mirror h  ")).toEqual({ type: "mirror_h" });
    });
  });

  describe("/rotate", () => {
    it("parses /rotate 90", () => {
      expect(parseCommand("/rotate 90")).toEqual({ type: "rotate", degrees: 90 });
    });

    it("parses /rotate -45", () => {
      expect(parseCommand("/rotate -45")).toEqual({ type: "rotate", degrees: -45 });
    });

    it("parses /rotate 90 ccw", () => {
      expect(parseCommand("/rotate 90 ccw")).toEqual({ type: "rotate", degrees: -90 });
    });

    it("parses /rotate 90 counterclockwise", () => {
      expect(parseCommand("/rotate 90 counterclockwise")).toEqual({ type: "rotate", degrees: -90 });
    });

    it("returns error with no args", () => {
      const result = parseCommand("/rotate");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for non-numeric angle", () => {
      const result = parseCommand("/rotate abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid angle") });
    });

    it("handles decimal degrees", () => {
      expect(parseCommand("/rotate 45.5")).toEqual({ type: "rotate", degrees: 45.5 });
    });

    it("is case-insensitive for ccw modifier", () => {
      expect(parseCommand("/rotate 90 CCW")).toEqual({ type: "rotate", degrees: -90 });
      expect(parseCommand("/ROTATE 90 Counterclockwise")).toEqual({ type: "rotate", degrees: -90 });
    });
  });

  describe("/particle", () => {
    it("parses basic /particle confetti", () => {
      expect(parseCommand("/particle confetti")).toEqual({
        type: "particle",
        particleType: "confetti",
        options: {},
      });
    });

    it("parses all valid particle types", () => {
      const types = ["confetti", "snow", "sparkle", "stars", "bubbles", "rain", "fireworks", "hearts"];
      for (const t of types) {
        const result = parseCommand(`/particle ${t}`);
        expect(result).toEqual({ type: "particle", particleType: t, options: {} });
      }
    });

    it("parses with all options", () => {
      expect(parseCommand("/particle snow --count 50 --color cool --direction down --speed slow --size large")).toEqual({
        type: "particle",
        particleType: "snow",
        options: { count: 50, color: "cool", direction: "down", speed: "slow", size: "large" },
      });
    });

    it("parses hex color", () => {
      expect(parseCommand("/particle stars --color #ff00aa")).toEqual({
        type: "particle",
        particleType: "stars",
        options: { color: "#ff00aa" },
      });
    });

    it("returns error with no args", () => {
      const result = parseCommand("/particle");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid type", () => {
      const result = parseCommand("/particle plasma");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown particle type") });
    });

    it("returns error for invalid direction", () => {
      const result = parseCommand("/particle snow --direction diagonal");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid direction") });
    });

    it("returns error for invalid speed", () => {
      const result = parseCommand("/particle snow --speed turbo");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid speed") });
    });

    it("returns error for invalid size", () => {
      const result = parseCommand("/particle snow --size huge");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid size") });
    });

    it("returns error for invalid count", () => {
      const result = parseCommand("/particle snow --count abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid count") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/PARTICLE CONFETTI --SPEED FAST")).toEqual({
        type: "particle",
        particleType: "confetti",
        options: { speed: "fast" },
      });
    });
  });

  describe("/fix", () => {
    it("parses /fix", () => {
      expect(parseCommand("/fix")).toEqual({ type: "fix" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/FIX")).toEqual({ type: "fix" });
    });
  });

  describe("/a11y and /accessibility", () => {
    it("parses /a11y", () => {
      expect(parseCommand("/a11y")).toEqual({ type: "a11y" });
    });

    it("parses /accessibility", () => {
      expect(parseCommand("/accessibility")).toEqual({ type: "a11y" });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/A11Y")).toEqual({ type: "a11y" });
      expect(parseCommand("/ACCESSIBILITY")).toEqual({ type: "a11y" });
    });
  });

  describe("/scale", () => {
    it("parses /scale 2x", () => {
      expect(parseCommand("/scale 2x")).toEqual({ type: "scale", factor: 2 });
    });

    it("parses /scale 0.5x", () => {
      expect(parseCommand("/scale 0.5x")).toEqual({ type: "scale", factor: 0.5 });
    });

    it("parses /scale 150%", () => {
      expect(parseCommand("/scale 150%")).toEqual({ type: "scale", factor: 1.5 });
    });

    it("parses /scale 2 (bare number)", () => {
      expect(parseCommand("/scale 2")).toEqual({ type: "scale", factor: 2 });
    });

    it("returns error for missing arg", () => {
      const result = parseCommand("/scale");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid value", () => {
      const result = parseCommand("/scale abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid scale") });
    });

    it("returns error for zero", () => {
      const result = parseCommand("/scale 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid scale") });
    });

    it("returns error for negative", () => {
      const result = parseCommand("/scale -1x");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid scale") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/SCALE 2X")).toEqual({ type: "scale", factor: 2 });
    });
  });

  describe("/color", () => {
    it("parses /color palette", () => {
      expect(parseCommand("/color palette")).toEqual({
        type: "color",
        subcommand: { action: "palette" },
      });
    });

    it("parses /color shift <degrees>", () => {
      expect(parseCommand("/color shift 90")).toEqual({
        type: "color",
        subcommand: { action: "shift", degrees: 90 },
      });
    });

    it("returns error for /color shift without degrees", () => {
      const result = parseCommand("/color shift");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for /color shift with invalid degrees", () => {
      const result = parseCommand("/color shift abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid degrees") });
    });

    it("parses /color warm", () => {
      expect(parseCommand("/color warm")).toEqual({
        type: "color",
        subcommand: { action: "warm" },
      });
    });

    it("parses /color cool", () => {
      expect(parseCommand("/color cool")).toEqual({
        type: "color",
        subcommand: { action: "cool" },
      });
    });

    it("parses /color mono and aliases", () => {
      expect(parseCommand("/color mono")).toEqual({ type: "color", subcommand: { action: "mono" } });
      expect(parseCommand("/color monochrome")).toEqual({ type: "color", subcommand: { action: "mono" } });
      expect(parseCommand("/color grayscale")).toEqual({ type: "color", subcommand: { action: "mono" } });
    });

    it("parses /color swap", () => {
      expect(parseCommand("/color swap #ff0000 #00ff00")).toEqual({
        type: "color",
        subcommand: { action: "swap", from: "#ff0000", to: "#00ff00" },
      });
    });

    it("returns error for /color swap without enough args", () => {
      const result = parseCommand("/color swap #ff0000");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /color invert", () => {
      expect(parseCommand("/color invert")).toEqual({
        type: "color",
        subcommand: { action: "invert" },
      });
    });

    it("parses /color saturate", () => {
      expect(parseCommand("/color saturate +20")).toEqual({
        type: "color",
        subcommand: { action: "saturate", amount: 0.2 },
      });
    });

    it("parses /color saturation alias", () => {
      expect(parseCommand("/color saturation -30%")).toEqual({
        type: "color",
        subcommand: { action: "saturate", amount: -0.3 },
      });
    });

    it("returns error for /color saturate without amount", () => {
      const result = parseCommand("/color saturate");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for /color saturate with invalid amount", () => {
      const result = parseCommand("/color saturate abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid amount") });
    });

    it("parses /color brighten", () => {
      expect(parseCommand("/color brighten +10")).toEqual({
        type: "color",
        subcommand: { action: "brighten", amount: 0.1 },
      });
    });

    it("parses /color brightness alias", () => {
      expect(parseCommand("/color brightness -20%")).toEqual({
        type: "color",
        subcommand: { action: "brighten", amount: -0.2 },
      });
    });

    it("returns error for /color brighten without amount", () => {
      const result = parseCommand("/color brighten");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for /color brighten with invalid amount", () => {
      const result = parseCommand("/color brighten abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid amount") });
    });

    it("returns error for missing subcommand", () => {
      const result = parseCommand("/color");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for unknown subcommand", () => {
      const result = parseCommand("/color foo");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown color subcommand") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/COLOR PALETTE")).toEqual({
        type: "color",
        subcommand: { action: "palette" },
      });
    });
  });

  describe("/easing", () => {
    it("parses valid easing presets", () => {
      const presets = ["linear", "ease-in", "ease-out", "ease-in-out", "bounce", "elastic", "spring", "sharp"];
      for (const p of presets) {
        expect(parseCommand(`/easing ${p}`)).toEqual({ type: "easing", preset: p });
      }
    });

    it("returns error for missing arg", () => {
      const result = parseCommand("/easing");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for unknown preset", () => {
      const result = parseCommand("/easing wobble");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown easing preset") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/EASING BOUNCE")).toEqual({ type: "easing", preset: "bounce" });
    });
  });

  describe("/stagger", () => {
    it("parses /stagger 100", () => {
      expect(parseCommand("/stagger 100")).toEqual({ type: "stagger", delayMs: 100, order: "normal" });
    });

    it("parses with reverse order", () => {
      expect(parseCommand("/stagger 50 reverse")).toEqual({ type: "stagger", delayMs: 50, order: "reverse" });
    });

    it("parses with random order", () => {
      expect(parseCommand("/stagger 200 random")).toEqual({ type: "stagger", delayMs: 200, order: "random" });
    });

    it("parses with normal order explicitly", () => {
      expect(parseCommand("/stagger 100 normal")).toEqual({ type: "stagger", delayMs: 100, order: "normal" });
    });

    it("returns error for missing arg", () => {
      const result = parseCommand("/stagger");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid delay", () => {
      const result = parseCommand("/stagger abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid delay") });
    });

    it("returns error for negative delay", () => {
      const result = parseCommand("/stagger -10");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid delay") });
    });

    it("returns error for unknown order", () => {
      const result = parseCommand("/stagger 100 zigzag");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown order") });
    });
  });

  describe("/help and aliases", () => {
    it("parses /help", () => {
      expect(parseCommand("/help")).toEqual({ type: "help" });
    });

    it("parses /commands", () => {
      expect(parseCommand("/commands")).toEqual({ type: "help" });
    });

    it("parses /?", () => {
      expect(parseCommand("/?")).toEqual({ type: "help" });
    });
  });

  describe("/plugins", () => {
    it("parses /plugins", () => {
      expect(parseCommand("/plugins")).toEqual({ type: "plugins_list" });
    });
  });

  describe("/plugin", () => {
    it("parses /plugin install <slug>", () => {
      expect(parseCommand("/plugin install my-plugin")).toEqual({ type: "plugin_install", slug: "my-plugin" });
    });

    it("parses /plugin remove <slug>", () => {
      expect(parseCommand("/plugin remove my-plugin")).toEqual({ type: "plugin_remove", slug: "my-plugin" });
    });

    it("parses /plugin uninstall <slug>", () => {
      expect(parseCommand("/plugin uninstall my-plugin")).toEqual({ type: "plugin_remove", slug: "my-plugin" });
    });

    it("returns error for missing subcommand", () => {
      const result = parseCommand("/plugin");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for install without slug", () => {
      const result = parseCommand("/plugin install");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for remove without slug", () => {
      const result = parseCommand("/plugin remove");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for unknown subcommand", () => {
      const result = parseCommand("/plugin update foo");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown plugin subcommand") });
    });
  });

  describe("/reverse", () => {
    it("parses /reverse", () => {
      expect(parseCommand("/reverse")).toEqual({ type: "reverse" });
    });
  });

  describe("/marker", () => {
    it("parses /marker add", () => {
      expect(parseCommand("/marker add intro 0-30")).toEqual({
        type: "marker_add",
        name: "intro",
        startFrame: 0,
        endFrame: 30,
      });
    });

    it("returns error for /marker add without enough args", () => {
      expect(parseCommand("/marker add")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid range format", () => {
      expect(parseCommand("/marker add intro abc")).toEqual({ type: "error", message: expect.stringContaining("Invalid frame range") });
    });

    it("returns error when start >= end", () => {
      expect(parseCommand("/marker add intro 30-30")).toEqual({ type: "error", message: expect.stringContaining("Start frame must be less") });
    });

    it("parses /marker remove", () => {
      expect(parseCommand("/marker remove intro")).toEqual({ type: "marker_remove", name: "intro" });
    });

    it("parses /marker delete alias", () => {
      expect(parseCommand("/marker delete intro")).toEqual({ type: "marker_remove", name: "intro" });
    });

    it("returns error for /marker remove without name", () => {
      expect(parseCommand("/marker remove")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /marker list", () => {
      expect(parseCommand("/marker list")).toEqual({ type: "marker_list" });
    });

    it("parses /marker clear", () => {
      expect(parseCommand("/marker clear")).toEqual({ type: "marker_clear" });
    });

    it("returns error for missing subcommand", () => {
      expect(parseCommand("/marker")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for unknown subcommand", () => {
      expect(parseCommand("/marker foo")).toEqual({ type: "error", message: expect.stringContaining("Unknown marker subcommand") });
    });
  });

  describe("/import", () => {
    it("parses valid https URL", () => {
      expect(parseCommand("/import https://lottie.host/abc/animation.json")).toEqual({
        type: "import",
        url: "https://lottie.host/abc/animation.json",
      });
    });

    it("parses valid http URL", () => {
      expect(parseCommand("/import http://example.com/anim.json")).toEqual({
        type: "import",
        url: "http://example.com/anim.json",
      });
    });

    it("returns error for non-http protocol", () => {
      expect(parseCommand("/import ftp://example.com/file")).toEqual({ type: "error", message: expect.stringContaining("http or https") });
    });

    it("returns error for invalid URL", () => {
      expect(parseCommand("/import not-a-url")).toEqual({ type: "error", message: expect.stringContaining("Invalid URL") });
    });

    it("returns error for missing URL", () => {
      expect(parseCommand("/import")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });
  });

  describe("/theme", () => {
    it("parses /theme with no args as show", () => {
      expect(parseCommand("/theme")).toEqual({ type: "theme", subcommand: { action: "show" } });
    });

    it("parses /theme show", () => {
      expect(parseCommand("/theme show")).toEqual({ type: "theme", subcommand: { action: "show" } });
    });

    it("parses /theme clear", () => {
      expect(parseCommand("/theme clear")).toEqual({ type: "theme", subcommand: { action: "clear" } });
    });

    it("parses /theme reset alias", () => {
      expect(parseCommand("/theme reset")).toEqual({ type: "theme", subcommand: { action: "clear" } });
    });

    it("parses /theme set with valid key", () => {
      expect(parseCommand("/theme set primary #3B82F6")).toEqual({
        type: "theme",
        subcommand: { action: "set", key: "primary", value: "#3B82F6" },
      });
    });

    it("parses /theme set font with multi-word value", () => {
      expect(parseCommand("/theme set font Inter Bold")).toEqual({
        type: "theme",
        subcommand: { action: "set", key: "font", value: "Inter Bold" },
      });
    });

    it("returns error for /theme set without enough args", () => {
      expect(parseCommand("/theme set")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
      expect(parseCommand("/theme set primary")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid theme key", () => {
      expect(parseCommand("/theme set invalid #000")).toEqual({ type: "error", message: expect.stringContaining("Invalid theme key") });
    });

    it("returns error for unknown subcommand", () => {
      expect(parseCommand("/theme foo")).toEqual({ type: "error", message: expect.stringContaining("Unknown theme subcommand") });
    });
  });

  describe("/variations", () => {
    it("parses /variations with prompt", () => {
      expect(parseCommand("/variations a bouncing ball")).toEqual({ type: "variations", prompt: "a bouncing ball" });
    });

    it("returns error for empty prompt", () => {
      expect(parseCommand("/variations")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });
  });

  describe("/random", () => {
    it("parses /random", () => {
      expect(parseCommand("/random")).toEqual({ type: "random" });
    });
  });

  describe("/presets", () => {
    it("parses /presets as list", () => {
      expect(parseCommand("/presets")).toEqual({ type: "presets", subcommand: "list" });
    });

    it("parses /presets list", () => {
      expect(parseCommand("/presets list")).toEqual({ type: "presets", subcommand: "list" });
    });

    it("parses /preset alias as list", () => {
      expect(parseCommand("/preset")).toEqual({ type: "presets", subcommand: "list" });
    });

    it("parses /presets save", () => {
      expect(parseCommand("/presets save mypreset some description")).toEqual({
        type: "presets",
        subcommand: { action: "save", name: "mypreset", description: "some description" },
      });
    });

    it("parses /presets save without description", () => {
      expect(parseCommand("/presets save mypreset")).toEqual({
        type: "presets",
        subcommand: { action: "save", name: "mypreset", description: undefined },
      });
    });

    it("returns error for /presets save without name", () => {
      expect(parseCommand("/presets save")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /presets delete", () => {
      expect(parseCommand("/presets delete mypreset")).toEqual({
        type: "presets",
        subcommand: { action: "delete", name: "mypreset" },
      });
    });

    it("parses /presets remove alias", () => {
      expect(parseCommand("/presets remove mypreset")).toEqual({
        type: "presets",
        subcommand: { action: "delete", name: "mypreset" },
      });
    });

    it("returns error for /presets delete without name", () => {
      expect(parseCommand("/presets delete")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /presets rename", () => {
      expect(parseCommand("/presets rename oldname newname")).toEqual({
        type: "presets",
        subcommand: { action: "rename", oldName: "oldname", newName: "newname" },
      });
    });

    it("returns error for /presets rename without enough args", () => {
      expect(parseCommand("/presets rename oldname")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("parses /presets info", () => {
      expect(parseCommand("/presets info mypreset")).toEqual({
        type: "presets",
        subcommand: { action: "info", name: "mypreset" },
      });
    });

    it("parses /presets show alias for info", () => {
      expect(parseCommand("/presets show mypreset")).toEqual({
        type: "presets",
        subcommand: { action: "info", name: "mypreset" },
      });
    });

    it("returns error for /presets info without name", () => {
      expect(parseCommand("/presets info")).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for unknown subcommand", () => {
      expect(parseCommand("/presets foo")).toEqual({ type: "error", message: expect.stringContaining("Unknown presets subcommand") });
    });
  });

  describe("/morph", () => {
    it("parses basic /morph circle", () => {
      expect(parseCommand("/morph circle")).toEqual({
        type: "morph",
        shape: "circle",
        options: {},
      });
    });

    it("parses all valid shapes", () => {
      const shapes = ["circle", "star", "rect", "rectangle", "triangle", "heart", "diamond", "hexagon", "pentagon"];
      for (const s of shapes) {
        const result = parseCommand(`/morph ${s}`);
        expect(result).toEqual({ type: "morph", shape: s, options: {} });
      }
    });

    it("parses with --duration", () => {
      expect(parseCommand("/morph star --duration 2")).toEqual({
        type: "morph",
        shape: "star",
        options: { duration: 2 },
      });
    });

    it("parses with --easing", () => {
      expect(parseCommand("/morph triangle --easing bounce")).toEqual({
        type: "morph",
        shape: "triangle",
        options: { easing: "bounce" },
      });
    });

    it("parses with --layer string name", () => {
      expect(parseCommand("/morph heart --layer Background")).toEqual({
        type: "morph",
        shape: "heart",
        options: { layer: "Background" },
      });
    });

    it("parses with --layer numeric index", () => {
      expect(parseCommand("/morph diamond --layer 3")).toEqual({
        type: "morph",
        shape: "diamond",
        options: { layer: 3 },
      });
    });

    it("parses with all options combined", () => {
      expect(parseCommand("/morph hexagon --duration 1.5 --easing ease-in --layer 0")).toEqual({
        type: "morph",
        shape: "hexagon",
        options: { duration: 1.5, easing: "ease-in", layer: 0 },
      });
    });

    it("returns error for missing shape", () => {
      const result = parseCommand("/morph");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid shape", () => {
      const result = parseCommand("/morph blob");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown shape") });
    });

    it("returns error for invalid duration", () => {
      const result = parseCommand("/morph circle --duration abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for zero duration", () => {
      const result = parseCommand("/morph circle --duration 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for negative duration", () => {
      const result = parseCommand("/morph circle --duration -1");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/MORPH CIRCLE")).toEqual({
        type: "morph",
        shape: "circle",
        options: {},
      });
    });
  });

  describe("/draw", () => {
    it("parses /draw with no options", () => {
      expect(parseCommand("/draw")).toEqual({ type: "draw", options: {} });
    });

    it("parses with --duration", () => {
      expect(parseCommand("/draw --duration 2")).toEqual({
        type: "draw",
        options: { duration: 2 },
      });
    });

    it("parses with --easing", () => {
      expect(parseCommand("/draw --easing ease-out")).toEqual({
        type: "draw",
        options: { easing: "ease-out" },
      });
    });

    it("parses with --reverse flag", () => {
      expect(parseCommand("/draw --reverse")).toEqual({
        type: "draw",
        options: { reverse: true },
      });
    });

    it("parses with bare reverse keyword", () => {
      expect(parseCommand("/draw reverse")).toEqual({
        type: "draw",
        options: { reverse: true },
      });
    });

    it("parses with --stagger", () => {
      expect(parseCommand("/draw --stagger 0.2")).toEqual({
        type: "draw",
        options: { stagger: 0.2 },
      });
    });

    it("parses with --from and --to", () => {
      expect(parseCommand("/draw --from 10 --to 90")).toEqual({
        type: "draw",
        options: { from: 10, to: 90 },
      });
    });

    it("parses with all options combined", () => {
      expect(parseCommand("/draw --duration 1.5 --easing linear --reverse --stagger 0.1 --from 0 --to 100")).toEqual({
        type: "draw",
        options: { duration: 1.5, easing: "linear", reverse: true, stagger: 0.1, from: 0, to: 100 },
      });
    });

    it("returns error for invalid duration", () => {
      const result = parseCommand("/draw --duration abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for zero duration", () => {
      const result = parseCommand("/draw --duration 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for invalid stagger", () => {
      const result = parseCommand("/draw --stagger -1");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid stagger") });
    });

    it("returns error for non-numeric stagger", () => {
      const result = parseCommand("/draw --stagger abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid stagger") });
    });

    it("returns error for invalid from value", () => {
      const result = parseCommand("/draw --from -5");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid from value") });
    });

    it("returns error for from over 100", () => {
      const result = parseCommand("/draw --from 150");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid from value") });
    });

    it("returns error for invalid to value", () => {
      const result = parseCommand("/draw --to abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid to value") });
    });

    it("returns error for to over 100", () => {
      const result = parseCommand("/draw --to 200");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid to value") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/DRAW --REVERSE")).toEqual({
        type: "draw",
        options: { reverse: true },
      });
    });
  });

  describe("/fade", () => {
    it("parses /fade in", () => {
      expect(parseCommand("/fade in")).toEqual({
        type: "fade",
        mode: "in",
        options: { mode: "in" },
      });
    });

    it("parses all valid modes", () => {
      const modes = ["in", "out", "in-out", "pulse"];
      for (const m of modes) {
        const result = parseCommand(`/fade ${m}`);
        expect(result).toEqual({ type: "fade", mode: m, options: { mode: m } });
      }
    });

    it("parses with --duration", () => {
      expect(parseCommand("/fade out --duration 0.5")).toEqual({
        type: "fade",
        mode: "out",
        options: { mode: "out", duration: 0.5 },
      });
    });

    it("parses with --easing", () => {
      expect(parseCommand("/fade in --easing ease-in")).toEqual({
        type: "fade",
        mode: "in",
        options: { mode: "in", easing: "ease-in" },
      });
    });

    it("parses with --layer", () => {
      expect(parseCommand("/fade out --layer Background")).toEqual({
        type: "fade",
        mode: "out",
        options: { mode: "out", layer: "Background" },
      });
    });

    it("parses with --stagger", () => {
      expect(parseCommand("/fade in --stagger 0.3")).toEqual({
        type: "fade",
        mode: "in",
        options: { mode: "in", stagger: 0.3 },
      });
    });

    it("parses with --from and --to", () => {
      expect(parseCommand("/fade in-out --from 20 --to 80")).toEqual({
        type: "fade",
        mode: "in-out",
        options: { mode: "in-out", from: 20, to: 80 },
      });
    });

    it("parses with --delay", () => {
      expect(parseCommand("/fade pulse --delay 1")).toEqual({
        type: "fade",
        mode: "pulse",
        options: { mode: "pulse", delay: 1 },
      });
    });

    it("parses with all options", () => {
      expect(parseCommand("/fade in --duration 2 --easing bounce --layer Circle --stagger 0.1 --from 0 --to 100 --delay 0.5")).toEqual({
        type: "fade",
        mode: "in",
        options: { mode: "in", duration: 2, easing: "bounce", layer: "Circle", stagger: 0.1, from: 0, to: 100, delay: 0.5 },
      });
    });

    it("returns error for missing mode", () => {
      const result = parseCommand("/fade");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid mode", () => {
      const result = parseCommand("/fade blink");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown fade mode") });
    });

    it("returns error for invalid duration", () => {
      const result = parseCommand("/fade in --duration 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for invalid stagger", () => {
      const result = parseCommand("/fade in --stagger -1");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid stagger") });
    });

    it("returns error for invalid from value", () => {
      const result = parseCommand("/fade in --from 150");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid from value") });
    });

    it("returns error for invalid to value", () => {
      const result = parseCommand("/fade in --to -5");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid to value") });
    });

    it("returns error for invalid delay", () => {
      const result = parseCommand("/fade in --delay -1");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid delay") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/FADE IN")).toEqual({
        type: "fade",
        mode: "in",
        options: { mode: "in" },
      });
    });
  });

  describe("/slide", () => {
    it("parses /slide left", () => {
      expect(parseCommand("/slide left")).toEqual({
        type: "slide",
        direction: "left",
        options: { direction: "left" },
      });
    });

    it("parses all valid directions", () => {
      const dirs = ["left", "right", "up", "down"];
      for (const d of dirs) {
        const result = parseCommand(`/slide ${d}`);
        expect(result).toEqual({ type: "slide", direction: d, options: { direction: d } });
      }
    });

    it("parses with --out", () => {
      expect(parseCommand("/slide right --out")).toEqual({
        type: "slide",
        direction: "right",
        options: { direction: "right", out: true },
      });
    });

    it("parses with --duration", () => {
      expect(parseCommand("/slide up --duration 1.5")).toEqual({
        type: "slide",
        direction: "up",
        options: { direction: "up", duration: 1.5 },
      });
    });

    it("parses with --easing", () => {
      expect(parseCommand("/slide down --easing elastic")).toEqual({
        type: "slide",
        direction: "down",
        options: { direction: "down", easing: "elastic" },
      });
    });

    it("parses with --layer", () => {
      expect(parseCommand("/slide left --layer Title")).toEqual({
        type: "slide",
        direction: "left",
        options: { direction: "left", layer: "Title" },
      });
    });

    it("parses with --stagger", () => {
      expect(parseCommand("/slide right --stagger 0.2")).toEqual({
        type: "slide",
        direction: "right",
        options: { direction: "right", stagger: 0.2 },
      });
    });

    it("parses with --distance", () => {
      expect(parseCommand("/slide up --distance 200")).toEqual({
        type: "slide",
        direction: "up",
        options: { direction: "up", distance: 200 },
      });
    });

    it("parses with --from and --to", () => {
      expect(parseCommand("/slide down --from 10 --to 50")).toEqual({
        type: "slide",
        direction: "down",
        options: { direction: "down", from: 10, to: 50 },
      });
    });

    it("parses with all options", () => {
      expect(parseCommand("/slide left --out --duration 2 --easing spring --layer BG --stagger 0.1 --distance 300 --from 0 --to 100")).toEqual({
        type: "slide",
        direction: "left",
        options: { direction: "left", out: true, duration: 2, easing: "spring", layer: "BG", stagger: 0.1, distance: 300, from: 0, to: 100 },
      });
    });

    it("returns error for missing direction", () => {
      const result = parseCommand("/slide");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid direction", () => {
      const result = parseCommand("/slide diagonal");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Unknown slide direction") });
    });

    it("returns error for invalid duration", () => {
      const result = parseCommand("/slide left --duration 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid duration") });
    });

    it("returns error for invalid stagger", () => {
      const result = parseCommand("/slide left --stagger -1");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid stagger") });
    });

    it("returns error for invalid distance", () => {
      const result = parseCommand("/slide left --distance 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid distance") });
    });

    it("returns error for invalid from value", () => {
      const result = parseCommand("/slide left --from -5");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid from value") });
    });

    it("returns error for invalid to value", () => {
      const result = parseCommand("/slide left --to -1");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid to value") });
    });

    it("is case-insensitive", () => {
      expect(parseCommand("/SLIDE LEFT --OUT")).toEqual({
        type: "slide",
        direction: "left",
        options: { direction: "left", out: true },
      });
    });
  });

  describe("/text", () => {
    it("parses unquoted text", () => {
      expect(parseCommand("/text Hello")).toEqual({
        type: "text",
        text: "Hello",
        options: {},
      });
    });

    it("parses multi-word unquoted text until flag", () => {
      expect(parseCommand("/text Hello World --color red")).toEqual({
        type: "text",
        text: "Hello World",
        options: { color: "red" },
      });
    });

    it("parses quoted text", () => {
      expect(parseCommand('/text "Hello World"')).toEqual({
        type: "text",
        text: "Hello World",
        options: {},
      });
    });

    it("parses quoted text with flags after", () => {
      expect(parseCommand('/text "My Title" --style bounce --size 48')).toEqual({
        type: "text",
        text: "My Title",
        options: { style: "bounce", size: 48 },
      });
    });

    it("parses with --style", () => {
      expect(parseCommand("/text Hello --style typewriter")).toEqual({
        type: "text",
        text: "Hello",
        options: { style: "typewriter" },
      });
    });

    it("parses with --font alias for --style", () => {
      expect(parseCommand("/text Hello --font wave")).toEqual({
        type: "text",
        text: "Hello",
        options: { style: "wave" },
      });
    });

    it("parses with --color", () => {
      expect(parseCommand("/text Hello --color #ff0000")).toEqual({
        type: "text",
        text: "Hello",
        options: { color: "#ff0000" },
      });
    });

    it("parses with --size", () => {
      expect(parseCommand("/text Hello --size 72")).toEqual({
        type: "text",
        text: "Hello",
        options: { size: 72 },
      });
    });

    it("parses with --align", () => {
      expect(parseCommand("/text Hello --align center")).toEqual({
        type: "text",
        text: "Hello",
        options: { align: "center" },
      });
    });

    it("parses with all options", () => {
      expect(parseCommand('/text "Big Title" --style glitch --color #00ff00 --size 64 --align right')).toEqual({
        type: "text",
        text: "Big Title",
        options: { style: "glitch", color: "#00ff00", size: 64, align: "right" },
      });
    });

    it("returns error for empty text", () => {
      const result = parseCommand("/text");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Usage") });
    });

    it("returns error for invalid style", () => {
      const result = parseCommand("/text Hello --style invalid");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid style") });
    });

    it("returns error for invalid size", () => {
      const result = parseCommand("/text Hello --size abc");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid size") });
    });

    it("returns error for zero size", () => {
      const result = parseCommand("/text Hello --size 0");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid size") });
    });

    it("returns error for invalid align", () => {
      const result = parseCommand("/text Hello --align justify");
      expect(result).toEqual({ type: "error", message: expect.stringContaining("Invalid align") });
    });

    it("is case-insensitive for command", () => {
      expect(parseCommand("/TEXT Hello")).toEqual({
        type: "text",
        text: "Hello",
        options: {},
      });
    });
  });
});
