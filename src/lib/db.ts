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

export { db, ANIMATIONS_DIR };
