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

// Migration: add previous_lottie_json column for before/after comparison
try {
  db.exec(`ALTER TABLE messages ADD COLUMN previous_lottie_json TEXT`);
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

// Migration: add like_count column to track animation likes
try {
  db.exec(`ALTER TABLE animations ADD COLUMN like_count INTEGER DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

// Migration: add remixed_from column to track remix provenance
try {
  db.exec(`ALTER TABLE animations ADD COLUMN remixed_from TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: add remixed_from column to track remix lineage
try {
  db.exec(`ALTER TABLE animations ADD COLUMN remixed_from TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: add creator_id column for anonymous creator identity
try {
  db.exec(`ALTER TABLE animations ADD COLUMN creator_id TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: add creator_name column for optional display name
try {
  db.exec(`ALTER TABLE animations ADD COLUMN creator_name TEXT`);
} catch {
  // Column already exists — ignore
}

// Likes table for IP-based deduplication (legacy)
db.exec(`
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animation_id TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(animation_id, ip)
  )
`);

// Migration: add user_id column to likes for authenticated user likes
try {
  db.exec(`ALTER TABLE likes ADD COLUMN user_id TEXT`);
} catch {
  // Column already exists — ignore
}

// Migration: unique index on (user_id, animation_id) for user-based likes
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_animation ON likes(user_id, animation_id) WHERE user_id IS NOT NULL`);

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

// --- FTS5 Full-Text Search ---

db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS animations_fts USING fts5(
    name, description, tags,
    content='animations',
    content_rowid='rowid'
  )
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS animations_fts_ai AFTER INSERT ON animations BEGIN
    INSERT INTO animations_fts(rowid, name, description, tags)
    VALUES (new.rowid, new.name, COALESCE(new.description, ''), COALESCE(new.tags, ''));
  END
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS animations_fts_ad AFTER DELETE ON animations BEGIN
    INSERT INTO animations_fts(animations_fts, rowid, name, description, tags)
    VALUES ('delete', old.rowid, old.name, COALESCE(old.description, ''), COALESCE(old.tags, ''));
  END
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS animations_fts_au AFTER UPDATE ON animations BEGIN
    INSERT INTO animations_fts(animations_fts, rowid, name, description, tags)
    VALUES ('delete', old.rowid, old.name, COALESCE(old.description, ''), COALESCE(old.tags, ''));
    INSERT INTO animations_fts(rowid, name, description, tags)
    VALUES (new.rowid, new.name, COALESCE(new.description, ''), COALESCE(new.tags, ''));
  END
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

// --- Collections ---

db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    creator_id TEXT NOT NULL,
    is_public INTEGER DEFAULT 0,
    cover_animation_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS collection_items (
    collection_id TEXT NOT NULL,
    animation_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (collection_id, animation_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (animation_id) REFERENCES animations(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_collections_creator ON collections(creator_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_collection_items_animation ON collection_items(animation_id)`);

// --- Presets ---

db.exec(`
  CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    instructions TEXT NOT NULL,
    is_builtin INTEGER DEFAULT 0,
    creator_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Seed built-in presets
const BUILTIN_PRESETS = [
  {
    name: "bounce",
    description: "Elastic bounce entrance with overshoot and settle",
    instructions: "Apply a bounce entrance effect. Add scale keyframes: start at [0,0], overshoot to [110,110] at 60% duration, settle back to [100,100]. Use ease-out back easing. Add a subtle squash at the landing point for organic feel.",
  },
  {
    name: "fade-in",
    description: "Smooth opacity fade from invisible to fully visible",
    instructions: "Apply a smooth fade-in effect. Animate opacity from 0 to 100 over the full duration using ease-in-out easing. Optionally combine with a subtle upward drift of 10-15 pixels for a polished entrance.",
  },
  {
    name: "slide-up",
    description: "Element slides upward into its final position",
    instructions: "Apply a slide-up entrance. Start the element 100-150 pixels below its final position with opacity 0. Animate position Y back to the original value and opacity to 100 over the duration using ease-out easing with slight overshoot.",
  },
  {
    name: "pulse",
    description: "Rhythmic scale pulse like a heartbeat",
    instructions: "Apply a pulse/heartbeat effect. Add looping scale keyframes: [100,100] → [115,115] → [95,95] → [100,100]. Use smooth ease-in-out. Make it loop seamlessly with consistent rhythm.",
  },
  {
    name: "wiggle",
    description: "Playful side-to-side wiggle rotation",
    instructions: "Apply a wiggle effect. Add rapid rotation keyframes oscillating between -5° and +5° (or -10° and +10° for more intensity) over short intervals. Use ease-in-out easing. Loop seamlessly for a playful, attention-grabbing feel.",
  },
  {
    name: "spin",
    description: "Continuous 360-degree rotation",
    instructions: "Apply a continuous rotation. Add rotation keyframes from 0° to 360° over the full duration with linear easing for constant speed. Loop seamlessly. Ensure the anchor point is centered on the element.",
  },
];

const seedPreset = db.prepare(`
  INSERT OR IGNORE INTO presets (id, name, description, instructions, is_builtin)
  VALUES (?, ?, ?, ?, 1)
`);

for (const preset of BUILTIN_PRESETS) {
  seedPreset.run(
    crypto.createHash("sha256").update(`preset:${preset.name}`).digest("hex").slice(0, 36),
    preset.name,
    preset.description,
    preset.instructions
  );
}

// --- Sequences ---

db.exec(`
  CREATE TABLE IF NOT EXISTS sequences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    creator_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sequence_items (
    id TEXT PRIMARY KEY,
    sequence_id TEXT NOT NULL,
    animation_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    transition_type TEXT DEFAULT 'cut',
    transition_duration_ms INTEGER DEFAULT 500,
    added_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
    FOREIGN KEY (animation_id) REFERENCES animations(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sequences_creator ON sequences(creator_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sequence_items_sequence ON sequence_items(sequence_id, position)`);

// --- Users & Sessions (Auth) ---

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);

// --- OAuth Accounts ---

db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, provider_account_id)
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id)`);

// Migration: add user_id column to animations for authenticated ownership
try {
  db.exec(`ALTER TABLE animations ADD COLUMN user_id TEXT`);
} catch {
  // Column already exists — ignore
}

// --- API Keys ---

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    rate_limit INTEGER DEFAULT 60,
    enabled INTEGER DEFAULT 1
  )
`);

// --- Comments ---

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    animation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (animation_id) REFERENCES animations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_animation ON comments(animation_id, created_at DESC)`);

// Migration: add comment_count column to animations
try {
  db.exec(`ALTER TABLE animations ADD COLUMN comment_count INTEGER DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

// --- Follows ---

db.exec(`
  CREATE TABLE IF NOT EXISTS follows (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id),
    UNIQUE(follower_id, following_id)
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)`);

// Migration: add follower_count and following_count to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN follower_count INTEGER DEFAULT 0`);
} catch {
  // Column already exists — ignore
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN following_count INTEGER DEFAULT 0`);
} catch {
  // Column already exists — ignore
}

// Populate FTS index on startup if empty but animations exist
const ftsCount = (db.prepare('SELECT COUNT(*) as count FROM animations_fts').get() as { count: number }).count;
const animCount = (db.prepare('SELECT COUNT(*) as count FROM animations').get() as { count: number }).count;
if (ftsCount === 0 && animCount > 0) {
  db.exec("INSERT INTO animations_fts(rowid, name, description, tags) SELECT rowid, name, COALESCE(description, ''), COALESCE(tags, '') FROM animations");
}

// --- Preset Query Functions ---

export interface Preset {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  is_builtin: number;
  creator_id: string | null;
  created_at: string;
}

export function getAllPresets(): Preset[] {
  return db.prepare("SELECT * FROM presets ORDER BY is_builtin DESC, name ASC").all() as Preset[];
}

export function getPresetByName(name: string): Preset | undefined {
  return db.prepare("SELECT * FROM presets WHERE name = ?").get(name) as Preset | undefined;
}

export function createPreset(
  name: string,
  description: string | null,
  instructions: string,
  creatorId?: string
): Preset {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO presets (id, name, description, instructions, is_builtin, creator_id) VALUES (?, ?, ?, ?, 0, ?)"
  ).run(id, name, description, instructions, creatorId || null);
  return db.prepare("SELECT * FROM presets WHERE id = ?").get(id) as Preset;
}

export function deletePreset(id: string): boolean {
  const result = db.prepare("DELETE FROM presets WHERE id = ? AND is_builtin = 0").run(id);
  return result.changes > 0;
}

export function deletePresetByName(name: string): boolean {
  const result = db.prepare("DELETE FROM presets WHERE name = ? AND is_builtin = 0").run(name);
  return result.changes > 0;
}

export function renamePreset(oldName: string, newName: string): boolean {
  // Check if source exists and is not built-in
  const preset = db.prepare("SELECT id, is_builtin FROM presets WHERE name = ?").get(oldName) as { id: string; is_builtin: number } | undefined;
  if (!preset || preset.is_builtin === 1) return false;

  // Check if target name already exists
  const existing = db.prepare("SELECT id FROM presets WHERE name = ?").get(newName);
  if (existing) return false;

  const result = db.prepare("UPDATE presets SET name = ? WHERE name = ? AND is_builtin = 0").run(newName, oldName);
  return result.changes > 0;
}

// --- Sequence Types & Query Functions ---

export const VALID_TRANSITIONS = [
  "cut",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
] as const;

export type TransitionType = (typeof VALID_TRANSITIONS)[number];

export interface Sequence {
  id: string;
  name: string;
  description: string;
  creator_id: string;
  created_at: string;
  updated_at: string;
}

export interface SequenceItem {
  id: string;
  sequence_id: string;
  animation_id: string;
  position: number;
  transition_type: string;
  transition_duration_ms: number;
  added_at: string;
}

export interface SequenceWithItems extends Sequence {
  items: (SequenceItem & { animation_name: string | null; duration_seconds: number | null })[];
}

export function createSequence(
  name: string,
  description: string,
  creatorId: string
): Sequence {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO sequences (id, name, description, creator_id) VALUES (?, ?, ?, ?)"
  ).run(id, name, description || "", creatorId);
  return db.prepare("SELECT * FROM sequences WHERE id = ?").get(id) as Sequence;
}

export function getSequence(id: string): SequenceWithItems | undefined {
  const seq = db.prepare("SELECT * FROM sequences WHERE id = ?").get(id) as Sequence | undefined;
  if (!seq) return undefined;

  const items = db
    .prepare(
      `SELECT si.*, a.name as animation_name, a.duration_seconds
       FROM sequence_items si
       LEFT JOIN animations a ON a.id = si.animation_id
       WHERE si.sequence_id = ?
       ORDER BY si.position ASC, si.added_at ASC`
    )
    .all(id) as (SequenceItem & { animation_name: string | null; duration_seconds: number | null })[];

  return { ...seq, items };
}

export function listSequences(
  creatorId: string
): (Sequence & { item_count: number })[] {
  return db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM sequence_items si WHERE si.sequence_id = s.id) as item_count
       FROM sequences s
       WHERE s.creator_id = ?
       ORDER BY s.updated_at DESC`
    )
    .all(creatorId) as (Sequence & { item_count: number })[];
}

export function findSequencesByName(
  name: string
): SequenceWithItems[] {
  const rows = db
    .prepare(
      "SELECT * FROM sequences WHERE LOWER(name) = LOWER(?) ORDER BY updated_at DESC LIMIT 5"
    )
    .all(name) as Sequence[];

  return rows.map((seq) => {
    const items = db
      .prepare(
        `SELECT si.*, a.name as animation_name, a.duration_seconds
         FROM sequence_items si
         LEFT JOIN animations a ON a.id = si.animation_id
         WHERE si.sequence_id = ?
         ORDER BY si.position ASC, si.added_at ASC`
      )
      .all(seq.id) as (SequenceItem & { animation_name: string | null; duration_seconds: number | null })[];
    return { ...seq, items };
  });
}

export function updateSequence(
  id: string,
  fields: { name?: string; description?: string }
): boolean {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (fields.name !== undefined) {
    updates.push("name = ?");
    values.push(fields.name);
  }
  if (fields.description !== undefined) {
    updates.push("description = ?");
    values.push(fields.description);
  }

  if (updates.length === 0) return false;

  updates.push("updated_at = datetime('now')");
  values.push(id);

  const result = db
    .prepare(`UPDATE sequences SET ${updates.join(", ")} WHERE id = ?`)
    .run(...values);
  return result.changes > 0;
}

export function deleteSequence(id: string): boolean {
  db.prepare("DELETE FROM sequence_items WHERE sequence_id = ?").run(id);
  const result = db.prepare("DELETE FROM sequences WHERE id = ?").run(id);
  return result.changes > 0;
}

export function addSequenceItem(
  sequenceId: string,
  animationId: string,
  position?: number,
  transitionType?: string,
  transitionDurationMs?: number
): SequenceItem {
  const id = crypto.randomUUID();

  if (position === undefined) {
    const maxPos = db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) as max_pos FROM sequence_items WHERE sequence_id = ?"
      )
      .get(sequenceId) as { max_pos: number };
    position = maxPos.max_pos + 1;
  }

  db.prepare(
    `INSERT INTO sequence_items (id, sequence_id, animation_id, position, transition_type, transition_duration_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sequenceId,
    animationId,
    position,
    transitionType || "cut",
    transitionDurationMs ?? 500
  );

  db.prepare("UPDATE sequences SET updated_at = datetime('now') WHERE id = ?").run(sequenceId);

  return db.prepare("SELECT * FROM sequence_items WHERE id = ?").get(id) as SequenceItem;
}

export function updateSequenceItem(
  itemId: string,
  fields: { position?: number; transitionType?: string; transitionDurationMs?: number }
): boolean {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (fields.position !== undefined) {
    updates.push("position = ?");
    values.push(fields.position);
  }
  if (fields.transitionType !== undefined) {
    updates.push("transition_type = ?");
    values.push(fields.transitionType);
  }
  if (fields.transitionDurationMs !== undefined) {
    updates.push("transition_duration_ms = ?");
    values.push(fields.transitionDurationMs);
  }

  if (updates.length === 0) return false;

  values.push(itemId);
  const result = db
    .prepare(`UPDATE sequence_items SET ${updates.join(", ")} WHERE id = ?`)
    .run(...values);
  return result.changes > 0;
}

export function removeSequenceItem(itemId: string): boolean {
  const result = db.prepare("DELETE FROM sequence_items WHERE id = ?").run(itemId);
  return result.changes > 0;
}

export function reorderSequenceItems(sequenceId: string, itemIds: string[]): void {
  const updateStmt = db.prepare(
    "UPDATE sequence_items SET position = ? WHERE id = ? AND sequence_id = ?"
  );
  const reorderAll = db.transaction(() => {
    for (let i = 0; i < itemIds.length; i++) {
      updateStmt.run(i, itemIds[i], sequenceId);
    }
  });
  reorderAll();
  db.prepare("UPDATE sequences SET updated_at = datetime('now') WHERE id = ?").run(sequenceId);
}

export { db, ANIMATIONS_DIR };
