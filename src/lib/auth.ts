import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const SESSION_DURATION_DAYS = 30;
const SALT_ROUNDS = 10;

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

interface UserRow extends AuthUser {
  password_hash: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSession(userId: string): string {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, userId, token, expiresAt);

  return token;
}

export function validateSession(token: string): AuthUser | null {
  const session = db
    .prepare("SELECT * FROM sessions WHERE token = ?")
    .get(token) as SessionRow | undefined;

  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
    return null;
  }

  const user = db
    .prepare(
      "SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?"
    )
    .get(session.user_id) as AuthUser | undefined;

  return user ?? null;
}

export function deleteSession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function createUser(
  email: string,
  passwordHash: string,
  displayName?: string
): AuthUser {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)"
  ).run(id, email, passwordHash, displayName || null);

  return db
    .prepare(
      "SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?"
    )
    .get(id) as AuthUser;
}

export function findUserByEmail(email: string): UserRow | null {
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;
  return user ?? null;
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;
