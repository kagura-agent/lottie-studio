import { describe, it, expect, afterEach } from "vitest";
import {
  db,
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
import type { SequenceItem } from "@/lib/db";

const createdPresetIds: string[] = [];
const createdSequenceIds: string[] = [];
const createdAnimationIds: string[] = [];

function seedAnimation(id: string) {
  db.exec(
    `INSERT OR IGNORE INTO animations (id, name) VALUES ('${id}', 'Test Anim ${id}')`
  );
  createdAnimationIds.push(id);
}

afterEach(() => {
  for (const id of createdPresetIds) {
    db.prepare("DELETE FROM presets WHERE id = ? AND is_builtin = 0").run(id);
  }
  createdPresetIds.length = 0;

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

describe("Preset functions", () => {
  it("getAllPresets returns array including built-in presets", () => {
    const presets = getAllPresets();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
    const builtins = presets.filter((p) => p.is_builtin === 1);
    expect(builtins.length).toBeGreaterThan(0);
  });

  it("getPresetByName returns preset when found", () => {
    const all = getAllPresets();
    const builtin = all.find((p) => p.is_builtin === 1)!;
    const found = getPresetByName(builtin.name);
    expect(found).toBeDefined();
    expect(found!.name).toBe(builtin.name);
  });

  it("getPresetByName returns undefined when not found", () => {
    expect(getPresetByName("nonexistent-preset-xyz")).toBeUndefined();
  });

  it("createPreset creates and returns preset with correct fields", () => {
    const preset = createPreset("test-preset", "A test", "Do something", "creator-1");
    createdPresetIds.push(preset.id);

    expect(preset.id).toBeDefined();
    expect(preset.name).toBe("test-preset");
    expect(preset.description).toBe("A test");
    expect(preset.instructions).toBe("Do something");
    expect(preset.is_builtin).toBe(0);
    expect(preset.creator_id).toBe("creator-1");
    expect(preset.created_at).toBeDefined();
  });

  it("createPreset with no creatorId sets creator_id to null", () => {
    const preset = createPreset("test-preset-no-creator", null, "instructions");
    createdPresetIds.push(preset.id);
    expect(preset.creator_id).toBeNull();
  });

  it("deletePreset deletes non-builtin preset", () => {
    const preset = createPreset("deletable", null, "x");
    createdPresetIds.push(preset.id);
    expect(deletePreset(preset.id)).toBe(true);
    expect(getPresetByName("deletable")).toBeUndefined();
  });

  it("deletePreset returns false for builtin preset", () => {
    const builtin = getAllPresets().find((p) => p.is_builtin === 1)!;
    expect(deletePreset(builtin.id)).toBe(false);
  });

  it("deletePreset returns false for missing id", () => {
    expect(deletePreset("nonexistent-id")).toBe(false);
  });

  it("deletePresetByName deletes non-builtin by name", () => {
    const preset = createPreset("del-by-name", null, "x");
    createdPresetIds.push(preset.id);
    expect(deletePresetByName("del-by-name")).toBe(true);
    expect(getPresetByName("del-by-name")).toBeUndefined();
  });

  it("deletePresetByName returns false for builtin", () => {
    const builtin = getAllPresets().find((p) => p.is_builtin === 1)!;
    expect(deletePresetByName(builtin.name)).toBe(false);
  });

  it("renamePreset succeeds for non-builtin", () => {
    const preset = createPreset("rename-src", null, "x");
    createdPresetIds.push(preset.id);
    expect(renamePreset("rename-src", "rename-dst")).toBe(true);
    expect(getPresetByName("rename-src")).toBeUndefined();
    expect(getPresetByName("rename-dst")).toBeDefined();
    // clean up renamed preset
    db.prepare("DELETE FROM presets WHERE id = ?").run(preset.id);
  });

  it("renamePreset returns false for builtin", () => {
    const builtin = getAllPresets().find((p) => p.is_builtin === 1)!;
    expect(renamePreset(builtin.name, "new-name")).toBe(false);
  });

  it("renamePreset returns false when target name already exists", () => {
    const p1 = createPreset("rename-a", null, "x");
    const p2 = createPreset("rename-b", null, "x");
    createdPresetIds.push(p1.id, p2.id);
    expect(renamePreset("rename-a", "rename-b")).toBe(false);
  });

  it("renamePreset returns false when source does not exist", () => {
    expect(renamePreset("no-such-preset", "anything")).toBe(false);
  });
});

describe("Sequence functions", () => {
  it("VALID_TRANSITIONS includes expected values", () => {
    expect(VALID_TRANSITIONS).toContain("cut");
    expect(VALID_TRANSITIONS).toContain("fade");
    expect(VALID_TRANSITIONS.length).toBeGreaterThanOrEqual(4);
  });

  it("createSequence creates with UUID and correct fields", () => {
    const seq = createSequence("My Seq", "desc", "user-1");
    createdSequenceIds.push(seq.id);

    expect(seq.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(seq.name).toBe("My Seq");
    expect(seq.description).toBe("desc");
    expect(seq.creator_id).toBe("user-1");
    expect(seq.created_at).toBeDefined();
    expect(seq.updated_at).toBeDefined();
  });

  it("getSequence returns SequenceWithItems including items array", () => {
    const seq = createSequence("get-test", "d", "user-1");
    createdSequenceIds.push(seq.id);

    const fetched = getSequence(seq.id);
    expect(fetched).toBeDefined();
    expect(fetched!.items).toEqual([]);
    expect(fetched!.name).toBe("get-test");
  });

  it("getSequence returns undefined for missing id", () => {
    expect(getSequence("nonexistent-seq")).toBeUndefined();
  });

  it("listSequences filters by creator and includes item_count", () => {
    const s1 = createSequence("list-a", "", "lister-1");
    const s2 = createSequence("list-b", "", "lister-1");
    const s3 = createSequence("list-c", "", "lister-2");
    createdSequenceIds.push(s1.id, s2.id, s3.id);

    const list = listSequences("lister-1");
    const ids = list.map((s) => s.id);
    expect(ids).toContain(s1.id);
    expect(ids).toContain(s2.id);
    expect(ids).not.toContain(s3.id);
    expect(list[0].item_count).toBe(0);
  });

  it("findSequencesByName is case-insensitive and returns items", () => {
    const seq = createSequence("FindMe", "d", "user-1");
    createdSequenceIds.push(seq.id);

    const results = findSequencesByName("findme");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const match = results.find((s) => s.id === seq.id);
    expect(match).toBeDefined();
    expect(match!.items).toBeDefined();
  });

  it("updateSequence performs partial updates", () => {
    const seq = createSequence("update-test", "old", "user-1");
    createdSequenceIds.push(seq.id);

    expect(updateSequence(seq.id, { name: "updated" })).toBe(true);
    const fetched = getSequence(seq.id)!;
    expect(fetched.name).toBe("updated");
    expect(fetched.description).toBe("old");
  });

  it("updateSequence returns false for empty fields", () => {
    const seq = createSequence("no-update", "", "user-1");
    createdSequenceIds.push(seq.id);
    expect(updateSequence(seq.id, {})).toBe(false);
  });

  it("updateSequence returns false for missing id", () => {
    expect(updateSequence("missing-id", { name: "x" })).toBe(false);
  });

  it("deleteSequence cascades to items and returns true", () => {
    const seq = createSequence("del-seq", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-del-1");
    addSequenceItem(seq.id, "anim-del-1");

    expect(deleteSequence(seq.id)).toBe(true);
    expect(getSequence(seq.id)).toBeUndefined();
    const items = db
      .prepare("SELECT * FROM sequence_items WHERE sequence_id = ?")
      .all(seq.id);
    expect(items).toHaveLength(0);
  });

  it("deleteSequence returns false for missing id", () => {
    expect(deleteSequence("nonexistent")).toBe(false);
  });

  it("addSequenceItem auto-positions when position omitted", () => {
    const seq = createSequence("auto-pos", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-ap-1");
    seedAnimation("anim-ap-2");

    const item1 = addSequenceItem(seq.id, "anim-ap-1");
    const item2 = addSequenceItem(seq.id, "anim-ap-2");

    expect(item1.position).toBe(0);
    expect(item2.position).toBe(1);
  });

  it("addSequenceItem uses defaults for transition and duration", () => {
    const seq = createSequence("defaults", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-df-1");

    const item = addSequenceItem(seq.id, "anim-df-1");
    expect(item.transition_type).toBe("cut");
    expect(item.transition_duration_ms).toBe(500);
  });

  it("addSequenceItem respects explicit values", () => {
    const seq = createSequence("explicit", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-ex-1");

    const item = addSequenceItem(seq.id, "anim-ex-1", 5, "fade", 1000);
    expect(item.position).toBe(5);
    expect(item.transition_type).toBe("fade");
    expect(item.transition_duration_ms).toBe(1000);
  });

  it("updateSequenceItem performs partial update", () => {
    const seq = createSequence("upd-item", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-ui-1");

    const item = addSequenceItem(seq.id, "anim-ui-1");
    expect(updateSequenceItem(item.id, { transitionType: "fade" })).toBe(true);

    const updated = db
      .prepare("SELECT * FROM sequence_items WHERE id = ?")
      .get(item.id) as SequenceItem;
    expect(updated.transition_type).toBe("fade");
    expect(updated.transition_duration_ms).toBe(500);
  });

  it("updateSequenceItem returns false for empty fields", () => {
    const seq = createSequence("upd-item-empty", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-uie-1");
    const item = addSequenceItem(seq.id, "anim-uie-1");
    expect(updateSequenceItem(item.id, {})).toBe(false);
  });

  it("removeSequenceItem removes and returns true", () => {
    const seq = createSequence("rm-item", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-rm-1");

    const item = addSequenceItem(seq.id, "anim-rm-1");
    expect(removeSequenceItem(item.id)).toBe(true);
    expect(removeSequenceItem(item.id)).toBe(false);
  });

  it("reorderSequenceItems updates positions correctly", () => {
    const seq = createSequence("reorder", "", "user-1");
    createdSequenceIds.push(seq.id);
    seedAnimation("anim-ro-1");
    seedAnimation("anim-ro-2");
    seedAnimation("anim-ro-3");

    const i1 = addSequenceItem(seq.id, "anim-ro-1");
    const i2 = addSequenceItem(seq.id, "anim-ro-2");
    const i3 = addSequenceItem(seq.id, "anim-ro-3");

    reorderSequenceItems(seq.id, [i3.id, i1.id, i2.id]);

    const fetched = getSequence(seq.id)!;
    expect(fetched.items[0].id).toBe(i3.id);
    expect(fetched.items[0].position).toBe(0);
    expect(fetched.items[1].id).toBe(i1.id);
    expect(fetched.items[1].position).toBe(1);
    expect(fetched.items[2].id).toBe(i2.id);
    expect(fetched.items[2].position).toBe(2);
  });
});
