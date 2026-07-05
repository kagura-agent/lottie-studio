import { describe, it, expect } from "vitest";
import {
  createSequence,
  getSequence,
  listSequences,
  updateSequence,
  deleteSequence,
  addSequenceItem,
  updateSequenceItem,
  removeSequenceItem,
  reorderSequenceItems,
  db,
} from "../db";
import { randomUUID } from "node:crypto";

function createTestAnimation(): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO animations (id, name, frame_count, duration_seconds) VALUES (?, ?, ?, ?)"
  ).run(id, `test-anim-${id.slice(0, 8)}`, 60, 2.0);
  return id;
}

describe("sequences DB: createSequence", () => {
  it("creates a sequence with all fields", () => {
    const seq = createSequence("My Storyboard", "A test sequence", "creator-1");
    expect(seq.id).toBeTruthy();
    expect(seq.name).toBe("My Storyboard");
    expect(seq.description).toBe("A test sequence");
    expect(seq.creator_id).toBe("creator-1");
    expect(seq.created_at).toBeTruthy();
    expect(seq.updated_at).toBeTruthy();

    deleteSequence(seq.id);
  });

  it("defaults description to empty string", () => {
    const seq = createSequence("No Desc", "", "creator-1");
    expect(seq.description).toBe("");
    deleteSequence(seq.id);
  });
});

describe("sequences DB: getSequence", () => {
  it("returns sequence with items joined to animations", () => {
    const seq = createSequence("Get Test", "", "creator-1");
    const animId = createTestAnimation();
    addSequenceItem(seq.id, animId, 0, "fade", 300);

    const result = getSequence(seq.id);
    expect(result).toBeDefined();
    expect(result!.name).toBe("Get Test");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].animation_id).toBe(animId);
    expect(result!.items[0].animation_name).toBeTruthy();
    expect(result!.items[0].transition_type).toBe("fade");
    expect(result!.items[0].transition_duration_ms).toBe(300);

    deleteSequence(seq.id);
  });

  it("returns undefined for non-existent id", () => {
    expect(getSequence("nonexistent")).toBeUndefined();
  });
});

describe("sequences DB: listSequences", () => {
  it("lists sequences by creator with item counts", () => {
    const creatorId = `creator-list-${Date.now()}`;
    const s1 = createSequence("Seq A", "", creatorId);
    const s2 = createSequence("Seq B", "", creatorId);
    const animId = createTestAnimation();
    addSequenceItem(s1.id, animId);

    const list = listSequences(creatorId);
    expect(list.length).toBe(2);

    const seqA = list.find((s) => s.name === "Seq A");
    const seqB = list.find((s) => s.name === "Seq B");
    expect(seqA!.item_count).toBe(1);
    expect(seqB!.item_count).toBe(0);

    deleteSequence(s1.id);
    deleteSequence(s2.id);
  });

  it("returns empty for unknown creator", () => {
    expect(listSequences("nonexistent-creator")).toEqual([]);
  });
});

describe("sequences DB: updateSequence", () => {
  it("updates name", () => {
    const seq = createSequence("Old Name", "", "creator-1");
    const result = updateSequence(seq.id, { name: "New Name" });
    expect(result).toBe(true);

    const updated = getSequence(seq.id);
    expect(updated!.name).toBe("New Name");

    deleteSequence(seq.id);
  });

  it("updates description", () => {
    const seq = createSequence("Test", "", "creator-1");
    updateSequence(seq.id, { description: "Updated desc" });

    const updated = getSequence(seq.id);
    expect(updated!.description).toBe("Updated desc");

    deleteSequence(seq.id);
  });

  it("returns false for empty fields", () => {
    const seq = createSequence("Test", "", "creator-1");
    expect(updateSequence(seq.id, {})).toBe(false);
    deleteSequence(seq.id);
  });

  it("returns false for non-existent id", () => {
    expect(updateSequence("nonexistent", { name: "X" })).toBe(false);
  });
});

describe("sequences DB: deleteSequence", () => {
  it("deletes a sequence and its items", () => {
    const seq = createSequence("To Delete", "", "creator-1");
    const animId = createTestAnimation();
    addSequenceItem(seq.id, animId);

    expect(deleteSequence(seq.id)).toBe(true);
    expect(getSequence(seq.id)).toBeUndefined();
  });

  it("returns false for non-existent id", () => {
    expect(deleteSequence("nonexistent")).toBe(false);
  });
});

