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
      expect(parseCommand("/loop")).toEqual({ type: "loop" });
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
});
