import { describe, it, expect } from "vitest";

/**
 * Tests for the batch collection export feature (#324).
 * Validates pure export logic: filename sanitization, dedup, manifest building, validation.
 */

// --- Pure helper functions mirroring export/route.ts logic ---

/** Sanitize a name for use as a filename */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_ .]/g, "_").trim() || "animation";
}

/** Resolve duplicate file names by appending _2, _3, etc. */
function resolveFileNames(
  animations: { id: string; name: string }[]
): { id: string; name: string; fileName: string }[] {
  const seen = new Map<string, number>();
  return animations.map((a) => {
    const base = sanitizeFileName(a.name);
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    const fileName = count === 1 ? `${base}.json` : `${base}_${count}.json`;
    return { id: a.id, name: a.name, fileName };
  });
}

/** Build manifest for export zip */
function buildManifest(
  collection: { name: string; description?: string },
  resolved: { id: string; name: string; fileName: string }[]
) {
  return {
    name: collection.name,
    description: collection.description || "",
    exportedAt: new Date().toISOString(),
    animationCount: resolved.length,
    animations: resolved.map((a) => ({
      id: a.id,
      name: a.name,
      fileName: a.fileName,
    })),
  };
}

/** Validate export request — returns error string or null */
function validateExportRequest(
  collection: Record<string, unknown> | undefined,
  animations: unknown[]
): { error: string; status: number } | null {
  if (!collection) return { error: "Not found", status: 404 };
  if (animations.length === 0) return { error: "Collection is empty", status: 400 };
  return null;
}

// --- Tests ---

describe("sanitizeFileName", () => {
  it("keeps alphanumeric, dash, underscore, space, and dot", () => {
    expect(sanitizeFileName("hello-world_1 v2.0")).toBe("hello-world_1 v2.0");
  });

  it("replaces special characters with underscore", () => {
    expect(sanitizeFileName("my/anim@tion#1")).toBe("my_anim_tion_1");
  });

  it("handles unicode characters", () => {
    expect(sanitizeFileName("动画测试")).toBe("____");
  });

  it("returns 'animation' for empty result after sanitization", () => {
    expect(sanitizeFileName("")).toBe("animation");
    expect(sanitizeFileName("   ")).toBe("animation");
  });

  it("trims whitespace", () => {
    expect(sanitizeFileName("  hello  ")).toBe("hello");
  });
});

describe("resolveFileNames", () => {
  it("gives unique names to animations with distinct names", () => {
    const result = resolveFileNames([
      { id: "1", name: "alpha" },
      { id: "2", name: "beta" },
      { id: "3", name: "gamma" },
    ]);
    expect(result.map((r) => r.fileName)).toEqual([
      "alpha.json",
      "beta.json",
      "gamma.json",
    ]);
  });

  it("appends index for duplicate names", () => {
    const result = resolveFileNames([
      { id: "1", name: "bounce" },
      { id: "2", name: "bounce" },
      { id: "3", name: "other" },
      { id: "4", name: "bounce" },
    ]);
    expect(result.map((r) => r.fileName)).toEqual([
      "bounce.json",
      "bounce_2.json",
      "other.json",
      "bounce_3.json",
    ]);
  });

  it("handles names that become identical after sanitization", () => {
    const result = resolveFileNames([
      { id: "1", name: "test/1" },
      { id: "2", name: "test@1" },
    ]);
    // Both sanitize to "test_1"
    expect(result.map((r) => r.fileName)).toEqual([
      "test_1.json",
      "test_1_2.json",
    ]);
  });

  it("preserves original name in output", () => {
    const result = resolveFileNames([{ id: "abc", name: "My Animation!" }]);
    expect(result[0].name).toBe("My Animation!");
    expect(result[0].fileName).toBe("My Animation_.json");
    expect(result[0].id).toBe("abc");
  });
});

describe("buildManifest", () => {
  it("includes correct structure and fields", () => {
    const collection = { name: "My Collection", description: "A test collection" };
    const resolved = [
      { id: "1", name: "anim1", fileName: "anim1.json" },
      { id: "2", name: "anim2", fileName: "anim2.json" },
    ];

    const manifest = buildManifest(collection, resolved);

    expect(manifest.name).toBe("My Collection");
    expect(manifest.description).toBe("A test collection");
    expect(manifest.animationCount).toBe(2);
    expect(manifest.animations).toHaveLength(2);
    expect(manifest.exportedAt).toBeTruthy();
    // Verify ISO date format
    expect(() => new Date(manifest.exportedAt)).not.toThrow();
    expect(new Date(manifest.exportedAt).toISOString()).toBe(manifest.exportedAt);
  });

  it("defaults description to empty string", () => {
    const manifest = buildManifest({ name: "No Desc" }, []);
    expect(manifest.description).toBe("");
  });

  it("animation list matches input", () => {
    const resolved = [
      { id: "a1", name: "First", fileName: "First.json" },
      { id: "a2", name: "Second", fileName: "Second.json" },
      { id: "a3", name: "Third", fileName: "Third.json" },
    ];

    const manifest = buildManifest({ name: "Test" }, resolved);

    expect(manifest.animations).toEqual([
      { id: "a1", name: "First", fileName: "First.json" },
      { id: "a2", name: "Second", fileName: "Second.json" },
      { id: "a3", name: "Third", fileName: "Third.json" },
    ]);
    expect(manifest.animationCount).toBe(3);
  });
});

describe("validateExportRequest", () => {
  it("returns null for valid collection with animations", () => {
    const collection = { id: "1", name: "Test" };
    const animations = [{ id: "a1", name: "anim" }];
    expect(validateExportRequest(collection, animations)).toBeNull();
  });

  it("returns 404 error for undefined collection", () => {
    const result = validateExportRequest(undefined, []);
    expect(result).toEqual({ error: "Not found", status: 404 });
  });

  it("returns 400 error for empty animations", () => {
    const collection = { id: "1", name: "Test" };
    const result = validateExportRequest(collection, []);
    expect(result).toEqual({ error: "Collection is empty", status: 400 });
  });
});
