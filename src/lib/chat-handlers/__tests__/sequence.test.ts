import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
  createSequence: vi.fn(),
  getSequence: vi.fn(),
  listSequences: vi.fn(),
  findSequencesByName: vi.fn(),
  deleteSequence: vi.fn(),
  addSequenceItem: vi.fn(),
  updateSequenceItem: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("@/lib/sequence", () => ({
  sequenceLayers: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import {
  db,
  createSequence,
  getSequence,
  listSequences,
  findSequencesByName,
  deleteSequence,
  addSequenceItem,
  updateSequenceItem,
} from "@/lib/db";
import { sequenceLayers } from "@/lib/sequence";
import fs from "node:fs";
import { handleSequence } from "../sequence";

beforeEach(() => {
  vi.clearAllMocks();
});

async function getReply(res: Response): Promise<string> {
  return res.text();
}

describe("handleSequence", () => {
  describe("sequence_create", () => {
    it("creates a new sequence", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (createSequence as ReturnType<typeof vi.fn>).mockReturnValue({ id: "seq1", name: "intro" });

      const res = handleSequence({ type: "sequence_create", name: "intro" }, undefined, "/sequence create intro");
      const text = await getReply(res);
      expect(text).toContain("Created sequence");
      expect(text).toContain("intro");
    });

    it("rejects duplicate name", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{ id: "seq1", name: "intro" }]);

      const res = handleSequence({ type: "sequence_create", name: "intro" }, undefined, "/sequence create intro");
      const text = await getReply(res);
      expect(text).toContain("already exists");
    });
  });

  describe("sequence_add", () => {
    it("returns error with no animation", async () => {
      const res = handleSequence({ type: "sequence_add", name: "intro" }, undefined, "/sequence add intro");
      const text = await getReply(res);
      expect(text).toContain("No current animation");
    });

    it("adds animation to sequence", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        get: () => ({ id: "anim1", name: "My Anim" }),
      });
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{ id: "seq1", name: "intro", items: [] }]);
      (addSequenceItem as ReturnType<typeof vi.fn>).mockReturnValue({ id: "item1" });
      (getSequence as ReturnType<typeof vi.fn>).mockReturnValue({ id: "seq1", name: "intro", items: [{ id: "item1" }] });

      const res = handleSequence({ type: "sequence_add", name: "intro" }, "anim1", "/sequence add intro");
      const text = await getReply(res);
      expect(text).toContain("Added");
      expect(text).toContain("My Anim");
      expect(addSequenceItem).toHaveBeenCalledWith("seq1", "anim1");
    });

    it("creates sequence if name not found", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
        get: () => ({ id: "anim1", name: "My Anim" }),
      });
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (createSequence as ReturnType<typeof vi.fn>).mockReturnValue({ id: "seq-new", name: "newseq" });
      (getSequence as ReturnType<typeof vi.fn>).mockReturnValue({ id: "seq-new", name: "newseq", items: [{ id: "i1" }] });
      (addSequenceItem as ReturnType<typeof vi.fn>).mockReturnValue({ id: "i1" });

      const res = handleSequence({ type: "sequence_add", name: "newseq" }, "anim1", "/sequence add newseq");
      const text = await getReply(res);
      expect(text).toContain("Added");
      expect(createSequence).toHaveBeenCalledWith("newseq", "", "default");
    });
  });

  describe("sequence_list", () => {
    it("shows empty message when no sequences", async () => {
      (listSequences as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const res = handleSequence({ type: "sequence_list" }, undefined, "/sequence list");
      const text = await getReply(res);
      expect(text).toContain("No sequences yet");
    });

    it("lists sequences", async () => {
      (listSequences as ReturnType<typeof vi.fn>).mockReturnValue([
        { id: "s1", name: "intro", item_count: 3 },
        { id: "s2", name: "outro", item_count: 1 },
      ]);
      const res = handleSequence({ type: "sequence_list" }, undefined, "/sequence list");
      const text = await getReply(res);
      expect(text).toContain("intro");
      expect(text).toContain("outro");
      expect(text).toContain("3 steps");
      expect(text).toContain("1 step");
    });
  });

  describe("sequence_show", () => {
    it("returns not found for unknown name", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const res = handleSequence({ type: "sequence_show", name: "nope" }, undefined, "/sequence show nope");
      const text = await getReply(res);
      expect(text).toContain("No sequence named");
    });

    it("shows steps", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{
        id: "s1", name: "intro", items: [
          { id: "i1", animation_name: "bounce", duration_seconds: 2.0, transition_type: "fade" },
        ],
      }]);
      const res = handleSequence({ type: "sequence_show", name: "intro" }, undefined, "/sequence show intro");
      const text = await getReply(res);
      expect(text).toContain("bounce");
      expect(text).toContain("2.0s");
      expect(text).toContain("fade");
    });
  });

  describe("sequence_delete", () => {
    it("deletes existing sequence", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{ id: "s1", name: "intro", items: [] }]);
      (deleteSequence as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const res = handleSequence({ type: "sequence_delete", name: "intro" }, undefined, "/sequence delete intro");
      const text = await getReply(res);
      expect(text).toContain("Deleted");
      expect(deleteSequence).toHaveBeenCalledWith("s1");
    });

    it("returns not found", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const res = handleSequence({ type: "sequence_delete", name: "nope" }, undefined, "/sequence delete nope");
      const text = await getReply(res);
      expect(text).toContain("No sequence named");
    });
  });

  describe("sequence_reorder", () => {
    it("reorders items", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{
        id: "s1", name: "intro", items: [
          { id: "i1", position: 0 },
          { id: "i2", position: 1 },
        ],
      }]);
      (updateSequenceItem as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const res = handleSequence({ type: "sequence_reorder", name: "intro", positions: "2,1" }, undefined, "/sequence reorder intro 2,1");
      const text = await getReply(res);
      expect(text).toContain("Reordered");
      expect(updateSequenceItem).toHaveBeenCalledWith("i2", { position: 0 });
      expect(updateSequenceItem).toHaveBeenCalledWith("i1", { position: 1 });
    });

    it("rejects invalid positions count", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{
        id: "s1", name: "intro", items: [{ id: "i1" }, { id: "i2" }],
      }]);

      const res = handleSequence({ type: "sequence_reorder", name: "intro", positions: "1" }, undefined, "/sequence reorder intro 1");
      const text = await getReply(res);
      expect(text).toContain("2 positions");
    });
  });

  describe("sequence_play", () => {
    it("composes all steps end-to-end", async () => {
      const anim1 = { v: "5.7.1", fr: 30, ip: 0, op: 30, w: 512, h: 512, layers: [{ nm: "a" }] };
      const anim2 = { v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512, layers: [{ nm: "b" }] };
      const composed = { v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512, layers: [{ nm: "a" }, { nm: "b" }] };

      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{
        id: "s1", name: "intro", items: [
          { id: "i1", animation_id: "a1", animation_name: "bounce" },
          { id: "i2", animation_id: "a2", animation_name: "slide" },
        ],
      }]);

      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(JSON.stringify(anim1))
        .mockReturnValueOnce(JSON.stringify(anim2));

      (sequenceLayers as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(anim1)
        .mockReturnValueOnce(composed);

      const res = handleSequence({ type: "sequence_play", name: "intro" }, undefined, "/sequence play intro");
      const text = await getReply(res);
      expect(text).toContain("Playing sequence");
      expect(text).toContain("2 steps");
      expect(sequenceLayers).toHaveBeenCalledTimes(2);
    });

    it("returns error if animation file missing", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{
        id: "s1", name: "intro", items: [
          { id: "i1", animation_id: "a1", animation_name: "bounce" },
        ],
      }]);
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const res = handleSequence({ type: "sequence_play", name: "intro" }, undefined, "/sequence play intro");
      const text = await getReply(res);
      expect(text).toContain("Cannot play");
      expect(text).toContain("bounce");
    });

    it("returns error for empty sequence", async () => {
      (findSequencesByName as ReturnType<typeof vi.fn>).mockReturnValue([{
        id: "s1", name: "intro", items: [],
      }]);

      const res = handleSequence({ type: "sequence_play", name: "intro" }, undefined, "/sequence play intro");
      const text = await getReply(res);
      expect(text).toContain("empty");
    });
  });
});
