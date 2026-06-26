import { describe, it, expect } from "vitest";
import { featureScore, pickFeaturedIndex } from "@/lib/featured-selection";

describe("featureScore", () => {
  it("scores with like_count * 3 + view_count", () => {
    expect(featureScore(10, 50)).toBe(80);
    expect(featureScore(0, 100)).toBe(100);
    expect(featureScore(5, 0)).toBe(15);
  });

  it("handles zero values", () => {
    expect(featureScore(0, 0)).toBe(0);
  });
});

describe("pickFeaturedIndex", () => {
  it("returns 0 for empty candidates", () => {
    expect(pickFeaturedIndex("2026-06-26", 0)).toBe(0);
  });

  it("returns 0 for single candidate", () => {
    expect(pickFeaturedIndex("2026-06-26", 1)).toBe(0);
  });

  it("returns a valid index within range", () => {
    const idx = pickFeaturedIndex("2026-06-26", 10);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(10);
  });

  it("is deterministic — same date always returns same index", () => {
    const a = pickFeaturedIndex("2026-06-26", 10);
    const b = pickFeaturedIndex("2026-06-26", 10);
    expect(a).toBe(b);
  });

  it("different dates produce different selections (at least some)", () => {
    const results = new Set<number>();
    for (let d = 1; d <= 30; d++) {
      const date = `2026-06-${String(d).padStart(2, "0")}`;
      results.add(pickFeaturedIndex(date, 10));
    }
    // With 30 days and 10 slots, we expect at least 3 distinct values
    expect(results.size).toBeGreaterThanOrEqual(3);
  });
});
