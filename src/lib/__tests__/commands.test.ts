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

    it("returns error for invalid style", () => {
      const result = parseCommand("/style foo");
      expect(result).toEqual({
        type: "error",
        message: expect.stringContaining("Unknown style"),
      });
      expect((result as { message: string }).message).toContain("neon");
      expect((result as { message: string }).message).toContain("nature");
    });

    it("returns error for missing argument", () => {
      const result = parseCommand("/style");
      expect(result).toEqual({
        type: "error",
        message: expect.stringContaining("Usage"),
      });
      expect((result as { message: string }).message).toContain("neon");
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
});
