import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE animations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      share_chat INTEGER DEFAULT 0,
      frame_count INTEGER,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS animations_fts USING fts5(
      name, description, tags,
      content='animations',
      content_rowid='rowid'
    )
  `);

  db.exec(`
    CREATE TRIGGER animations_fts_ai AFTER INSERT ON animations BEGIN
      INSERT INTO animations_fts(rowid, name, description, tags)
      VALUES (new.rowid, new.name, COALESCE(new.description, ''), COALESCE(new.tags, ''));
    END
  `);

  db.exec(`
    CREATE TRIGGER animations_fts_ad AFTER DELETE ON animations BEGIN
      INSERT INTO animations_fts(animations_fts, rowid, name, description, tags)
      VALUES ('delete', old.rowid, old.name, COALESCE(old.description, ''), COALESCE(old.tags, ''));
    END
  `);

  db.exec(`
    CREATE TRIGGER animations_fts_au AFTER UPDATE ON animations BEGIN
      INSERT INTO animations_fts(animations_fts, rowid, name, description, tags)
      VALUES ('delete', old.rowid, old.name, COALESCE(old.description, ''), COALESCE(old.tags, ''));
      INSERT INTO animations_fts(rowid, name, description, tags)
      VALUES (new.rowid, new.name, COALESCE(new.description, ''), COALESCE(new.tags, ''));
    END
  `);

  return db;
}

function insertAnimation(
  db: InstanceType<typeof Database>,
  data: {
    id: string;
    name: string;
    description?: string | null;
    tags?: string | null;
    share_chat?: number;
    frame_count?: number | null;
  }
) {
  db.prepare(
    `INSERT INTO animations (id, name, description, tags, share_chat, frame_count)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    data.id,
    data.name,
    data.description ?? null,
    data.tags ?? null,
    data.share_chat ?? 1,
    data.frame_count === undefined ? 60 : data.frame_count
  );
}

/**
 * FTS query helper — mirrors the explore route logic.
 */
