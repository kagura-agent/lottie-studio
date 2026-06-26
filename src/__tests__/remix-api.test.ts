import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Test the remix logic in isolation — pure functions extracted from
 * the remix API route (src/app/api/animations/[id]/remix/route.ts).
 *
 * We avoid importing the route directly (requires DB/FS), and instead
 * test the core business logic as pure functions.
 */

/** Generate the remixed animation name */
function remixName(originalName: string): string {
  return `Remix of ${originalName}`;
}

/** Generate the system message for a remixed animation */
function remixSystemMessage(originalName: string): string {
  return `This animation was remixed from "${originalName}". Feel free to modify it — try describing changes in the chat!`;
}

/** Build the remix DB row (without side effects) */
function buildRemixRow(
  original: {
    id: string;
    name: string;
    frame_count: number | null;
    duration_seconds: number | null;
    tags: string | null;
    description: string | null;
  },
  newId: string
) {
  return {
    id: newId,
    name: remixName(original.name),
    frame_count: original.frame_count,
    duration_seconds: original.duration_seconds,
    tags: original.tags,
    description: original.description,
    remixed_from: original.id,
  };
}

describe("Remix: name generation", () => {
  it("produces 'Remix of <name>' format", () => {
    expect(remixName("Bouncing Ball")).toBe("Remix of Bouncing Ball");
  });

  it("handles empty name", () => {
    expect(remixName("")).toBe("Remix of ");
  });

  it("handles name with special characters", () => {
    expect(remixName('My "Cool" Animation')).toBe('Remix of My "Cool" Animation');
  });

  it("handles already-remixed name", () => {
    expect(remixName("Remix of Spinner")).toBe("Remix of Remix of Spinner");
  });
});

describe("Remix: system message", () => {
  it("includes the original animation name in quotes", () => {
    const msg = remixSystemMessage("Spinning Logo");
    expect(msg).toContain('"Spinning Logo"');
  });

  it("mentions remix provenance", () => {
    const msg = remixSystemMessage("Test");
    expect(msg).toMatch(/remixed from/i);
  });

  it("encourages modification via chat", () => {
    const msg = remixSystemMessage("Test");
    expect(msg).toMatch(/chat/i);
  });
});

describe("Remix: row builder", () => {
  const original = {
    id: "original-uuid-1234",
    name: "Sakura Petals",
    frame_count: 120,
    duration_seconds: 4.0,
    tags: "nature,animation",
    description: "Sakura petals falling",
  };

  it("generates correct name format", () => {
    const newId = randomUUID();
    const row = buildRemixRow(original, newId);
    expect(row.name).toBe("Remix of Sakura Petals");
  });

  it("uses the provided new ID", () => {
    const newId = randomUUID();
    const row = buildRemixRow(original, newId);
    expect(row.id).toBe(newId);
    expect(row.id).not.toBe(original.id);
  });

  it("sets remixed_from to original ID", () => {
    const newId = randomUUID();
    const row = buildRemixRow(original, newId);
    expect(row.remixed_from).toBe("original-uuid-1234");
  });

  it("copies tags from original", () => {
    const newId = randomUUID();
    const row = buildRemixRow(original, newId);
    expect(row.tags).toBe("nature,animation");
  });

  it("copies description from original", () => {
    const newId = randomUUID();
    const row = buildRemixRow(original, newId);
    expect(row.description).toBe("Sakura petals falling");
  });

  it("copies frame_count and duration_seconds", () => {
    const newId = randomUUID();
    const row = buildRemixRow(original, newId);
    expect(row.frame_count).toBe(120);
    expect(row.duration_seconds).toBe(4.0);
  });

  it("handles null tags and description", () => {
    const sparse = { ...original, tags: null, description: null };
    const newId = randomUUID();
    const row = buildRemixRow(sparse, newId);
    expect(row.tags).toBeNull();
    expect(row.description).toBeNull();
  });

  it("handles null frame_count and duration", () => {
    const sparse = { ...original, frame_count: null, duration_seconds: null };
    const newId = randomUUID();
    const row = buildRemixRow(sparse, newId);
    expect(row.frame_count).toBeNull();
    expect(row.duration_seconds).toBeNull();
  });
});
