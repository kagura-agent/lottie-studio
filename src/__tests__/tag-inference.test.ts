import { describe, it, expect } from "vitest";
import { inferTags, serializeTags, deserializeTags } from "@/lib/tag-inference";

describe("inferTags", () => {
  it("returns single tag match", () => {
    expect(inferTags("loading spinner")).toEqual(["loading"]);
  });

  it("returns multiple tags for multi-keyword input", () => {
    const tags = inferTags("a circle pattern grid with loading dots");
    expect(tags.length).toBeGreaterThan(1);
    expect(tags).toContain("geometric");
    expect(tags).toContain("loading");
  });

  it("returns max 3 tags even with many keyword matches", () => {
    // Hits loading (dots), geometric (circle, pattern, grid), icon (icon), nature (star)
    const tags = inferTags(
      "circle pattern grid dots icon star fade transition"
    );
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it("returns empty array for no match", () => {
    expect(inferTags("something random xyz")).toEqual([]);
  });

  it("is case insensitive", () => {
    expect(inferTags("LOADING SPINNER")).toEqual(["loading"]);
  });
});

describe("serializeTags/deserializeTags", () => {
  it("round-trips correctly", () => {
    const original: ["loading", "icon"] = ["loading", "icon"];
    const serialized = serializeTags(original);
    const deserialized = deserializeTags(serialized);
    expect(deserialized).toEqual(original);
  });

  it("serializeTags([]) returns empty string", () => {
    expect(serializeTags([])).toBe("");
  });

  it("deserializeTags(null) returns empty array", () => {
    expect(deserializeTags(null)).toEqual([]);
  });

  it("deserializeTags('') returns empty array", () => {
    expect(deserializeTags("")).toEqual([]);
  });

  it("deserializeTags filters invalid tags", () => {
    expect(deserializeTags("loading,invalid_tag,icon")).toEqual([
      "loading",
      "icon",
    ]);
  });
});
