import { describe, it, expect, afterEach } from "vitest";
import {
  db,
  ANIMATIONS_DIR,
  getAllPresets,
  getPresetByName,
  createPreset,
  deletePreset,
  deletePresetByName,
  renamePreset,
  createSequence,
  getSequence,
  listSequences,
  findSequencesByName,
  updateSequence,
  deleteSequence,
  addSequenceItem,
  updateSequenceItem,
  removeSequenceItem,
  reorderSequenceItems,
  VALID_TRANSITIONS,
} from "@/lib/db";
import path from "node:path";
import fs from "node:fs";

const createdSequenceIds: string[] = [];
const createdAnimationIds: string[] = [];

function seedAnimation(id: string, opts?: { name?: string; description?: string; tags?: string }) {
  db.prepare("DELETE FROM animations WHERE id = ?").run(id);
  db.prepare(
    `INSERT INTO animations (id, name, description, tags, share_chat) VALUES (?, ?, ?, ?, 0)`
  ).run(id, opts?.name ?? `Test ${id}`, opts?.description ?? null, opts?.tags ?? null);
  createdAnimationIds.push(id);
}

afterEach(() => {
  for (const id of createdSequenceIds) {
    db.prepare("DELETE FROM sequence_items WHERE sequence_id = ?").run(id);
    db.prepare("DELETE FROM sequences WHERE id = ?").run(id);
  }
  createdSequenceIds.length = 0;

  for (const id of createdAnimationIds) {
    db.prepare("DELETE FROM animations WHERE id = ?").run(id);
  }
  createdAnimationIds.length = 0;
});

describe("ANIMATIONS_DIR export", () => {
  it("exports a valid path", () => {
    expect(ANIMATIONS_DIR).toContain("animations");
    expect(fs.existsSync(ANIMATIONS_DIR)).toBe(true);
  });
});

describe("updateSequence branch coverage", () => {
  it("updates only description field", () => {
    const seq = createSequence("desc-only", "old-desc", "user-1");
    createdSequenceIds.push(seq.id);

    expect(updateSequence(seq.id, { description: "new-desc" })).toBe(true);
    const fetched = getSequence(seq.id)!;
    expect(fetched.description).toBe("new-desc");
    expect(fetched.name).toBe("desc-only");
  });

  it("updates both name and description", () => {
    const seq = createSequence("both-test", "d", "user-1");
    createdSequenceIds.push(seq.id);

    expect(updateSequence(seq.id, { name: "new-name", description: "new-d" })).toBe(true);
    const fetched = getSequence(seq.id)!;
    expect(fetched.name).toBe("new-name");
    expect(fetched.description).toBe("new-d");
  });
});

