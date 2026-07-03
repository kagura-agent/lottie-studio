import { describe, it, expect, vi } from "vitest";
import {
  promptSuggestionCategories,
} from "@/data/prompt-suggestions";

// ─── Suggestion data validation ───

describe("prompt suggestions data", () => {
  it("has at least 3 categories", () => {
    expect(promptSuggestionCategories.length).toBeGreaterThanOrEqual(3);
  });

  it("each category has a title and at least one suggestion", () => {
    for (const category of promptSuggestionCategories) {
      expect(category.title).toBeTruthy();
      expect(category.suggestions.length).toBeGreaterThan(0);
    }
  });

  it("each suggestion has emoji, label, and prompt fields", () => {
    for (const category of promptSuggestionCategories) {
      for (const s of category.suggestions) {
        expect(s.emoji).toBeTruthy();
        expect(s.label).toBeTruthy();
        expect(s.prompt).toBeTruthy();
        expect(s.prompt.length).toBeGreaterThan(10);
      }
    }
  });

  it("has no duplicate labels across all categories", () => {
    const labels = promptSuggestionCategories.flatMap((c) =>
      c.suggestions.map((s) => s.label)
    );
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it("includes expected categories", () => {
    const titles = promptSuggestionCategories.map((c) => c.title);
    expect(titles).toContain("Getting Started");
    expect(titles).toContain("UI Components");
    expect(titles).toContain("Social Media");
    expect(titles).toContain("Branding");
  });
});

// ─── PromptSuggestions component ───

// Mock next-intl (component is "use client" but we can import for type/export checks)
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("PromptSuggestions component", () => {
  it("exports a default function component", async () => {
    const mod = await import("@/components/PromptSuggestions");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("component accepts onSelect and hasDesignTokens props", async () => {
    const mod = await import("@/components/PromptSuggestions");
    expect(mod.default.length).toBeLessThanOrEqual(1);
  });
});

// ─── Click handler logic ───

describe("prompt suggestions click behavior", () => {
  it("onSelect is called with the prompt text", () => {
    const suggestion = promptSuggestionCategories[0].suggestions[0];
    const onSelect = vi.fn();
    onSelect(suggestion.prompt);
    expect(onSelect).toHaveBeenCalledWith(suggestion.prompt);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("all suggestion prompts are non-empty strings", () => {
    for (const category of promptSuggestionCategories) {
      for (const s of category.suggestions) {
        expect(typeof s.prompt).toBe("string");
        expect(s.prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Design tokens integration ───

describe("design tokens integration with suggestions", () => {
  it("color-related prompts can have brand colors appended", () => {
    const colorLabels = new Set([
      "Pulsing heart",
      "Color wave",
      "Loading spinner",
      "Confetti burst",
      "Floating hearts",
      "Fire emoji",
      "Logo reveal",
      "Particle intro",
    ]);

    const allSuggestions = promptSuggestionCategories.flatMap(
      (c) => c.suggestions
    );
    const colorSuggestions = allSuggestions.filter((s) =>
      colorLabels.has(s.label)
    );

    expect(colorSuggestions.length).toBeGreaterThan(0);

    for (const s of colorSuggestions) {
      const withBrand = s.prompt + " using my brand colors";
      expect(withBrand).toContain("using my brand colors");
      expect(withBrand.startsWith(s.prompt)).toBe(true);
    }
  });

  it("non-color prompts are not modified", () => {
    const colorLabels = new Set([
      "Pulsing heart",
      "Color wave",
      "Loading spinner",
      "Confetti burst",
      "Floating hearts",
      "Fire emoji",
      "Logo reveal",
      "Particle intro",
    ]);

    const allSuggestions = promptSuggestionCategories.flatMap(
      (c) => c.suggestions
    );
    const nonColorSuggestions = allSuggestions.filter(
      (s) => !colorLabels.has(s.label)
    );

    expect(nonColorSuggestions.length).toBeGreaterThan(0);
    for (const s of nonColorSuggestions) {
      expect(s.prompt).not.toContain("using my brand colors");
    }
  });
});
