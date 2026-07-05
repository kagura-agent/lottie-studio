import crypto from "node:crypto";
import { db } from "./db";

const KEY_PREFIX = "ls_";
const KEY_BYTES = 16; // 16 bytes = 32 hex chars

export interface ApiKey {
  id: string;
  key_hash: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  rate_limit: number;
  enabled: number;
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(name: string): { id: string; key: string; name: string } {
  const id = crypto.randomUUID();
  const rawBytes = crypto.randomBytes(KEY_BYTES).toString("hex");
  const key = `${KEY_PREFIX}${rawBytes}`;
  const keyHash = hashKey(key);

  db.prepare(
    "INSERT INTO api_keys (id, key_hash, name) VALUES (?, ?, ?)"
  ).run(id, keyHash, name);

  return { id, key, name };
}

export function validateApiKey(key: string): ApiKey | null {
  const keyHash = hashKey(key);
  const row = db.prepare(
    "SELECT * FROM api_keys WHERE key_hash = ?"
  ).get(keyHash) as ApiKey | undefined;

  if (!row) return null;
  return row;
}

export function updateLastUsed(id: string): void {
  db.prepare(
    "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?"
  ).run(id);
}
