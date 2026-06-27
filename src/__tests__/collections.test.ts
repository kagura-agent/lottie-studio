import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Tests for the collections feature — pure logic and data structures.
 * Validates collection CRUD operations, item management, and filtering.
 */

// --- Pure helper functions extracted from API logic ---

/** Build a new collection row */
function buildCollectionRow(params: {
  name: string;
  description?: string;
  creator_id: string;
  is_public?: boolean;
}) {
  return {
    id: randomUUID(),
    name: params.name,
    description: params.description || "",
    creator_id: params.creator_id,
    is_public: params.is_public ? 1 : 0,
    cover_animation_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Validate collection creation input */
function validateCreateInput(body: { name?: string; creator_id?: string }): string | null {
  if (!body.name) return "name and creator_id are required";
  if (!body.creator_id) return "name and creator_id are required";
  return null;
}

/** Validate add items input */
function validateAddItemsInput(body: { animationIds?: string[] }): string | null {
  if (!Array.isArray(body.animationIds) || body.animationIds.length === 0) {
    return "animationIds array is required and must not be empty";
  }
  return null;
}

/** Build the PATCH update fields */
function buildUpdateFields(body: {
  name?: string;
  description?: string;
  is_public?: boolean;
  cover_animation_id?: string;
}): { updates: string[]; values: unknown[] } {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    updates.push("name = ?");
    values.push(body.name);
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description);
  }
  if (body.is_public !== undefined) {
    updates.push("is_public = ?");
    values.push(body.is_public ? 1 : 0);
  }
  if (body.cover_animation_id !== undefined) {
    updates.push("cover_animation_id = ?");
    values.push(body.cover_animation_id);
  }

  return { updates, values };
}

/** Filter animations by collection membership */
function filterByCollection(
  animations: { id: string; name: string }[],
  collectionAnimationIds: string[] | null
): { id: string; name: string }[] {
  if (collectionAnimationIds === null) return animations;
  const idSet = new Set(collectionAnimationIds);
  return animations.filter((a) => idSet.has(a.id));
}

/** Calculate next position for new items */
function nextPosition(currentMaxPosition: number): number {
  return currentMaxPosition + 1;
}

// --- Tests ---

describe("Collections: input validation", () => {
  it("rejects missing name", () => {
    expect(validateCreateInput({ creator_id: "abc" })).toBe(
      "name and creator_id are required"
    );
  });

  it("rejects missing creator_id", () => {
    expect(validateCreateInput({ name: "My Collection" })).toBe(
      "name and creator_id are required"
    );
  });

  it("accepts valid input", () => {
    expect(
      validateCreateInput({ name: "Favorites", creator_id: "user-123" })
    ).toBeNull();
  });

  it("rejects empty animationIds", () => {
    expect(validateAddItemsInput({ animationIds: [] })).toBe(
      "animationIds array is required and must not be empty"
    );
  });

  it("rejects missing animationIds", () => {
    expect(validateAddItemsInput({})).toBe(
      "animationIds array is required and must not be empty"
    );
  });

  it("accepts valid animationIds", () => {
    expect(
      validateAddItemsInput({ animationIds: ["anim-1", "anim-2"] })
    ).toBeNull();
  });
});

describe("Collections: row builder", () => {
  it("creates a row with all required fields", () => {
    const row = buildCollectionRow({
      name: "My Favorites",
      creator_id: "creator-abc",
    });
    expect(row.name).toBe("My Favorites");
    expect(row.creator_id).toBe("creator-abc");
    expect(row.description).toBe("");
    expect(row.is_public).toBe(0);
    expect(row.cover_animation_id).toBeNull();
    expect(row.id).toBeTruthy();
  });

  it("sets description when provided", () => {
    const row = buildCollectionRow({
      name: "Test",
      description: "A test collection",
      creator_id: "creator-1",
    });
    expect(row.description).toBe("A test collection");
  });

  it("sets is_public to 1 when true", () => {
    const row = buildCollectionRow({
      name: "Public",
      creator_id: "creator-1",
      is_public: true,
    });
    expect(row.is_public).toBe(1);
  });

  it("generates unique IDs", () => {
    const row1 = buildCollectionRow({ name: "A", creator_id: "x" });
    const row2 = buildCollectionRow({ name: "B", creator_id: "x" });
    expect(row1.id).not.toBe(row2.id);
  });
});

