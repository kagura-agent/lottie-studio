import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompts";

describe("buildSystemPrompt", () => {
  it("returns a string", () => {
    const result = buildSystemPrompt(null);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contains Lottie animation expert identity", () => {
    const result = buildSystemPrompt(null);
    expect(result).toContain("Lottie animation expert");
  });

  it("contains json code block examples", () => {
    const result = buildSystemPrompt(null);
    expect(result).toContain("```json");
  });

  it("contains response format instructions", () => {
    const result = buildSystemPrompt(null);
    expect(result).toContain("Response Format");
    expect(result).toContain("SUGGESTIONS:");
  });

  it("contains 512x512 canvas size rule", () => {
    const result = buildSystemPrompt(null);
    expect(result).toContain("512x512");
  });

  it("includes current animation JSON when provided", () => {
    const animation = {
      v: "5.7.1",
      fr: 30,
      ip: 0,
      op: 60,
      w: 512,
      h: 512,
      layers: [{ ty: 4, nm: "Test" }],
    };
    const result = buildSystemPrompt(animation);
    expect(result).toContain("Current Animation");
    expect(result).toContain(JSON.stringify(animation));
    expect(result).toContain("modify");
  });

  it("does not include current animation section when null", () => {
    const result = buildSystemPrompt(null);
    expect(result).not.toContain("Current Animation (to modify)");
  });

  it("includes artboard dimensions when animation has w/h", () => {
    const animation = { v: "5.7.1", w: 800, h: 600, layers: [] };
    const result = buildSystemPrompt(animation);
    expect(result).toContain("800×600");
  });

  it("does not mention artboard dimensions when animation has no w/h", () => {
    const animation = { v: "5.7.1", layers: [] };
    const result = buildSystemPrompt(animation);
    expect(result).not.toMatch(/artboard dimensions are \d+×\d+/);
  });

  it("includes spec sections relevant to user message", () => {
    const result = buildSystemPrompt(null, "add some text");
    expect(result).toContain("Text Layer");
  });

  it("includes example animations section", () => {
    const result = buildSystemPrompt(null, "make a circle");
    expect(result).toContain("Example Animations");
  });

  it("includes easing rules", () => {
    const result = buildSystemPrompt(null);
    expect(result).toContain("easing");
  });
});
