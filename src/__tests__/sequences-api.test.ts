import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

function validateSequenceCreateInput(body: { name?: string; creator_id?: string }): string | null {
  if (!body.name || !body.creator_id) return "name and creator_id are required";
  return null;
}

function validateAddItemInput(body: { animation_id?: string }): string | null {
  if (!body.animation_id) return "animation_id is required";
  return null;
}

const VALID_TRANSITIONS = ["cut", "fade", "slide-left", "slide-right", "slide-up", "slide-down"];

function validateTransitionType(type: string): boolean {
  return VALID_TRANSITIONS.includes(type);
}

function buildSequenceRow(params: {
  name: string;
  description?: string;
  creator_id: string;
}) {
  return {
    id: randomUUID(),
    name: params.name,
    description: params.description || "",
    creator_id: params.creator_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildSequenceUpdateFields(body: {
  name?: string;
  description?: string;
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

  return { updates, values };
}

function nextItemPosition(currentMax: number): number {
  return currentMax + 1;
}

describe("Sequences API: input validation", () => {
  it("rejects missing name", () => {
    expect(validateSequenceCreateInput({ creator_id: "abc" })).toBe(
      "name and creator_id are required"
    );
  });

  it("rejects missing creator_id", () => {
    expect(validateSequenceCreateInput({ name: "My Sequence" })).toBe(
      "name and creator_id are required"
    );
  });

  it("accepts valid input", () => {
    expect(
      validateSequenceCreateInput({ name: "Storyboard", creator_id: "user-123" })
    ).toBeNull();
  });

  it("rejects missing animation_id for add item", () => {
    expect(validateAddItemInput({})).toBe("animation_id is required");
  });

  it("accepts valid animation_id", () => {
    expect(validateAddItemInput({ animation_id: "anim-1" })).toBeNull();
  });
});

describe("Sequences API: transition validation", () => {
  it("accepts valid transition types", () => {
    expect(validateTransitionType("cut")).toBe(true);
    expect(validateTransitionType("fade")).toBe(true);
    expect(validateTransitionType("slide-left")).toBe(true);
    expect(validateTransitionType("slide-right")).toBe(true);
    expect(validateTransitionType("slide-up")).toBe(true);
    expect(validateTransitionType("slide-down")).toBe(true);
  });

  it("rejects invalid transition types", () => {
    expect(validateTransitionType("wipe")).toBe(false);
    expect(validateTransitionType("dissolve")).toBe(false);
    expect(validateTransitionType("")).toBe(false);
  });
});

describe("Sequences API: row builder", () => {
  it("creates a row with required fields", () => {
    const row = buildSequenceRow({ name: "My Storyboard", creator_id: "creator-1" });
    expect(row.name).toBe("My Storyboard");
    expect(row.creator_id).toBe("creator-1");
    expect(row.description).toBe("");
    expect(row.id).toBeTruthy();
  });

  it("sets description when provided", () => {
    const row = buildSequenceRow({
      name: "Test",
      description: "A test sequence",
      creator_id: "creator-1",
    });
    expect(row.description).toBe("A test sequence");
  });

  it("generates unique IDs", () => {
    const row1 = buildSequenceRow({ name: "A", creator_id: "x" });
    const row2 = buildSequenceRow({ name: "B", creator_id: "x" });
    expect(row1.id).not.toBe(row2.id);
  });
});

describe("Sequences API: update field builder", () => {
  it("builds name update", () => {
    const { updates, values } = buildSequenceUpdateFields({ name: "New Name" });
    expect(updates).toContain("name = ?");
    expect(values).toContain("New Name");
  });

  it("builds description update", () => {
    const { updates, values } = buildSequenceUpdateFields({ description: "Updated" });
    expect(updates).toContain("description = ?");
    expect(values).toContain("Updated");
  });

  it("handles multiple fields", () => {
    const { updates, values } = buildSequenceUpdateFields({
      name: "New",
      description: "Desc",
    });
    expect(updates).toHaveLength(2);
    expect(values).toHaveLength(2);
  });

  it("returns empty for no fields", () => {
    const { updates, values } = buildSequenceUpdateFields({});
    expect(updates).toHaveLength(0);
    expect(values).toHaveLength(0);
  });
});

describe("Sequences API: position calculation", () => {
  it("starts at 0 for empty sequence", () => {
    expect(nextItemPosition(-1)).toBe(0);
  });

  it("increments from current max", () => {
    expect(nextItemPosition(0)).toBe(1);
    expect(nextItemPosition(5)).toBe(6);
  });
});

describe("Sequences API: creator_id filtering", () => {
  it("filters sequences by creator_id", () => {
    const sequences = [
      { id: "s1", name: "Intro", creator_id: "user-1" },
      { id: "s2", name: "Outro", creator_id: "user-1" },
      { id: "s3", name: "Other", creator_id: "user-2" },
    ];

    const filtered = sequences.filter((s) => s.creator_id === "user-1");
    expect(filtered).toHaveLength(2);
    expect(filtered.map((s) => s.name)).toEqual(["Intro", "Outro"]);
  });

  it("returns empty for unknown creator", () => {
    const sequences = [
      { id: "s1", name: "Intro", creator_id: "user-1" },
    ];
    const filtered = sequences.filter((s) => s.creator_id === "nonexistent");
    expect(filtered).toHaveLength(0);
  });
});
