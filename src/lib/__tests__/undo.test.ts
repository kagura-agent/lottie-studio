import { describe, it, expect } from "vitest";
import { detectUndoIntent } from "@/lib/undo-intent";

describe("detectUndoIntent", () => {
  describe("simple undo", () => {
    it.each([
      "undo", "revert", "go back", "undo that",
      "undo last change", "revert to previous", "undo last",
    ])("detects '%s' as undo", (msg) => {
      const result = detectUndoIntent(msg);
      expect(result).toEqual({ isUndo: true, isRedo: false });
    });

    it.each(["撤销", "回退", "撤回", "取消上一步", "回到之前"])(
      "detects Chinese undo '%s'", (msg) => {
        const result = detectUndoIntent(msg);
        expect(result).toEqual({ isUndo: true, isRedo: false });
      }
    );
  });

  describe("simple redo", () => {
    it.each(["redo", "redo that", "go forward", "bring it back", "重做", "恢复"])(
      "detects '%s' as redo", (msg) => {
        const result = detectUndoIntent(msg);
        expect(result).toEqual({ isUndo: false, isRedo: true });
      }
    );
  });

  describe("multi-step undo", () => {
    it.each([
      ["undo 3", 3],
      ["undo last 2 changes", 2],
      ["go back 5 steps", 5],
      ["revert 2", 2],
      ["撤销 3", 3],
    ])("detects '%s' as undo with %d steps", (msg, steps) => {
      const result = detectUndoIntent(msg);
      expect(result).toEqual({ isUndo: true, isRedo: false, steps });
    });
  });

  describe("multi-step redo", () => {
    it("detects 'redo 2' as redo with 2 steps", () => {
      const result = detectUndoIntent("redo 2");
      expect(result).toEqual({ isUndo: false, isRedo: true, steps: 2 });
    });
  });

  describe("named references", () => {
    it("detects 'go back to before the shadow'", () => {
      const result = detectUndoIntent("go back to before the shadow");
      expect(result).toEqual({ isUndo: true, isRedo: false, namedRef: "shadow" });
    });

    it("detects 'revert to before the bounce'", () => {
      const result = detectUndoIntent("revert to before the bounce");
      expect(result).toEqual({ isUndo: true, isRedo: false, namedRef: "bounce" });
    });

    it("detects 'undo to before the color change'", () => {
      const result = detectUndoIntent("undo to before the color change");
      expect(result).toEqual({ isUndo: true, isRedo: false, namedRef: "color change" });
    });
  });

  describe("non-undo messages", () => {
    it.each([
      "make the ball bounce",
      "add a shadow effect",
      "undo the rotation and make it faster",
      "",
      "   ",
    ])("returns null for '%s'", (msg) => {
      expect(detectUndoIntent(msg)).toBeNull();
    });
  });
});
