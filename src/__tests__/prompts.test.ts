import { describe, it, expect } from "vitest";
import { analyzeIntent } from "@/lib/prompts";

describe("analyzeIntent", () => {
  it("always includes CORE in result", () => {
    const result = analyzeIntent("hello", null);
    expect(result.has("CORE")).toBe(true);
  });

  it("includes SHAPES by default when no non-shape-only keywords", () => {
    const result = analyzeIntent("make a bouncing ball", null);
    expect(result.has("SHAPES")).toBe(true);
  });

  it("keyword 'text' triggers TEXT section", () => {
    const result = analyzeIntent("add some text animation", null);
    expect(result.has("TEXT")).toBe(true);
  });

  it("keyword 'mask' triggers MASKS section", () => {
    const result = analyzeIntent("apply a mask reveal effect", null);
    expect(result.has("MASKS")).toBe(true);
  });

  it("keyword 'gradient' triggers GRADIENTS section", () => {
    const result = analyzeIntent("use a gradient fill", null);
    expect(result.has("GRADIENTS")).toBe(true);
  });

  it("keyword 'morph' triggers MORPHING section", () => {
    const result = analyzeIntent("morph circle into square", null);
    expect(result.has("MORPHING")).toBe(true);
  });

  it("adds TEXT section when currentAnimation contains text layer (ty:5)", () => {
    const anim = { layers: [{ "ty": 5, nm: "text" }] };
    const result = analyzeIntent("change the color", anim);
    expect(result.has("TEXT")).toBe(true);
  });

  it("adds MASKS section when currentAnimation contains masksProperties", () => {
    const anim = { layers: [{ masksProperties: [{}] }] };
    const result = analyzeIntent("modify it", anim);
    expect(result.has("MASKS")).toBe(true);
  });

  it("multiple keywords can trigger multiple sections", () => {
    const result = analyzeIntent("add gradient text with a mask", null);
    expect(result.has("GRADIENTS")).toBe(true);
    expect(result.has("TEXT")).toBe(true);
    expect(result.has("MASKS")).toBe(true);
  });
});
