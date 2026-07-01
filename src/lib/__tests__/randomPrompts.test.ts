import { describe, it, expect } from "vitest";
import {
  randomPromptCategories,
  getRandomPrompt,
  getRandomPromptCount,
} from "../../data/randomPrompts";

describe("randomPrompts", () => {
  it("has at least 50 prompts", () => {
    expect(getRandomPromptCount()).toBeGreaterThanOrEqual(50);
  });

  it("has multiple categories", () => {
    expect(randomPromptCategories.length).toBeGreaterThanOrEqual(5);
  });

  it("every category has a name and at least one prompt", () => {
    for (const cat of randomPromptCategories) {
      expect(cat.name).toBeTruthy();
      expect(cat.prompts.length).toBeGreaterThan(0);
    }
  });

  it("every prompt is a non-empty string", () => {
    const allPrompts = randomPromptCategories.flatMap((cat) => cat.prompts);
    for (const prompt of allPrompts) {
      expect(typeof prompt).toBe("string");
      expect(prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate prompts", () => {
    const allPrompts = randomPromptCategories.flatMap((cat) => cat.prompts);
    const unique = new Set(allPrompts);
    expect(unique.size).toBe(allPrompts.length);
  });

  it("getRandomPrompt returns a string from the pool", () => {
    const allPrompts = randomPromptCategories.flatMap((cat) => cat.prompts);
    const result = getRandomPrompt();
    expect(allPrompts).toContain(result);
  });

  it("getRandomPrompt returns different results over many calls", () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(getRandomPrompt());
    }
    // With 50+ prompts and 100 draws, we should see at least a few unique
    expect(results.size).toBeGreaterThan(1);
  });
});
