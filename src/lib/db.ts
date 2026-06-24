import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { templates } from "@/data/templates";
import { inferTags, serializeTags } from "@/lib/tag-inference";

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

// --- Gallery Seeding ---
// Seeds the explore gallery with template animations when DB has no shared content.

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");

/**
 * Generate a deterministic UUID-like ID from a template filename.
 * Uses SHA-256 hash with a fixed namespace to ensure idempotency.
 */
function deterministicId(filename: string): string {
  const NAMESPACE = "lottie-studio:seed-gallery";
  const hash = crypto
    .createHash("sha256")
    .update(`${NAMESPACE}:${filename}`)
    .digest("hex");
  // Format as UUID-like: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

function seedGallery(): void {
  // Check if gallery already has shared content
  const existing = db
    .prepare("SELECT COUNT(*) as count FROM animations WHERE share_chat = 1")
    .get() as { count: number };

  if (existing.count > 0) {
    return; // Gallery already has content
  }

  // Build a lookup map from filename to template metadata
  const metadataByFilename = new Map(
    templates.map((t) => [t.filename, t])
  );

  // Get all template JSON files (excluding index.json)
  const templateFiles = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".json") && f !== "index.json");

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO animations
      (id, name, description, share_chat, template_source, frame_count, duration_seconds, tags, created_at, updated_at)
    VALUES
      (@id, @name, @description, 1, @template_source, @frame_count, @duration_seconds, @tags, datetime('now'), datetime('now'))
  `);

  const seedAll = db.transaction(() => {
    for (const filename of templateFiles) {
      const id = deterministicId(filename);
      const templatePath = path.join(TEMPLATES_DIR, filename);
      const jsonContent = fs.readFileSync(templatePath, "utf-8");
      const lottie = JSON.parse(jsonContent);

      // Extract animation properties
      const op = lottie.op ?? 0;
      const fr = lottie.fr ?? 30;
      const frameCount = op;
      const durationSeconds = fr > 0 ? op / fr : 0;

      // Get metadata from templates index, or fall back to filename
      const meta = metadataByFilename.get(filename);
      const name = meta?.name ?? filename.replace(/\.json$/, "").replace(/[-_]/g, " ");
      const description = meta?.description ?? null;

      // Infer tags from name + description
      const tagInput = [name, description ?? ""].join(" ");
      const tags = serializeTags(inferTags(tagInput));

      // Copy JSON to animations directory
      const destPath = path.join(ANIMATIONS_DIR, `${id}.json`);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(templatePath, destPath);
      }

      // Insert DB row (OR IGNORE ensures idempotency via PRIMARY KEY)
      insertStmt.run({
        id,
        name,
        description,
        template_source: filename,
        frame_count: frameCount,
        duration_seconds: durationSeconds,
        tags: tags || null,
      });
    }
  });

  seedAll();
}

seedGallery();

export { db, ANIMATIONS_DIR };
