import { describe, it, expect } from "vitest";
import {
  inferTags,
  serializeTags,
  deserializeTags,
  TAG_VOCABULARY,
} from "../tag-inference";

describe("inferTags", () => {
  it("returns correct tag for a single keyword", () => {
    expect(inferTags("spinner")).toEqual(["loading"]);
  });

  it("returns multiple tags when prompt matches several rules", () => {
    const tags = inferTags("a spinning circle with confetti");
    expect(tags).toContain("geometric");
    expect(tags).toContain("celebration");
  });

  it("sorts by match confidence (more keyword hits first)", () => {
    const tags = inferTags("flower tree leaf sun moon star cloud rain water wave sakura petal wind spinner");
    expect(tags[0]).toBe("nature");
  });

  it("returns max 3 tags", () => {
    const tags = inferTags("spinner loading text icon circle confetti bell toggle");
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it("matches case-insensitively", () => {
    expect(inferTags("SPINNER")).toEqual(["loading"]);
    expect(inferTags("Confetti")).toEqual(["celebration"]);
  });

  it("returns empty array for empty string", () => {
    expect(inferTags("")).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(inferTags("   ")).toEqual([]);
  });

  it("matches keywords as substrings for compound words", () => {
    const tags = inferTags("sunflower");
    expect(tags).toContain("nature");
  });
});

describe("serializeTags", () => {
  it("produces comma-separated string", () => {
    expect(serializeTags(["loading", "text", "icon"])).toBe("loading,text,icon");
  });

  it("handles single tag", () => {
    expect(serializeTags(["loading"])).toBe("loading");
  });

  it("handles empty array", () => {
    expect(serializeTags([])).toBe("");
  });
});

describe("deserializeTags", () => {
  it("parses comma-separated string back to tags", () => {
    expect(deserializeTags("loading,text,icon")).toEqual(["loading", "text", "icon"]);
  });

  it("filters out invalid tags", () => {
    expect(deserializeTags("loading,invalid,text")).toEqual(["loading", "text"]);
  });

  it("returns empty array for null", () => {
    expect(deserializeTags(null)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(deserializeTags("")).toEqual([]);
  });

  it("round-trips with serializeTags", () => {
    const original = inferTags("spinner with confetti and circle pattern");
    const serialized = serializeTags(original);
    const deserialized = deserializeTags(serialized);
    expect(deserialized).toEqual(original);
  });
});
