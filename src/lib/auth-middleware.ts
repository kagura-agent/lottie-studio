import { validateSession, type AuthUser } from "@/lib/auth";
import { extractIp } from "@/lib/rateLimit";

export function getAuthUser(request: Request): AuthUser | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)lottie-session=([^\s;]+)/);
  if (!match) return null;
  return validateSession(match[1]);
}

export function requireAuth(
  request: Request
): AuthUser {
  const user = getAuthUser(request);
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

// --- Auth-specific rate limiter (5 attempts per minute per IP) ---

const AUTH_BURST = 5;
const AUTH_WINDOW_MS = 60_000;

interface AuthBucket {
  count: number;
  windowStart: number;
}

const globalForAuthRate = globalThis as unknown as {
  __authRateBuckets?: Map<string, AuthBucket>;
};
const authBuckets =
  globalForAuthRate.__authRateBuckets ??
  (globalForAuthRate.__authRateBuckets = new Map<string, AuthBucket>());

export function checkAuthRate(
  request: Request
): { ok: true } | { ok: false; retryAfterSec: number } {
  const ip = extractIp(request);

  const now = Date.now();
  const bucket = authBuckets.get(ip);

  if (!bucket || now - bucket.windowStart >= AUTH_WINDOW_MS) {
    authBuckets.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (bucket.count >= AUTH_BURST) {
    const retryAfterSec = Math.ceil(
      (bucket.windowStart + AUTH_WINDOW_MS - now) / 1000
    );
    return { ok: false, retryAfterSec };
  }

  bucket.count++;
  return { ok: true };
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Invalid email address";
  return null;
}
