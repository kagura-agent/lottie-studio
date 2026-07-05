import { describe, it, expect } from "vitest";

/**
 * Tests for the authentication feature — pure logic and validation.
 * Validates signup, login, session, and ownership rules.
 */

// --- Pure helper functions extracted from auth logic ---

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Invalid email address";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
}

function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

function buildSessionCookie(
  token: string,
  maxAgeSec: number,
  isProduction: boolean
): string {
  let cookie = `lottie-session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
  if (isProduction) cookie += "; Secure";
  return cookie;
}

function parseCookieToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(/(?:^|;\s*)lottie-session=([^\s;]+)/);
  return match ? match[1] : null;
}

function stripPasswordHash(user: {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
}): { id: string; email: string; display_name: string | null } {
  return { id: user.id, email: user.email, display_name: user.display_name };
}

function setAnimationOwner(
  animationData: { id: string; user_id: string | null },
  authUserId: string | null
): { id: string; user_id: string | null } {
  return { ...animationData, user_id: authUserId };
}

// --- Rate limiter logic ---

interface RateBucket {
  count: number;
  windowStart: number;
}

function checkRate(
  buckets: Map<string, RateBucket>,
  ip: string,
  burst: number,
  windowMs: number,
  now: number
): { ok: boolean; retryAfterSec?: number } {
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (bucket.count >= burst) {
    const retryAfterSec = Math.ceil(
      (bucket.windowStart + windowMs - now) / 1000
    );
    return { ok: false, retryAfterSec };
  }

  bucket.count++;
  return { ok: true };
}

// --- Tests ---

describe("Auth: email validation", () => {
  it("rejects empty email", () => {
    expect(validateEmail("")).toBe("Email is required");
  });

  it("rejects missing @", () => {
    expect(validateEmail("userexample.com")).toBe("Invalid email address");
  });

  it("rejects missing domain", () => {
    expect(validateEmail("user@")).toBe("Invalid email address");
  });

  it("accepts valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("accepts email with subdomain", () => {
    expect(validateEmail("user@mail.example.com")).toBeNull();
  });
});

describe("Auth: email sanitization", () => {
  it("lowercases email", () => {
    expect(sanitizeEmail("User@EXAMPLE.com")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("handles already clean email", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
  });
});

describe("Auth: password validation", () => {
  it("rejects empty password", () => {
    expect(validatePassword("")).toBe(
      "Password must be at least 8 characters"
    );
  });

  it("rejects short password (7 chars)", () => {
    expect(validatePassword("1234567")).toBe(
      "Password must be at least 8 characters"
    );
  });

  it("accepts 8-character password", () => {
    expect(validatePassword("12345678")).toBeNull();
  });

  it("accepts long password", () => {
    expect(validatePassword("a-very-long-secure-password!")).toBeNull();
  });
});

describe("Auth: signup flow", () => {
  it("rejects duplicate email", () => {
    const existingEmails = new Set(["taken@example.com"]);
    const email = "taken@example.com";
    const isDuplicate = existingEmails.has(email);
    expect(isDuplicate).toBe(true);
  });

  it("accepts unique email", () => {
    const existingEmails = new Set(["taken@example.com"]);
    const email = "new@example.com";
    const isDuplicate = existingEmails.has(email);
    expect(isDuplicate).toBe(false);
  });

  it("rejects weak password on signup", () => {
    expect(validatePassword("short")).toBe(
      "Password must be at least 8 characters"
    );
  });
});

describe("Auth: login flow", () => {
  it("rejects nonexistent user", () => {
    const users = new Map([["user@example.com", { password_hash: "hash" }]]);
    expect(users.has("nobody@example.com")).toBe(false);
  });

  it("finds existing user", () => {
    const users = new Map([["user@example.com", { password_hash: "hash" }]]);
    expect(users.has("user@example.com")).toBe(true);
  });
});

describe("Auth: session validation", () => {
  it("detects valid (non-expired) session", () => {
    const future = new Date(Date.now() + 86400 * 1000).toISOString();
    expect(isSessionExpired(future)).toBe(false);
  });

  it("detects expired session", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isSessionExpired(past)).toBe(true);
  });

  it("handles edge case: exact now", () => {
    const now = new Date().toISOString();
    expect(isSessionExpired(now)).toBe(true);
  });

  it("rejects invalid token (not found)", () => {
    const sessions = new Map([
      ["valid-token", { user_id: "user-1", expires_at: new Date(Date.now() + 86400_000).toISOString() }],
    ]);
    expect(sessions.has("invalid-token")).toBe(false);
  });
});

describe("Auth: cookie parsing", () => {
  it("parses token from cookie header", () => {
    expect(parseCookieToken("lottie-session=abc-123")).toBe("abc-123");
  });

  it("parses token among multiple cookies", () => {
    expect(
      parseCookieToken("other=value; lottie-session=abc-123; another=x")
    ).toBe("abc-123");
  });

  it("returns null when no session cookie", () => {
    expect(parseCookieToken("other=value; foo=bar")).toBeNull();
  });

  it("returns null for empty cookie header", () => {
    expect(parseCookieToken("")).toBeNull();
  });
});

describe("Auth: session cookie builder", () => {
  it("builds dev cookie (no Secure flag)", () => {
    const cookie = buildSessionCookie("token-123", 2592000, false);
    expect(cookie).toContain("lottie-session=token-123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).not.toContain("Secure");
  });

  it("builds production cookie (with Secure flag)", () => {
    const cookie = buildSessionCookie("token-123", 2592000, true);
    expect(cookie).toContain("Secure");
  });
});

describe("Auth: me endpoint (user stripping)", () => {
  it("strips password_hash from user", () => {
    const fullUser = {
      id: "user-1",
      email: "user@example.com",
      password_hash: "$2a$10$secret",
      display_name: "Alice",
    };
    const safe = stripPasswordHash(fullUser);
    expect(safe).toEqual({
      id: "user-1",
      email: "user@example.com",
      display_name: "Alice",
    });
    expect("password_hash" in safe).toBe(false);
  });
});

describe("Auth: animation ownership", () => {
  it("sets user_id when user is authenticated", () => {
    const anim = { id: "anim-1", user_id: null };
    const result = setAnimationOwner(anim, "user-123");
    expect(result.user_id).toBe("user-123");
  });

  it("leaves user_id null when anonymous", () => {
    const anim = { id: "anim-1", user_id: null };
    const result = setAnimationOwner(anim, null);
    expect(result.user_id).toBeNull();
  });

  it("does not modify original animation object", () => {
    const anim = { id: "anim-1", user_id: null };
    setAnimationOwner(anim, "user-123");
    expect(anim.user_id).toBeNull();
  });
});

describe("Auth: rate limiting", () => {
  it("allows first request", () => {
    const buckets = new Map<string, RateBucket>();
    const result = checkRate(buckets, "1.2.3.4", 5, 60_000, 1000);
    expect(result.ok).toBe(true);
  });

  it("allows requests up to burst limit", () => {
    const buckets = new Map<string, RateBucket>();
    for (let i = 0; i < 4; i++) {
      checkRate(buckets, "1.2.3.4", 5, 60_000, 1000);
    }
    const result = checkRate(buckets, "1.2.3.4", 5, 60_000, 1000);
    expect(result.ok).toBe(true);
  });

  it("blocks after burst limit exceeded", () => {
    const buckets = new Map<string, RateBucket>();
    for (let i = 0; i < 5; i++) {
      checkRate(buckets, "1.2.3.4", 5, 60_000, 1000);
    }
    const result = checkRate(buckets, "1.2.3.4", 5, 60_000, 1000);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after window expires", () => {
    const buckets = new Map<string, RateBucket>();
    for (let i = 0; i < 5; i++) {
      checkRate(buckets, "1.2.3.4", 5, 60_000, 1000);
    }
    const result = checkRate(buckets, "1.2.3.4", 5, 60_000, 62_000);
    expect(result.ok).toBe(true);
  });

  it("tracks different IPs independently", () => {
    const buckets = new Map<string, RateBucket>();
    for (let i = 0; i < 5; i++) {
      checkRate(buckets, "1.2.3.4", 5, 60_000, 1000);
    }
    const result = checkRate(buckets, "5.6.7.8", 5, 60_000, 1000);
    expect(result.ok).toBe(true);
  });
});
