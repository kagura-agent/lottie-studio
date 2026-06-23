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
});