describe("sequences DB: addSequenceItem", () => {
  it("adds an item with defaults", () => {
    const seq = createSequence("Item Test", "", "creator-1");
    const animId = createTestAnimation();
    const item = addSequenceItem(seq.id, animId);

    expect(item.id).toBeTruthy();
    expect(item.sequence_id).toBe(seq.id);
    expect(item.animation_id).toBe(animId);
    expect(item.position).toBe(0);
    expect(item.transition_type).toBe("cut");
    expect(item.transition_duration_ms).toBe(500);

    deleteSequence(seq.id);
  });

  it("auto-increments position", () => {
    const seq = createSequence("Position Test", "", "creator-1");
    const anim1 = createTestAnimation();
    const anim2 = createTestAnimation();

    const item1 = addSequenceItem(seq.id, anim1);
    const item2 = addSequenceItem(seq.id, anim2);

    expect(item1.position).toBe(0);
    expect(item2.position).toBe(1);

    deleteSequence(seq.id);
  });

  it("accepts explicit position and transition", () => {
    const seq = createSequence("Explicit Test", "", "creator-1");
    const animId = createTestAnimation();
    const item = addSequenceItem(seq.id, animId, 5, "slide-left", 750);

    expect(item.position).toBe(5);
    expect(item.transition_type).toBe("slide-left");
    expect(item.transition_duration_ms).toBe(750);

    deleteSequence(seq.id);
  });
});

describe("sequences DB: updateSequenceItem", () => {
  it("updates position", () => {
    const seq = createSequence("Update Item", "", "creator-1");
    const animId = createTestAnimation();
    const item = addSequenceItem(seq.id, animId);

    expect(updateSequenceItem(item.id, { position: 10 })).toBe(true);

    deleteSequence(seq.id);
  });

  it("updates transition fields", () => {
    const seq = createSequence("Transition Update", "", "creator-1");
    const animId = createTestAnimation();
    const item = addSequenceItem(seq.id, animId);

    expect(
      updateSequenceItem(item.id, {
        transitionType: "fade",
        transitionDurationMs: 1000,
      })
    ).toBe(true);

    deleteSequence(seq.id);
  });

  it("returns false for empty fields", () => {
    const seq = createSequence("Empty Update", "", "creator-1");
    const animId = createTestAnimation();
    const item = addSequenceItem(seq.id, animId);

    expect(updateSequenceItem(item.id, {})).toBe(false);

    deleteSequence(seq.id);
  });

  it("returns false for non-existent item", () => {
    expect(updateSequenceItem("nonexistent", { position: 0 })).toBe(false);
  });
});

describe("sequences DB: removeSequenceItem", () => {
  it("removes an item", () => {
    const seq = createSequence("Remove Item", "", "creator-1");
    const animId = createTestAnimation();
    const item = addSequenceItem(seq.id, animId);

    expect(removeSequenceItem(item.id)).toBe(true);

    const result = getSequence(seq.id);
    expect(result!.items).toHaveLength(0);

    deleteSequence(seq.id);
  });

  it("returns false for non-existent item", () => {
    expect(removeSequenceItem("nonexistent")).toBe(false);
  });
});

describe("sequences DB: reorderSequenceItems", () => {
  it("reorders items by position", () => {
    const seq = createSequence("Reorder Test", "", "creator-1");
    const anim1 = createTestAnimation();
    const anim2 = createTestAnimation();
    const anim3 = createTestAnimation();

    const item1 = addSequenceItem(seq.id, anim1);
    const item2 = addSequenceItem(seq.id, anim2);
    const item3 = addSequenceItem(seq.id, anim3);

    reorderSequenceItems(seq.id, [item3.id, item1.id, item2.id]);

    const result = getSequence(seq.id);
    expect(result!.items[0].id).toBe(item3.id);
    expect(result!.items[0].position).toBe(0);
    expect(result!.items[1].id).toBe(item1.id);
    expect(result!.items[1].position).toBe(1);
    expect(result!.items[2].id).toBe(item2.id);
    expect(result!.items[2].position).toBe(2);

    deleteSequence(seq.id);
  });
});
