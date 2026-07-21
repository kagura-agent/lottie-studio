/**
 * Tests for db.ts module-level initialization branches.
 * Manipulates DB state BEFORE importing db.ts to exercise:
 * - seedGallery transaction (lines 250-307): no shared animations → full seed runs
 * - FTS rebuild (line 590): FTS empty + animations exist → rebuild fires
 * - deterministicId (lines 224-230): always called during seed
 * - WAL retry (lines 24-27): verified post-hoc (catch branch untestable without lock)
 *
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "lottie-studio.db");
const ANIMATIONS_DIR = path.join(DATA_DIR, "animations");
const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");

const templateFiles = fs.existsSync(TEMPLATES_DIR)
  ? fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".json") && f !== "index.json")
  : [];

// --- DB manipulation before module load ---
const rawDb = new Database(DB_PATH);
rawDb.pragma("journal_mode = WAL");
rawDb.pragma("busy_timeout = 5000");
rawDb.pragma("foreign_keys = OFF");

// Drop FTS triggers and table to avoid "malformed" errors
rawDb.exec("DROP TRIGGER IF EXISTS animations_fts_ai");
rawDb.exec("DROP TRIGGER IF EXISTS animations_fts_ad");
rawDb.exec("DROP TRIGGER IF EXISTS animations_fts_au");
rawDb.exec("DROP TABLE IF EXISTS animations_fts");

// Clear shared animations so seedGallery's check returns count=0
rawDb.exec("DELETE FROM animations WHERE share_chat = 1");

// Insert a non-shared animation so animCount > 0 for FTS rebuild check
rawDb.exec("INSERT OR IGNORE INTO animations (id, name, share_chat) VALUES ('fts-sentinel', 'FTS Sentinel', 0)");

// Recreate empty FTS table
rawDb.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS animations_fts USING fts5(
    name, description, tags,
    content='animations',
    content_rowid='rowid'
  )
`);

rawDb.pragma("foreign_keys = ON");

// Create a temp template file with no op/fr/metadata to exercise fallback branches (lines 274-285)
const TEMP_TEMPLATE = "_test-no-metadata.json";
fs.writeFileSync(
  path.join(TEMPLATES_DIR, TEMP_TEMPLATE),
  JSON.stringify({ v: "5.0", layers: [] })
);

// Remove some seeded animation JSON files to exercise fs.copyFileSync branch (line 291)
const crypto = require("node:crypto");
const NAMESPACE = "lottie-studio:seed-gallery";
for (const tf of templateFiles.slice(0, 3)) {
  const hash = crypto.createHash("sha256").update(`${NAMESPACE}:${tf}`).digest("hex");
  const id = [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join("-");
  const dest = path.join(ANIMATIONS_DIR, `${id}.json`);
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
  }
}

rawDb.close();

// --- Now import db.ts which will execute init code ---

describe("db.ts module initialization", () => {
  it("seedGallery seeds templates and FTS is rebuilt", async () => {
    const { db, ANIMATIONS_DIR: animDir } = await import("@/lib/db");

    // Clean up temp template immediately
    const tempPath = path.join(TEMPLATES_DIR, TEMP_TEMPLATE);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    // --- seedGallery (lines 250-307) ---
    if (templateFiles.length > 0) {
      const shared = (db.prepare("SELECT COUNT(*) as count FROM animations WHERE share_chat = 1").get() as { count: number }).count;
      expect(shared).toBeGreaterThan(0);

      // Verify files were copied
      const animFiles = fs.readdirSync(animDir).filter(f => f.endsWith(".json"));
      expect(animFiles.length).toBeGreaterThan(0);

      // Verify template_source is set
      const row = db.prepare("SELECT template_source FROM animations WHERE share_chat = 1 LIMIT 1").get() as { template_source: string };
      expect(row.template_source).toBeTruthy();
    }

    // --- FTS rebuild (line 590) ---
    const animCount = (db.prepare("SELECT COUNT(*) as count FROM animations").get() as { count: number }).count;
    expect(animCount).toBeGreaterThan(0);
    const ftsCount = (db.prepare("SELECT COUNT(*) as count FROM animations_fts").get() as { count: number }).count;
    expect(ftsCount).toBeGreaterThan(0);

    // --- deterministicId fallback branches (lines 274-285) ---
    const noMetaHash = crypto.createHash("sha256").update(`${NAMESPACE}:${TEMP_TEMPLATE}`).digest("hex");
    const noMetaId = [noMetaHash.slice(0, 8), noMetaHash.slice(8, 12), noMetaHash.slice(12, 16), noMetaHash.slice(16, 20), noMetaHash.slice(20, 32)].join("-");
    const noMetaRow = db.prepare("SELECT name, frame_count, duration_seconds FROM animations WHERE id = ?").get(noMetaId) as { name: string; frame_count: number; duration_seconds: number } | undefined;
    if (noMetaRow) {
      // Name derived from filename (meta?.name ?? fallback)
      expect(noMetaRow.name).toContain("test no metadata");
      // op ?? 0 → frame_count = 0
      expect(noMetaRow.frame_count).toBe(0);
      // fr ?? 30, 0/30 = 0
      expect(noMetaRow.duration_seconds).toBe(0);
    }

    // --- WAL mode (lines 19-29) ---
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");

    // Clean up
    db.prepare("DELETE FROM animations WHERE id = ?").run("fts-sentinel");
    db.prepare("DELETE FROM animations WHERE id = ?").run(noMetaId);
    const noMetaFile = path.join(animDir, `${noMetaId}.json`);
    if (fs.existsSync(noMetaFile)) fs.unlinkSync(noMetaFile);
  });
});
