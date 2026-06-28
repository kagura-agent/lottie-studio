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
      creator_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      animation_id TEXT NOT NULL REFERENCES animations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      lottie_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

describe("creation_prompt subquery", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it("returns first user message as creation_prompt", () => {
    db.prepare(
      `INSERT INTO animations (id, name, share_chat, frame_count, created_at) VALUES (?, ?, 1, 30, datetime('now'))`
    ).run("anim1", "Test Animation");

    // Insert messages: assistant first, then user messages
    db.prepare(
      `INSERT INTO messages (id, animation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run("msg1", "anim1", "assistant", "Hello! How can I help?", "2026-01-01 00:00:00");
    db.prepare(
      `INSERT INTO messages (id, animation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run("msg2", "anim1", "user", "Create a bouncing ball", "2026-01-01 00:00:01");
    db.prepare(
      `INSERT INTO messages (id, animation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run("msg3", "anim1", "user", "Make it red", "2026-01-01 00:00:02");

    const rows = db
      .prepare(
        `SELECT id, name,
         (SELECT m.content FROM messages m WHERE m.animation_id = animations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt
         FROM animations
         WHERE share_chat = 1 AND frame_count IS NOT NULL`
      )
      .all() as { id: string; name: string; creation_prompt: string | null }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].creation_prompt).toBe("Create a bouncing ball");
  });

  it("returns null when animation has no user messages", () => {
    db.prepare(
      `INSERT INTO animations (id, name, share_chat, frame_count, created_at) VALUES (?, ?, 1, 30, datetime('now'))`
    ).run("anim2", "No Messages Animation");

    const rows = db
      .prepare(
        `SELECT id, name,
         (SELECT m.content FROM messages m WHERE m.animation_id = animations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt
         FROM animations
         WHERE share_chat = 1 AND frame_count IS NOT NULL`
      )
      .all() as { id: string; name: string; creation_prompt: string | null }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].creation_prompt).toBeNull();
  });

  it("returns null when animation only has assistant messages", () => {
    db.prepare(
      `INSERT INTO animations (id, name, share_chat, frame_count, created_at) VALUES (?, ?, 1, 30, datetime('now'))`
    ).run("anim3", "Only Assistant");

    db.prepare(
      `INSERT INTO messages (id, animation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run("msg4", "anim3", "assistant", "I created an animation for you", "2026-01-01 00:00:00");

    const rows = db
      .prepare(
        `SELECT id, name,
         (SELECT m.content FROM messages m WHERE m.animation_id = animations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt
         FROM animations
         WHERE share_chat = 1 AND frame_count IS NOT NULL`
      )
      .all() as { id: string; name: string; creation_prompt: string | null }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].creation_prompt).toBeNull();
  });

  it("handles batch query across multiple animations", () => {
    db.prepare(
      `INSERT INTO animations (id, name, share_chat, frame_count, created_at) VALUES (?, ?, 1, 30, ?)`
    ).run("anim-a", "Animation A", "2026-01-01 00:00:00");
    db.prepare(
      `INSERT INTO animations (id, name, share_chat, frame_count, created_at) VALUES (?, ?, 1, 60, ?)`
    ).run("anim-b", "Animation B", "2026-01-02 00:00:00");

    db.prepare(
      `INSERT INTO messages (id, animation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run("msg-a1", "anim-a", "user", "Draw a sun", "2026-01-01 00:00:01");
    db.prepare(
      `INSERT INTO messages (id, animation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run("msg-b1", "anim-b", "user", "Make a loading spinner", "2026-01-02 00:00:01");

    const rows = db
      .prepare(
        `SELECT id, name,
         (SELECT m.content FROM messages m WHERE m.animation_id = animations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1) as creation_prompt
         FROM animations
         WHERE share_chat = 1 AND frame_count IS NOT NULL
         ORDER BY created_at DESC`
      )
      .all() as { id: string; name: string; creation_prompt: string | null }[];

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("anim-b");
    expect(rows[0].creation_prompt).toBe("Make a loading spinner");
    expect(rows[1].id).toBe("anim-a");
    expect(rows[1].creation_prompt).toBe("Draw a sun");
  });
});