function ftsSearch(
  db: InstanceType<typeof Database>,
  query: string,
  options?: { tag?: string; sort?: string; limit?: number; offset?: number }
) {
  const tokens = query.split(/\s+/).filter(Boolean);
  const ftsQuery = tokens
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" ");
  const limit = options?.limit ?? 24;
  const offset = options?.offset ?? 0;

  const conditions = [
    "animations_fts MATCH ?",
    "animations.share_chat = 1",
    "animations.frame_count IS NOT NULL",
  ];
  const params: (string | number)[] = [ftsQuery];

  if (options?.tag) {
    conditions.push(
      "(animations.tags = ? OR animations.tags LIKE ? OR animations.tags LIKE ? OR animations.tags LIKE ?)"
    );
    params.push(
      options.tag,
      `${options.tag},%`,
      `%,${options.tag}`,
      `%,${options.tag},%`
    );
  }

  const where = "WHERE " + conditions.join(" AND ");
  const orderBy =
    !options?.sort || options.sort === "newest"
      ? "bm25(animations_fts)"
      : "animations.created_at DESC";

  const rows = db
    .prepare(
      `SELECT animations.id, animations.name, animations.description, animations.tags
       FROM animations
       INNER JOIN animations_fts ON animations.rowid = animations_fts.rowid
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as {
    id: string;
    name: string;
    description: string | null;
    tags: string | null;
  }[];

  return rows;
}

describe("FTS5 search", () => {
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    db = createTestDb();
    insertAnimation(db, {
      id: "1",
      name: "Bouncing Ball",
      description: "A ball that bounces up and down",
      tags: "loading,geometric",
    });
    insertAnimation(db, {
      id: "2",
      name: "Spinner",
      description: "Loading spinner animation",
      tags: "loading,ui-element",
    });
    insertAnimation(db, {
      id: "3",
      name: "Heart Beat",
      description: "Pulsing heart celebration",
      tags: "celebration,character",
    });
    insertAnimation(db, {
      id: "4",
      name: "Logo Reveal",
      description: "Brand logo entrance effect",
      tags: "logo,text",
    });
    insertAnimation(db, {
      id: "5",
      name: "Confetti",
      description: "Celebration confetti shower",
      tags: "celebration,particle",
    });
    insertAnimation(db, {
      id: "hidden",
      name: "Hidden Ball",
      description: "Not shared",
      tags: "loading",
      share_chat: 0,
    });
    insertAnimation(db, {
      id: "noframes",
      name: "Ball Draft",
      description: "Draft with ball keyword",
      tags: "loading",
      frame_count: null,
    });
  });

  it("searches across name", () => {
    const results = ftsSearch(db, "bouncing");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("1");
  });

  it("searches across description", () => {
    // "entrance" only appears in description of Logo Reveal
    const results = ftsSearch(db, "entrance");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("4");
  });

  it("searches across tags", () => {
    // "geometric" only appears in tags of Bouncing Ball
    const results = ftsSearch(db, "geometric");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("1");
  });

  it("finds matches across multiple columns", () => {
    // "celebration" appears in description and tags of Heart Beat and Confetti
    const results = ftsSearch(db, "celebration");
    const ids = results.map((r) => r.id);
    expect(ids).toContain("3");
    expect(ids).toContain("5");
  });

  it("ranks results by relevance (bm25)", () => {
    // "loading" appears in:
    // - animation 2: description ("Loading spinner") + tags ("loading")
    // - animation 1: tags ("loading") only
    // animation 2 should rank higher due to more occurrences
    const results = ftsSearch(db, "loading");
    expect(results.length).toBeGreaterThanOrEqual(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("1");
    expect(ids).toContain("2");
    // animation 2 should be ranked first (more matches)
    expect(ids.indexOf("2")).toBeLessThan(ids.indexOf("1"));
  });

  it("excludes non-shared animations", () => {
    const results = ftsSearch(db, "ball");
    expect(results.find((r) => r.id === "hidden")).toBeUndefined();
  });

  it("excludes animations without frame_count", () => {
    const results = ftsSearch(db, "ball");
    expect(results.find((r) => r.id === "noframes")).toBeUndefined();
  });

  it("combines FTS search with tag filtering", () => {
    // Search "loading" but filter by tag "geometric" — only animation 1 matches both
    const results = ftsSearch(db, "loading", { tag: "geometric" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("1");
  });

  it("handles multi-word queries", () => {
    const results = ftsSearch(db, "bouncing ball");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("1");
  });

  it("returns empty results for non-matching query", () => {
    const results = ftsSearch(db, "xyznonexistent");
    expect(results.length).toBe(0);
  });

  it("handles special characters without crashing", () => {
    // Double quotes are escaped by the tokenizer
    expect(() => ftsSearch(db, 'test"query')).not.toThrow();
    // Asterisks inside quotes are treated as literals
    expect(() => ftsSearch(db, "hello*world")).not.toThrow();
  });

  it("respects pagination", () => {
    const page1 = ftsSearch(db, "celebration", { limit: 1, offset: 0 });
    const page2 = ftsSearch(db, "celebration", { limit: 1, offset: 1 });
    expect(page1.length).toBe(1);
    expect(page2.length).toBe(1);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it("FTS index stays in sync after insert", () => {
    insertAnimation(db, {
      id: "6",
      name: "New Animation",
      description: "freshly added unique content",
      tags: "loading",
    });
    const results = ftsSearch(db, "freshly");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("6");
  });

  it("FTS index stays in sync after update", () => {
    db.prepare("UPDATE animations SET description = ? WHERE id = ?").run(
      "updated unique searchterm xyz",
      "1"
    );
    const results = ftsSearch(db, "searchterm");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("1");
  });

  it("FTS index stays in sync after delete", () => {
    db.prepare("DELETE FROM animations WHERE id = ?").run("1");
    const results = ftsSearch(db, "bouncing");
    expect(results.length).toBe(0);
  });
});

describe("Non-FTS query (no search term)", () => {
  it("standard query works without FTS", () => {
    const db = createTestDb();
    insertAnimation(db, {
      id: "1",
      name: "Test",
      description: "desc",
      tags: "loading",
    });

    const rows = db
      .prepare(
        "SELECT id, name FROM animations WHERE share_chat = 1 AND frame_count IS NOT NULL ORDER BY created_at DESC"
      )
      .all() as { id: string; name: string }[];

    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("1");
  });
});