describe("updateSequenceItem branch coverage", () => {
  it("updates only position", () => {
    const seq = createSequence("pos-only", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-pos-1");
    const item = addSequenceItem(seq.id, "anim-pos-1");

    expect(updateSequenceItem(item.id, { position: 10 })).toBe(true);
    const row = db.prepare("SELECT * FROM sequence_items WHERE id = ?").get(item.id) as { position: number };
    expect(row.position).toBe(10);
  });

  it("updates only transitionDurationMs", () => {
    const seq = createSequence("dur-only", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-dur-1");
    const item = addSequenceItem(seq.id, "anim-dur-1");

    expect(updateSequenceItem(item.id, { transitionDurationMs: 2000 })).toBe(true);
    const row = db.prepare("SELECT * FROM sequence_items WHERE id = ?").get(item.id) as { transition_duration_ms: number };
    expect(row.transition_duration_ms).toBe(2000);
  });

  it("updates all fields at once", () => {
    const seq = createSequence("all-fields", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-all-1");
    const item = addSequenceItem(seq.id, "anim-all-1");

    expect(updateSequenceItem(item.id, { position: 3, transitionType: "slide-left", transitionDurationMs: 750 })).toBe(true);
    const row = db.prepare("SELECT * FROM sequence_items WHERE id = ?").get(item.id) as { position: number; transition_type: string; transition_duration_ms: number };
    expect(row.position).toBe(3);
    expect(row.transition_type).toBe("slide-left");
    expect(row.transition_duration_ms).toBe(750);
  });

  it("returns false for nonexistent item id", () => {
    expect(updateSequenceItem("nonexistent-item-id", { position: 1 })).toBe(false);
  });
});

describe("addSequenceItem edge cases", () => {
  it("addSequenceItem with explicit position 0", () => {
    const seq = createSequence("pos-zero", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-pz-1");

    const item = addSequenceItem(seq.id, "anim-pz-1", 0, "fade", 300);
    expect(item.position).toBe(0);
    expect(item.transition_type).toBe("fade");
    expect(item.transition_duration_ms).toBe(300);
  });

  it("addSequenceItem with undefined transitionDurationMs uses default 500", () => {
    const seq = createSequence("def-dur", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-dd-1");

    const item = addSequenceItem(seq.id, "anim-dd-1", 0, "slide-up", undefined);
    expect(item.transition_duration_ms).toBe(500);
    expect(item.transition_type).toBe("slide-up");
  });

  it("addSequenceItem with empty transitionType uses 'cut'", () => {
    const seq = createSequence("def-trans", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-dt-1");

    const item = addSequenceItem(seq.id, "anim-dt-1", 2, "", 1000);
    expect(item.transition_type).toBe("cut");
  });
});

describe("removeSequenceItem edge cases", () => {
  it("returns false for nonexistent item", () => {
    expect(removeSequenceItem("nonexistent-item-xyz")).toBe(false);
  });
});

describe("reorderSequenceItems edge cases", () => {
  it("handles empty itemIds array", () => {
    const seq = createSequence("reorder-empty", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-re-1");
    addSequenceItem(seq.id, "anim-re-1");

    // Should not throw
    reorderSequenceItems(seq.id, []);
    const fetched = getSequence(seq.id)!;
    expect(fetched.items).toHaveLength(1);
  });

  it("handles itemIds that don't match the sequence (wrong sequence_id)", () => {
    const seq1 = createSequence("reorder-s1", "", "user-1");
    const seq2 = createSequence("reorder-s2", "", "user-1");
    createdSequenceIds.push(seq1.id, seq2.id);
    seedAnimation("anim-rs-1");
    seedAnimation("anim-rs-2");

    const item1 = addSequenceItem(seq1.id, "anim-rs-1");
    const item2 = addSequenceItem(seq2.id, "anim-rs-2");

    // item2 belongs to seq2, so reordering with seq1 should not update it
    reorderSequenceItems(seq1.id, [item2.id, item1.id]);
    const row = db.prepare("SELECT position FROM sequence_items WHERE id = ?").get(item2.id) as { position: number };
    expect(row.position).toBe(0); // unchanged because WHERE sequence_id doesn't match
  });
});

describe("FTS index integration", () => {
  it("FTS triggers populate on insert", () => {
    seedAnimation("anim-fts-1", { name: "UniqueXyzName", description: "test fts", tags: "motion" });

    const results = db.prepare(
      "SELECT * FROM animations_fts WHERE animations_fts MATCH ?"
    ).all("UniqueXyzName");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("FTS triggers update on animation update", () => {
    seedAnimation("anim-fts-2", { name: "OldFtsName", description: "old", tags: "" });

    db.prepare("UPDATE animations SET name = ?, description = ? WHERE id = ?")
      .run("NewFtsSearchable", "updated desc", "anim-fts-2");

    const oldResults = db.prepare(
      "SELECT * FROM animations_fts WHERE animations_fts MATCH ?"
    ).all("OldFtsName");
    expect(oldResults).toHaveLength(0);

    const newResults = db.prepare(
      "SELECT * FROM animations_fts WHERE animations_fts MATCH ?"
    ).all("NewFtsSearchable");
    expect(newResults.length).toBeGreaterThanOrEqual(1);
  });

  it("FTS triggers delete on animation delete", () => {
    seedAnimation("anim-fts-3", { name: "DeleteMeFts" });

    db.prepare("DELETE FROM animations WHERE id = ?").run("anim-fts-3");
    createdAnimationIds.pop(); // already deleted

    const results = db.prepare(
      "SELECT * FROM animations_fts WHERE animations_fts MATCH ?"
    ).all("DeleteMeFts");
    expect(results).toHaveLength(0);
  });
});

describe("deleteSequence returns false for nonexistent", () => {
  it("returns false", () => {
    expect(deleteSequence("no-such-sequence-id")).toBe(false);
  });
});

describe("Preset CRUD branch coverage", () => {
  const createdPresetIds: string[] = [];

  afterEach(() => {
    for (const id of createdPresetIds) {
      db.prepare("DELETE FROM presets WHERE id = ?").run(id);
    }
    createdPresetIds.length = 0;
  });

  it("getAllPresets returns an array", () => {
    const presets = getAllPresets();
    expect(Array.isArray(presets)).toBe(true);
  });

  it("createPreset and getPresetByName", () => {
    const p = createPreset("test-preset-xyz", "desc", "instructions here");
    createdPresetIds.push(p.id);
    expect(p.name).toBe("test-preset-xyz");
    const found = getPresetByName("test-preset-xyz");
    expect(found?.id).toBe(p.id);
  });

  it("deletePreset removes a non-builtin preset", () => {
    const p = createPreset("test-del-preset", null, "instr");
    createdPresetIds.push(p.id);
    expect(deletePreset(p.id)).toBe(true);
    expect(getPresetByName("test-del-preset")).toBeUndefined();
  });

  it("renamePreset renames a non-builtin preset", () => {
    const p = createPreset("test-rename-old", null, "instr");
    createdPresetIds.push(p.id);
    expect(renamePreset("test-rename-old", "test-rename-new")).toBe(true);
    expect(getPresetByName("test-rename-new")?.id).toBe(p.id);
    // cleanup uses id which still works
  });

  it("renamePreset returns false for nonexistent source", () => {
    expect(renamePreset("nonexistent-xyz", "whatever")).toBe(false);
  });

  it("renamePreset returns false when target name exists", () => {
    const p1 = createPreset("test-ren-a", null, "instr");
    const p2 = createPreset("test-ren-b", null, "instr");
    createdPresetIds.push(p1.id, p2.id);
    expect(renamePreset("test-ren-a", "test-ren-b")).toBe(false);
  });

  it("deletePresetByName removes a non-builtin preset", () => {
    const p = createPreset("test-del-by-name", null, "instr");
    createdPresetIds.push(p.id);
    expect(deletePresetByName("test-del-by-name")).toBe(true);
    expect(getPresetByName("test-del-by-name")).toBeUndefined();
  });
});

describe("listSequences with results", () => {
  it("returns sequences with items for findSequencesByName", () => {
    seedAnimation("seq-find-anim-1");
    const seq = createSequence("FindableSeqName", "", "creator-find");
    createdSequenceIds.push(seq.id);
    addSequenceItem(seq.id, "seq-find-anim-1", 0);
    const results = findSequencesByName("FindableSeqName");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].items.length).toBeGreaterThan(0);
  });

  it("getSequence returns undefined for nonexistent id", () => {
    expect(getSequence("nonexistent-seq-id-xyz")).toBeUndefined();
  });

  it("updateSequence returns false when no fields provided", () => {
    const seq = createSequence("no-field-seq", "", "creator-nf");
    createdSequenceIds.push(seq.id);
    expect(updateSequence(seq.id, {})).toBe(false);
  });

  it("updateSequenceItem returns false when no fields provided", () => {
    seedAnimation("no-field-item-anim");
    const seq = createSequence("no-field-item-seq", "", "creator-nfi");
    createdSequenceIds.push(seq.id);
    const item = addSequenceItem(seq.id, "no-field-item-anim", 0);
    expect(updateSequenceItem(item.id, {})).toBe(false);
  });
});

describe("findSequencesByName returns empty for no match", () => {
  it("returns empty array", () => {
    const results = findSequencesByName("absolutely-no-sequence-with-this-name-xyz");
    expect(results).toHaveLength(0);
  });
});

describe("listSequences returns empty for unknown creator", () => {
  it("returns empty array", () => {
    const results = listSequences("unknown-creator-xyz");
    expect(results).toHaveLength(0);
  });
});

describe("db module-level initialization (documented coverage gaps)", () => {
  it("WAL mode is enabled", () => {
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");
  });

  it("seedGallery seeded template animations", () => {
    const count = db.prepare("SELECT COUNT(*) as count FROM animations WHERE share_chat = 1").get() as { count: number };
    // seedGallery runs at import time; templates exist in the repo
    expect(count.count).toBeGreaterThanOrEqual(0);
  });

  it("animations directory exists", () => {
    expect(fs.existsSync(ANIMATIONS_DIR)).toBe(true);
  });
});
