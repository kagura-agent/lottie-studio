import { describe, it, expect } from "vitest";
import { validateGenerateInput } from "../generate-validation";

describe("validateGenerateInput", () => {
  describe("prompt validation", () => {
    it("rejects missing body", () => {
      const result = validateGenerateInput(null);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("JSON object");
    });

    it("rejects non-object body", () => {
      const result = validateGenerateInput("hello");
      expect(result.valid).toBe(false);
    });

    it("rejects missing prompt", () => {
      const result = validateGenerateInput({});
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("required");
    });

    it("rejects non-string prompt", () => {
      const result = validateGenerateInput({ prompt: 123 });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("string");
    });

    it("rejects empty prompt", () => {
      const result = validateGenerateInput({ prompt: "   " });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("empty");
    });

    it("rejects prompt over 500 chars", () => {
      const result = validateGenerateInput({ prompt: "x".repeat(501) });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("500");
    });

    it("accepts valid prompt at exactly 500 chars", () => {
      const result = validateGenerateInput({ prompt: "x".repeat(500) });
      expect(result.valid).toBe(true);
    });

    it("trims whitespace from prompt", () => {
      const result = validateGenerateInput({ prompt: "  bouncing ball  " });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.prompt).toBe("bouncing ball");
    });
  });

  describe("width validation", () => {
    it("defaults to 512", () => {
      const result = validateGenerateInput({ prompt: "test" });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.width).toBe(512);
    });

    it("accepts valid width", () => {
      const result = validateGenerateInput({ prompt: "test", width: 256 });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.width).toBe(256);
    });

    it("rounds width to integer", () => {
      const result = validateGenerateInput({ prompt: "test", width: 256.7 });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.width).toBe(257);
    });

    it("rejects width below 64", () => {
      const result = validateGenerateInput({ prompt: "test", width: 32 });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("64");
    });

    it("rejects width above 2048", () => {
      const result = validateGenerateInput({ prompt: "test", width: 4096 });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("2048");
    });

    it("rejects non-numeric width", () => {
      const result = validateGenerateInput({ prompt: "test", width: "big" });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("finite number");
    });

    it("rejects Infinity width", () => {
      const result = validateGenerateInput({ prompt: "test", width: Infinity });
      expect(result.valid).toBe(false);
    });
  });

  describe("height validation", () => {
    it("defaults to 512", () => {
      const result = validateGenerateInput({ prompt: "test" });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.height).toBe(512);
    });

    it("accepts valid height", () => {
      const result = validateGenerateInput({ prompt: "test", height: 1024 });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.height).toBe(1024);
    });

    it("rejects height below 64", () => {
      const result = validateGenerateInput({ prompt: "test", height: 10 });
      expect(result.valid).toBe(false);
    });

    it("rejects height above 2048", () => {
      const result = validateGenerateInput({ prompt: "test", height: 3000 });
      expect(result.valid).toBe(false);
    });
  });

  describe("duration validation", () => {
    it("defaults to 2 seconds", () => {
      const result = validateGenerateInput({ prompt: "test" });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.duration).toBe(2);
    });

    it("accepts valid duration", () => {
      const result = validateGenerateInput({ prompt: "test", duration: 5 });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.duration).toBe(5);
    });

    it("accepts fractional duration", () => {
      const result = validateGenerateInput({ prompt: "test", duration: 1.5 });
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.data.duration).toBe(1.5);
    });

    it("rejects duration below 0.5", () => {
      const result = validateGenerateInput({ prompt: "test", duration: 0.1 });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("0.5");
    });

    it("rejects duration above 30", () => {
      const result = validateGenerateInput({ prompt: "test", duration: 60 });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("30");
    });

    it("rejects non-numeric duration", () => {
      const result = validateGenerateInput({ prompt: "test", duration: "fast" });
      expect(result.valid).toBe(false);
    });
  });

  describe("full valid input", () => {
    it("accepts all parameters", () => {
      const result = validateGenerateInput({
        prompt: "a spinning star",
        width: 300,
        height: 400,
        duration: 3,
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({
          prompt: "a spinning star",
          width: 300,
          height: 400,
          duration: 3,
        });
      }
    });

    it("ignores unknown fields", () => {
      const result = validateGenerateInput({
        prompt: "test",
        unknown: true,
        extra: "stuff",
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("currentAnimation validation", () => {
    it("accepts valid currentAnimation object", () => {
      const result = validateGenerateInput({
        prompt: "make it bouncier",
        currentAnimation: { v: "5.5.7", fr: 30, layers: [] },
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.currentAnimation).toEqual({ v: "5.5.7", fr: 30, layers: [] });
      }
    });

    it("accepts request without currentAnimation", () => {
      const result = validateGenerateInput({
        prompt: "bouncing ball",
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.currentAnimation).toBeUndefined();
      }
    });

    it("rejects non-object currentAnimation (string)", () => {
      const result = validateGenerateInput({
        prompt: "test",
        currentAnimation: "not an object",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("JSON object");
    });

    it("rejects non-object currentAnimation (number)", () => {
      const result = validateGenerateInput({
        prompt: "test",
        currentAnimation: 42,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("JSON object");
    });

    it("rejects null currentAnimation", () => {
      const result = validateGenerateInput({
        prompt: "test",
        currentAnimation: null,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("JSON object");
    });

    it("rejects array currentAnimation", () => {
      const result = validateGenerateInput({
        prompt: "test",
        currentAnimation: [1, 2, 3],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("JSON object");
    });

    it("rejects oversized currentAnimation (>200KB)", () => {
      const largeAnimation = {
        v: "5.5.7",
        layers: Array.from({ length: 5000 }, (_, i) => ({
          ty: 4,
          nm: `layer_${i}_${'x'.repeat(40)}`,
          ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [256, 256] }, s: { a: 0, k: [100, 100] } },
        })),
      };
      // Ensure it's actually > 200KB
      expect(JSON.stringify(largeAnimation).length).toBeGreaterThan(200 * 1024);

      const result = validateGenerateInput({
        prompt: "test",
        currentAnimation: largeAnimation,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("200KB");
    });
  });
});
