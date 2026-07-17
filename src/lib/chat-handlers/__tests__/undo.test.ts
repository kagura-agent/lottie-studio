import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { animationEvents } from "@/lib/events";
import fs from "node:fs";
import { handleUndo } from "../undo";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleUndo", () => {
  it("returns message when at version 1", async () => {
    const run = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ max_num: 1 }), run });
    const res = handleUndo("anim1", "undo");
    const text = await res.text();
    expect(text).toContain("Nothing to undo");
    expect(text).toContain("first version");
  });

  it("returns message when at version 0", async () => {
    const run = vi.fn();
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ max_num: null }), run });
    const res = handleUndo("anim1", "undo");
    const text = await res.text();
    expect(text).toContain("Nothing to undo");
  });

  it("returns message when previous version not found", async () => {
    let callCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { get: () => ({ max_num: 3 }) };
      if (callCount === 2) return { get: () => undefined };
      return { run: vi.fn() };
    });
    const res = handleUndo("anim1", "undo");
    const text = await res.text();
    expect(text).toContain("previous version not found");
  });

  it("reverts to previous version successfully", async () => {
    const lottieJson = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [] });
    let callCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { get: () => ({ max_num: 3 }) };
      if (callCount === 2) return { get: () => ({ lottie_json: lottieJson }) };
      return { run: vi.fn(), get: () => ({ max_num: 3 }) };
    });

    const res = handleUndo("anim1", "undo");
    const text = await res.text();
    expect(text).toContain("Reverted");
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
  });

  describe("redo path", () => {
    it("redo succeeds when last action was an undo", async () => {
      const lottieJson = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [] });
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        // 1: getCurrentVersionNum
        if (callCount === 1) return { get: () => ({ max_num: 4 }) };
        // 2: get targetVersion (version_num - 1 = 3)
        if (callCount === 2) return { get: () => ({ version_num: 3, lottie_json: lottieJson, trigger_message: "add bounce" }) };
        // 3: get currentVersion trigger_message
        if (callCount === 3) return { get: () => ({ trigger_message: "undo" }) };
        // remaining: restoreVersion calls (writeFile, updateAnimationMetadata, saveVersion, saveMessages, emitUpdated)
        return { run: vi.fn(), get: () => ({ max_num: 4 }) };
      });

      const res = handleUndo("anim1", "redo");
      const text = await res.text();
      expect(text).toContain("Redone");
      expect(text).toContain("v3");
      expect(fs.writeFileSync).toHaveBeenCalledWith("/tmp/test-animations/anim1.json", lottieJson);
      expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
    });

    it("redo fails with 'Nothing to redo' when currentVersionNum < 2", async () => {
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        return { get: () => ({ max_num: 1 }), run: vi.fn() };
      });

      const res = handleUndo("anim1", "redo");
      const text = await res.text();
      expect(text).toContain("Nothing to redo");
    });

    it("redo fails with 'no forward version found' when targetVersion is undefined", async () => {
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { get: () => ({ max_num: 5 }) };
        // targetVersion query returns undefined
        if (callCount === 2) return { get: () => undefined };
        return { run: vi.fn() };
      });

      const res = handleUndo("anim1", "redo");
      const text = await res.text();
      expect(text).toContain("no forward version found");
    });

    it("redo fails with 'last change wasn't an undo' when trigger doesn't contain undo keywords", async () => {
      const lottieJson = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [] });
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { get: () => ({ max_num: 4 }) };
        if (callCount === 2) return { get: () => ({ version_num: 3, lottie_json: lottieJson, trigger_message: "add shadow" }) };
        // currentVersion trigger_message is NOT an undo
        if (callCount === 3) return { get: () => ({ trigger_message: "make it bigger" }) };
        return { run: vi.fn() };
      });

      const res = handleUndo("anim1", "redo");
      const text = await res.text();
      expect(text).toContain("last change wasn't an undo");
    });
  });

  describe("named reference undo", () => {
    it("finds version by named ref and reverts to version before it", async () => {
      const lottieV1 = JSON.stringify({ v: "5", op: 30, fr: 30, layers: [] });
      const lottieV2 = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [{ ty: 1 }] });
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        // 1: getCurrentVersionNum
        if (callCount === 1) return { get: () => ({ max_num: 3 }) };
        // 2: findVersionByNamedRef - all versions
        if (callCount === 2) return {
          all: () => [
            { version_num: 1, lottie_json: lottieV1, trigger_message: "initial" },
            { version_num: 2, lottie_json: lottieV2, trigger_message: "add bounce effect" },
            { version_num: 3, lottie_json: lottieV2, trigger_message: "change color" },
          ]
        };
        // remaining: restoreVersion calls
        return { run: vi.fn(), get: () => ({ max_num: 3 }) };
      });

      const res = handleUndo("anim1", "revert to before the bounce");
      const text = await res.text();
      expect(text).toContain("Reverted");
      expect(text).toContain("v1");
      expect(text).toContain("bounce");
      expect(fs.writeFileSync).toHaveBeenCalledWith("/tmp/test-animations/anim1.json", lottieV1);
    });

    it("returns error when named ref not found", async () => {
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { get: () => ({ max_num: 3 }) };
        // findVersionByNamedRef - no match
        if (callCount === 2) return {
          all: () => [
            { version_num: 1, lottie_json: "{}", trigger_message: "initial" },
            { version_num: 2, lottie_json: "{}", trigger_message: "add shadow" },
          ]
        };
        return { run: vi.fn() };
      });

      const res = handleUndo("anim1", "revert to before the sparkles");
      const text = await res.text();
      expect(text).toContain("Couldn't find a version related to");
      expect(text).toContain("sparkles");
    });
  });

  describe("multi-step undo", () => {
    it("undo 3 steps with enough versions reverts correctly", async () => {
      const targetJson = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [] });
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        // 1: getCurrentVersionNum -> 5
        if (callCount === 1) return { get: () => ({ max_num: 5 }) };
        // 2: get target version (5-3=2)
        if (callCount === 2) return { get: () => ({ version_num: 2, lottie_json: targetJson, trigger_message: "add glow" }) };
        // remaining: restoreVersion calls
        return { run: vi.fn(), get: () => ({ max_num: 5 }) };
      });

      const res = handleUndo("anim1", "undo 3 steps");
      const text = await res.text();
      expect(text).toContain("Reverted");
      expect(text).toContain("3 steps");
      expect(text).toContain("v2");
      expect(fs.writeFileSync).toHaveBeenCalledWith("/tmp/test-animations/anim1.json", targetJson);
    });

    it("undo 5 steps exceeding available versions returns error", async () => {
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { get: () => ({ max_num: 3 }) };
        return { run: vi.fn() };
      });

      const res = handleUndo("anim1", "undo 5 steps");
      const text = await res.text();
      expect(text).toContain("Cannot undo 5 steps");
      expect(text).toContain("only 2 previous version(s) available");
    });
  });

  describe("restoreVersion integration", () => {
    it("calls fs.writeFileSync with correct path and JSON", async () => {
      const lottieJson = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [] });
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { get: () => ({ max_num: 3 }) };
        if (callCount === 2) return { get: () => ({ version_num: 2, lottie_json: lottieJson, trigger_message: "test" }) };
        return { run: vi.fn(), get: () => ({ max_num: 3 }) };
      });

      handleUndo("anim1", "undo");
      expect(fs.writeFileSync).toHaveBeenCalledWith("/tmp/test-animations/anim1.json", lottieJson);
    });

    it("calls animationEvents.emit with 'updated'", async () => {
      const lottieJson = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [] });
      let callCount = 0;
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { get: () => ({ max_num: 3 }) };
        if (callCount === 2) return { get: () => ({ version_num: 2, lottie_json: lottieJson, trigger_message: "test" }) };
        return { run: vi.fn(), get: () => ({ max_num: 3 }) };
      });

      handleUndo("anim1", "undo");
      expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
    });

    it("calls db.prepare for INSERT messages (user + assistant)", async () => {
      const lottieJson = JSON.stringify({ v: "5", op: 60, fr: 30, layers: [] });
      let callCount = 0;
      const sqlStatements: string[] = [];
      (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
        callCount++;
        sqlStatements.push(sql);
        if (callCount === 1) return { get: () => ({ max_num: 3 }) };
        if (callCount === 2) return { get: () => ({ version_num: 2, lottie_json: lottieJson, trigger_message: "test" }) };
        return { run: vi.fn(), get: () => ({ max_num: 3 }) };
      });

      handleUndo("anim1", "undo");
      const insertMessages = sqlStatements.filter(s => s.includes("INSERT INTO messages"));
      expect(insertMessages.length).toBe(2);
      expect(insertMessages[0]).toContain("'user'");
      expect(insertMessages[1]).toContain("'assistant'");
    });
  });
});
