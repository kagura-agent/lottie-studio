import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const ANIMATIONS_DIR = path.join(DATA_DIR, "animations");
const DB_PATH = path.join(DATA_DIR, "lottie-studio.db");

fs.mkdirSync(ANIMATIONS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS animations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    frame_count INTEGER,
    duration_seconds REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    animation_id TEXT NOT NULL REFERENCES animations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    lottie_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_animation_id ON messages(animation_id, created_at)
`);

// Migration: add image_url column for chat image attachments
try {
  db.exec(`ALTER TABLE messages ADD COLUMN image_url TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: add share_chat column to control chat history visibility on share page
try {
  db.exec(`ALTER TABLE animations ADD COLUMN share_chat INTEGER DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

// Migration: add template_source column to track which template an animation was remixed from
try {
  db.exec(`ALTER TABLE animations ADD COLUMN template_source TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: add tags column for auto-categorization (comma-separated tag list)
try {
  db.exec(`ALTER TABLE animations ADD COLUMN tags TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: add view_count column to track animation views
try {
  db.exec(`ALTER TABLE animations ADD COLUMN view_count INTEGER DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

// Migration: add description column for auto-generated animation descriptions
try {
  db.exec(`ALTER TABLE animations ADD COLUMN description TEXT`);
} catch {
  // Column already exists — ignore
}

db.exec(`
  CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animation_id TEXT NOT NULL,
    version_num INTEGER NOT NULL,
    lottie_json TEXT NOT NULL,
    message_id TEXT,
    trigger_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (animation_id) REFERENCES animations(id)
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_versions_animation ON versions(animation_id, version_num)
`);

// Startup cleanup: remove orphaned animation rows (no frames AND no messages)
// These are stale entries from failed LLM generations
db.exec(`
  DELETE FROM animations
  WHERE frame_count IS NULL
    AND id NOT IN (SELECT DISTINCT animation_id FROM messages)
`);

export { db, ANIMATIONS_DIR };
