import { describe, it, expect, vi } from "vitest";
import { quickStartCategories } from "@/data/quickstart-categories";

// ─── Category data validation ───

describe("quickstart categories data", () => {
  it("has 8 categories", () => {
    expect(quickStartCategories).toHaveLength(8);
  });

  it("each category has emoji, label, and at least 3 prompts", () => {
    for (const category of quickStartCategories) {
      expect(category.emoji).toBeTruthy();
      expect(category.label).toBeTruthy();
      expect(category.prompts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("all prompts are non-empty strings", () => {
    for (const category of quickStartCategories) {
      for (const prompt of category.prompts) {
        expect(typeof prompt).toBe("string");
        expect(prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("has no duplicate labels", () => {
    const labels = quickStartCategories.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("has no duplicate prompts across all categories", () => {
    const prompts = quickStartCategories.flatMap((c) => c.prompts);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("includes expected categories", () => {
    const labels = quickStartCategories.map((c) => c.label);
    expect(labels).toContain("Loading & Progress");
    expect(labels).toContain("Social Media");
    expect(labels).toContain("Icons & UI");
    expect(labels).toContain("Text & Titles");
    expect(labels).toContain("Characters");
    expect(labels).toContain("Abstract & Decorative");
    expect(labels).toContain("Transitions");
    expect(labels).toContain("Celebrations");
  });
});

// ─── QuickStartWizard component ───

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("QuickStartWizard component", () => {
  it("exports a default function component", async () => {
    const mod = await import("@/components/QuickStartWizard");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