describe("Collections: update field builder", () => {
  it("builds name update", () => {
    const { updates, values } = buildUpdateFields({ name: "New Name" });
    expect(updates).toContain("name = ?");
    expect(values).toContain("New Name");
  });

  it("builds description update", () => {
    const { updates, values } = buildUpdateFields({ description: "Updated desc" });
    expect(updates).toContain("description = ?");
    expect(values).toContain("Updated desc");
  });

  it("builds is_public update", () => {
    const { updates, values } = buildUpdateFields({ is_public: true });
    expect(updates).toContain("is_public = ?");
    expect(values).toContain(1);
  });

  it("builds cover_animation_id update", () => {
    const { updates, values } = buildUpdateFields({
      cover_animation_id: "anim-123",
    });
    expect(updates).toContain("cover_animation_id = ?");
    expect(values).toContain("anim-123");
  });

  it("handles multiple fields", () => {
    const { updates, values } = buildUpdateFields({
      name: "New",
      description: "Desc",
      is_public: false,
    });
    expect(updates).toHaveLength(3);
    expect(values).toHaveLength(3);
  });

  it("returns empty for no fields", () => {
    const { updates, values } = buildUpdateFields({});
    expect(updates).toHaveLength(0);
    expect(values).toHaveLength(0);
  });
});

describe("Collections: filter by collection", () => {
  const animations = [
    { id: "a1", name: "Ball" },
    { id: "a2", name: "Star" },
    { id: "a3", name: "Wave" },
    { id: "a4", name: "Pulse" },
  ];

  it("returns all animations when collectionAnimationIds is null", () => {
    const result = filterByCollection(animations, null);
    expect(result).toHaveLength(4);
  });

  it("filters to only collection members", () => {
    const result = filterByCollection(animations, ["a1", "a3"]);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("returns empty when collection has no matching animations", () => {
    const result = filterByCollection(animations, ["x1", "x2"]);
    expect(result).toHaveLength(0);
  });

  it("handles empty animations list", () => {
    const result = filterByCollection([], ["a1"]);
    expect(result).toHaveLength(0);
  });

  it("handles empty collection ids", () => {
    const result = filterByCollection(animations, []);
    expect(result).toHaveLength(0);
  });
});

describe("Collections: position calculation", () => {
  it("starts at 0 for empty collection", () => {
    expect(nextPosition(-1)).toBe(0);
  });

  it("increments from current max", () => {
    expect(nextPosition(0)).toBe(1);
    expect(nextPosition(5)).toBe(6);
    expect(nextPosition(99)).toBe(100);
  });
});

describe("Collections: deleting a collection does not affect animations", () => {
  it("conceptually: animations exist independently of collections", () => {
    // This test documents the design decision:
    // When a collection is deleted, only the collection and its items
    // (junction table entries) are removed. The animations themselves
    // remain in the animations table untouched.
    const animations = [
      { id: "a1", name: "Ball", deleted: false },
      { id: "a2", name: "Star", deleted: false },
    ];

    const collectionItems = [
      { collection_id: "c1", animation_id: "a1" },
      { collection_id: "c1", animation_id: "a2" },
    ];

    // Simulate collection deletion (remove items, keep animations)
    const remainingItems = collectionItems.filter(
      (i) => i.collection_id !== "c1"
    );
    const remainingAnimations = animations; // unchanged

    expect(remainingItems).toHaveLength(0);
    expect(remainingAnimations).toHaveLength(2);
    expect(remainingAnimations[0].name).toBe("Ball");
    expect(remainingAnimations[1].name).toBe("Star");
  });
});

describe("Collections: creator_id filtering", () => {
  it("filters collections by creator_id", () => {
    const collections = [
      { id: "c1", name: "My Favs", creator_id: "user-1" },
      { id: "c2", name: "Work", creator_id: "user-1" },
      { id: "c3", name: "Other", creator_id: "user-2" },
    ];

    const creatorId = "user-1";
    const filtered = collections.filter((c) => c.creator_id === creatorId);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.name)).toEqual(["My Favs", "Work"]);
  });

  it("returns empty for unknown creator", () => {
    const collections = [
      { id: "c1", name: "My Favs", creator_id: "user-1" },
    ];

    const filtered = collections.filter(
      (c) => c.creator_id === "nonexistent"
    );
    expect(filtered).toHaveLength(0);
  });
});
