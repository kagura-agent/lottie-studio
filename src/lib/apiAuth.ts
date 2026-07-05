import crypto from "node:crypto";
import { db } from "@/lib/db";

interface ApiKey {
  id: string;
  key_hash: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  rate_limit: number;
  enabled: number;
}

export interface AuthResult {
  ok: true;
  keyId: string;
  rateLimit: number;
}

export interface AuthError {
  ok: false;
  status: number;
  error: string;
}

export function authenticateRequest(
  request: Request
): AuthResult | AuthError {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { ok: false, status: 401, error: "Missing Authorization header" };
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return { ok: false, status: 401, error: "Invalid Authorization format. Use: Bearer <api-key>" };
  }

  const rawKey = parts[1];
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const row = db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .get(keyHash) as ApiKey | undefined;

  if (!row) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  if (!row.enabled) {
    return { ok: false, status: 403, error: "API key is disabled" };
  }

  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(
    row.id
  );

  return { ok: true, keyId: row.id, rateLimit: row.rate_limit };
}
