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
});
