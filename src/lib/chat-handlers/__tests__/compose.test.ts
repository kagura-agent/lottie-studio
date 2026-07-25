import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn() },
  ANIMATIONS_DIR: "/tmp/test-animations",
}));

vi.mock("@/lib/events", () => ({
  animationEvents: { emit: vi.fn() },
}));

vi.mock("@/lib/compose", () => ({
  composeLayers: vi.fn(),
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
import { composeLayers } from "@/lib/compose";
import fs from "node:fs";
import { handleCompose } from "../compose";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleCompose", () => {
  it("returns error when source animation not found in DB", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => undefined });
    const res = handleCompose("anim1", "source1", "compose source1");
    const text = await res.text();
    expect(text).toContain("not found");
  });

  it("returns error when source file does not exist", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "source1", name: "My Source" }) });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const res = handleCompose("anim1", "source1", "compose");
    const text = await res.text();
    expect(text).toContain("no saved JSON file");
  });

  it("returns error when source JSON is invalid", async () => {
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: () => ({ id: "source1", name: "My Source" }) });
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("not json");
    const res = handleCompose("anim1", "source1", "compose");
    const text = await res.text();
    expect(text).toContain("Failed to parse");
  });

  it("uses default target JSON when animation file does not exist", async () => {
    const sourceJson = { v: "5", layers: [{ nm: "a" }] };
    const mergedJson = { v: "5", layers: [{ nm: "a" }], op: 60, fr: 30 };

    let prepareCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
      prepareCount++;
      if (prepareCount === 1) return { get: () => ({ id: "source1", name: "My Source" }) };
      return { run: vi.fn(), get: () => ({ max_num: 1 }) };
    });

    (fs.existsSync as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(true)   // source file exists
      .mockReturnValueOnce(false); // target file does NOT exist
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(sourceJson));
    (composeLayers as ReturnType<typeof vi.fn>).mockReturnValue(mergedJson);

    const res = handleCompose("anim1", "source1", "compose source1");
    const text = await res.text();
    expect(text).toContain("Composed");
    expect(composeLayers).toHaveBeenCalledWith(
      expect.objectContaining({ v: "5.7.1", layers: [], assets: [] }),
      sourceJson,
    );
  });

  it("uses default target JSON when target file has invalid JSON", async () => {
    const sourceJson = { v: "5", layers: [{ nm: "a" }] };
    const mergedJson = { v: "5", layers: [{ nm: "a" }] };

    let prepareCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
      prepareCount++;
      if (prepareCount === 1) return { get: () => ({ id: "source1", name: "My Source" }) };
      return { run: vi.fn(), get: () => ({ max_num: 1 }) };
    });

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(JSON.stringify(sourceJson))
      .mockReturnValueOnce("not valid json");
    (composeLayers as ReturnType<typeof vi.fn>).mockReturnValue(mergedJson);

    const res = handleCompose("anim1", "source1", "compose source1");
    const text = await res.text();
    expect(text).toContain("Composed");
  });

  it("uses singular 'layer' when source has exactly 1 layer", async () => {
    const sourceJson = { v: "5", layers: [{ nm: "only" }] };
    const mergedJson = { v: "5", layers: [{ nm: "only" }] };

    let prepareCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
      prepareCount++;
      if (prepareCount === 1) return { get: () => ({ id: "s1", name: "Src" }) };
      return { run: vi.fn(), get: () => ({ max_num: 1 }) };
    });

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(sourceJson));
    (composeLayers as ReturnType<typeof vi.fn>).mockReturnValue(mergedJson);

    const res = handleCompose("anim1", "s1", "compose s1");
    const text = await res.text();
    expect(text).toContain("1 layer ");
    expect(text).not.toContain("1 layers");
  });

  it("uses plural 'layers' when source has 0 layers", async () => {
    const sourceJson = { v: "5" };
    const mergedJson = { v: "5", layers: [] };

    let prepareCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
      prepareCount++;
      if (prepareCount === 1) return { get: () => ({ id: "s1", name: "Src" }) };
      return { run: vi.fn(), get: () => ({ max_num: 1 }) };
    });

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(sourceJson));
    (composeLayers as ReturnType<typeof vi.fn>).mockReturnValue(mergedJson);

    const res = handleCompose("anim1", "s1", "compose s1");
    const text = await res.text();
    expect(text).toContain("0 layers");
  });

  it("composes layers successfully", async () => {
    const sourceJson = { v: "5", layers: [{ nm: "layer1" }] };
    const targetJson = { v: "5", layers: [], op: 60, fr: 30 };
    const mergedJson = { v: "5", layers: [{ nm: "layer1" }], op: 60, fr: 30 };

    let prepareCount = 0;
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
      prepareCount++;
      if (prepareCount === 1) return { get: () => ({ id: "source1", name: "My Source" }) };
      return { run: vi.fn(), get: () => ({ max_num: 1 }) };
    });

    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(sourceJson));
    // Second call for target
    (fs.readFileSync as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(JSON.stringify(sourceJson))
      .mockReturnValueOnce(JSON.stringify(targetJson));
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

    (composeLayers as ReturnType<typeof vi.fn>).mockReturnValue(mergedJson);

    const res = handleCompose("anim1", "source1", "compose source1");
    const text = await res.text();
    expect(text).toContain("Composed");
    expect(text).toContain("1 layer");
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(animationEvents.emit).toHaveBeenCalledWith("updated", { animationId: "anim1" });
  });
});
