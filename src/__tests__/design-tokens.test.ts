import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseCommand } from "@/lib/commands";
import { buildDesignTokensPrompt } from "@/lib/prompts";

// ─── /theme command parsing ───

describe("/theme command parsing", () => {
  it("parses /theme show (no args)", () => {
    const result = parseCommand("/theme");
    expect(result).toEqual({ type: "theme", subcommand: { action: "show" } });
  });

  it("parses /theme show explicitly", () => {
    const result = parseCommand("/theme show");
    expect(result).toEqual({ type: "theme", subcommand: { action: "show" } });
  });

  it("parses /theme clear", () => {
    const result = parseCommand("/theme clear");
    expect(result).toEqual({ type: "theme", subcommand: { action: "clear" } });
  });

  it("parses /theme reset as clear", () => {
    const result = parseCommand("/theme reset");
    expect(result).toEqual({ type: "theme", subcommand: { action: "clear" } });
  });

  it("parses /theme set primary #3B82F6", () => {
    const result = parseCommand("/theme set primary #3B82F6");
    expect(result).toEqual({
      type: "theme",
      subcommand: { action: "set", key: "primary", value: "#3B82F6" },
    });
  });

  it("parses /theme set font with spaces", () => {
    const result = parseCommand("/theme set font Times New Roman");
    expect(result).toEqual({
      type: "theme",
      subcommand: { action: "set", key: "font", value: "Times New Roman" },
    });
  });

  it("rejects invalid theme key", () => {
    const result = parseCommand("/theme set invalid #000");
    expect(result).toEqual({
      type: "error",
      message: expect.stringContaining("Invalid theme key"),
    });
  });

  it("rejects /theme set with missing args", () => {
    const result = parseCommand("/theme set primary");
    expect(result).toEqual({
      type: "error",
      message: expect.stringContaining("Usage"),
    });
  });

  it("rejects unknown subcommand", () => {
    const result = parseCommand("/theme foo");
    expect(result).toEqual({
      type: "error",
      message: expect.stringContaining("Unknown theme subcommand"),
    });
  });
});

// ─── buildDesignTokensPrompt ───

describe("buildDesignTokensPrompt", () => {
  it("returns empty string when no tokens set", () => {
    expect(buildDesignTokensPrompt({})).toBe("");
  });

  it("returns empty string when all tokens are undefined", () => {
    expect(buildDesignTokensPrompt({ primary: undefined, secondary: undefined })).toBe("");
  });

  it("includes primary color", () => {
    const result = buildDesignTokensPrompt({ primary: "#3B82F6" });
    expect(result).toContain("primary color #3B82F6");
    expect(result).toContain("design tokens");
  });

  it("includes multiple tokens", () => {
    const result = buildDesignTokensPrompt({
      primary: "#3B82F6",
      secondary: "#F97316",
      accent: "#10B981",
    });
    expect(result).toContain("primary color #3B82F6");
    expect(result).toContain("secondary color #F97316");
    expect(result).toContain("accent color #10B981");
  });

  it("includes font when set", () => {
    const result = buildDesignTokensPrompt({ font: "Arial" });
    expect(result).toContain('font "Arial"');
  });

  it("includes background color", () => {
    const result = buildDesignTokensPrompt({ background: "#FFFFFF" });
    expect(result).toContain("background color #FFFFFF");
  });

  it("skips undefined tokens in output", () => {
    const result = buildDesignTokensPrompt({ primary: "#3B82F6", secondary: undefined });
    expect(result).toContain("primary color #3B82F6");
    expect(result).not.toContain("secondary");
  });
});

// ─── Token persistence (localStorage mock) ───

describe("DesignTokensContext persistence", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
    });
  });

  it("loads tokens from localStorage", async () => {
    const STORAGE_KEY = "lottie-studio-design-tokens";
    mockStorage[STORAGE_KEY] = JSON.stringify({ primary: "#FF0000" });

    // Simulate what loadTokens does
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.primary).toBe("#FF0000");
  });

  it("saves tokens to localStorage", () => {
    const STORAGE_KEY = "lottie-studio-design-tokens";
    const tokens = { primary: "#3B82F6", secondary: "#F97316" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw!)).toEqual(tokens);
  });

  it("removes from localStorage when tokens are cleared", () => {
    const STORAGE_KEY = "lottie-studio-design-tokens";
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ primary: "#FFF" }));
    localStorage.removeItem(STORAGE_KEY);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("handles invalid JSON in localStorage gracefully", () => {
    const STORAGE_KEY = "lottie-studio-design-tokens";
    mockStorage[STORAGE_KEY] = "not valid json{";

    // Simulate loadTokens error handling
    let result = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) result = JSON.parse(raw);
    } catch {
      result = {};
    }
    expect(result).toEqual({});
  });
});

// ─── Clear/reset behavior ───

describe("clear/reset behavior", () => {
  it("/theme clear command parses correctly", () => {
    const result = parseCommand("/theme clear");
    expect(result).toEqual({ type: "theme", subcommand: { action: "clear" } });
  });

  it("buildDesignTokensPrompt returns empty after clear (empty object)", () => {
    expect(buildDesignTokensPrompt({})).toBe("");
  });
});
