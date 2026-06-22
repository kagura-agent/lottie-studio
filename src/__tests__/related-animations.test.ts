import { describe, it, expect } from "vitest";

/**
 * Extract the core tag-overlap ranking logic from the API route
 * so we can test it in isolation without needing a database.
 */

interface AnimationRow {
  id: string;
  name: string;
  tags: string | null;
  description: string | null;
}

function findRelatedByTags(
  currentId: string,
  currentTags: string[],
  allAnimations: AnimationRow[],
  limit: number = 6
): AnimationRow[] {
  // Exclude current animation
  const candidates = allAnimations.filter(
    (a) => a.id !== currentId && a.tags && a.tags !== ""
  );

  const scored = candidates
    .map((row) => {
      const rowTags = row.tags ? row.tags.split(",").filter(Boolean) : [];
      const overlap = rowTags.filter((t) => currentTags.includes(t)).length;
      return { ...row, overlap };
    })
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);

  return scored.map((s) => ({
    id: s.id,
    name: s.name,
    tags: s.tags,
    description: s.description,
  }));
}

function fallbackToRecent(
  currentId: string,
  allAnimations: AnimationRow[],
  limit: number = 6
): AnimationRow[] {
  return allAnimations
    .filter((a) => a.id !== currentId)
    .slice(0, limit);
}

describe("Related animations: tag overlap matching", () => {
  const animations: AnimationRow[] = [
    { id: "1", name: "Spinner", tags: "loading,geometric", description: "A spinner" },
    { id: "2", name: "Bounce", tags: "loading,character", description: "Bouncing" },
    { id: "3", name: "Circle", tags: "geometric,abstract", description: "Circle" },
    { id: "4", name: "Logo", tags: "logo,text", description: "Logo animation" },
    { id: "5", name: "Hearts", tags: "celebration,character", description: "Hearts" },
    { id: "6", name: "Dots", tags: "loading,geometric,abstract", description: "Dots" },
    { id: "7", name: "Badge", tags: "notification,ui-element", description: "Badge" },
    { id: "8", name: "Confetti", tags: "celebration", description: "Confetti" },
    { id: "9", name: "Squares", tags: "geometric", description: "Squares" },
  ];

  it("ranks by tag overlap count descending", () => {
    // Animation "1" has tags: loading, geometric
    // "6" matches both (loading, geometric) → overlap 2
    // "2" matches one (loading) → overlap 1
    // "3" matches one (geometric) → overlap 1
    // "9" matches one (geometric) → overlap 1
    const results = findRelatedByTags("1", ["loading", "geometric"], animations);
    expect(results[0].id).toBe("6"); // highest overlap
    expect(results.length).toBeGreaterThan(1);
  });

  it("excludes the current animation from results", () => {
    const results = findRelatedByTags("1", ["loading", "geometric"], animations);
    expect(results.find((r) => r.id === "1")).toBeUndefined();
  });

  it("limits results to the specified count", () => {
    const results = findRelatedByTags("1", ["loading", "geometric"], animations, 2);
    expect(results.length).toBe(2);
  });

  it("returns empty array when no tags overlap", () => {
    const results = findRelatedByTags("4", ["logo", "text"], animations);
    // No other animation has logo or text tags
    expect(results.length).toBe(0);
  });

  it("ignores animations with null or empty tags", () => {
    const withEmpty: AnimationRow[] = [
      ...animations,
      { id: "10", name: "Empty", tags: null, description: null },
      { id: "11", name: "Blank", tags: "", description: null },
    ];
    const results = findRelatedByTags("1", ["loading"], withEmpty);
    expect(results.find((r) => r.id === "10")).toBeUndefined();
    expect(results.find((r) => r.id === "11")).toBeUndefined();
  });

  it("returns correct shape without overlap field", () => {
    const results = findRelatedByTags("1", ["loading", "geometric"], animations);
    for (const r of results) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("tags");
      expect(r).toHaveProperty("description");
      expect(r).not.toHaveProperty("overlap");
    }
  });
});

describe("Related animations: fallback to recent", () => {
  const animations: AnimationRow[] = [
    { id: "1", name: "First", tags: null, description: null },
    { id: "2", name: "Second", tags: "loading", description: null },
    { id: "3", name: "Third", tags: null, description: null },
    { id: "4", name: "Fourth", tags: "geometric", description: null },
  ];

  it("excludes the current animation", () => {
    const results = fallbackToRecent("1", animations);
    expect(results.find((r) => r.id === "1")).toBeUndefined();
    expect(results.length).toBe(3);
  });

  it("limits results to the specified count", () => {
    const results = fallbackToRecent("1", animations, 2);
    expect(results.length).toBe(2);
  });

  it("returns all non-current animations when fewer than limit", () => {
    const results = fallbackToRecent("1", animations, 10);
    expect(results.length).toBe(3);
  });
});
