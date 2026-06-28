import { describe, it, expect } from "vitest";
import { parseCommand } from "@/lib/commands";

describe("marker commands", () => {
  describe("/marker add", () => {
    it("parses /marker add intro 0-30", () => {
      const result = parseCommand("/marker add intro 0-30");
      expect(result).toEqual({
        type: "marker_add",
        name: "intro",
        startFrame: 0,
        endFrame: 30,
      });
    });

    it("parses /marker add loop 30-60", () => {
      const result = parseCommand("/marker add loop 30-60");
      expect(result).toEqual({
        type: "marker_add",
        name: "loop",
        startFrame: 30,
        endFrame: 60,
      });
    });

    it("parses large frame numbers", () => {
      const result = parseCommand("/marker add outro 120-300");
      expect(result).toEqual({
        type: "marker_add",
        name: "outro",
        startFrame: 120,
        endFrame: 300,
      });
    });

    it("returns error for missing arguments", () => {
      const result = parseCommand("/marker add");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
    });

    it("returns error for missing range", () => {
      const result = parseCommand("/marker add intro");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
    });

    it("returns error for invalid range format", () => {
      const result = parseCommand("/marker add intro 0to30");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
      if (result!.type === "error") {
        expect(result!.message).toContain("Invalid frame range");
      }
    });

    it("returns error when start >= end", () => {
      const result = parseCommand("/marker add intro 30-30");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
      if (result!.type === "error") {
        expect(result!.message).toContain("Start frame must be less than end frame");
      }
    });

    it("returns error when start > end", () => {
      const result = parseCommand("/marker add intro 60-30");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
      if (result!.type === "error") {
        expect(result!.message).toContain("Start frame must be less than end frame");
      }
    });
  });

  describe("/marker remove", () => {
    it("parses /marker remove intro", () => {
      const result = parseCommand("/marker remove intro");
      expect(result).toEqual({
        type: "marker_remove",
        name: "intro",
      });
    });

    it("parses /marker delete intro (alias)", () => {
      const result = parseCommand("/marker delete intro");
      expect(result).toEqual({
        type: "marker_remove",
        name: "intro",
      });
    });

    it("returns error for missing name", () => {
      const result = parseCommand("/marker remove");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
    });
  });

  describe("/marker list", () => {
    it("parses /marker list", () => {
      const result = parseCommand("/marker list");
      expect(result).toEqual({ type: "marker_list" });
    });
  });

  describe("/marker clear", () => {
    it("parses /marker clear", () => {
      const result = parseCommand("/marker clear");
      expect(result).toEqual({ type: "marker_clear" });
    });
  });

  describe("/marker with no subcommand", () => {
    it("returns error with usage info", () => {
      const result = parseCommand("/marker");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
      if (result!.type === "error") {
        expect(result!.message).toContain("Usage");
      }
    });
  });

  describe("/marker with unknown subcommand", () => {
    it("returns error for unknown subcommand", () => {
      const result = parseCommand("/marker foo");
      expect(result).not.toBeNull();
      expect(result!.type).toBe("error");
      if (result!.type === "error") {
        expect(result!.message).toContain("Unknown marker subcommand");
      }
    });
  });

  describe("edge cases", () => {
    it("handles marker names with special characters", () => {
      const result = parseCommand("/marker add hover-state 0-30");
      expect(result).toEqual({
        type: "marker_add",
        name: "hover-state",
        startFrame: 0,
        endFrame: 30,
      });
    });

    it("handles marker names with underscores", () => {
      const result = parseCommand("/marker add idle_loop 0-60");
      expect(result).toEqual({
        type: "marker_add",
        name: "idle_loop",
        startFrame: 0,
        endFrame: 60,
      });
    });

    it("subcommand is case-insensitive", () => {
      const result = parseCommand("/marker ADD intro 0-30");
      expect(result).toEqual({
        type: "marker_add",
        name: "intro",
        startFrame: 0,
        endFrame: 30,
      });
    });

    it("main command is case-insensitive", () => {
      const result = parseCommand("/MARKER list");
      expect(result).toEqual({ type: "marker_list" });
    });
  });
});
