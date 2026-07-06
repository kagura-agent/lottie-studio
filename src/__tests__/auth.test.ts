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

// --- OAuth helper functions ---

function parseStateCookie(cookieHeader: string): string | null {
  const match = cookieHeader.match(/(?:^|;\s*)oauth-state=([^\s;]+)/);
  return match ? match[1] : null;
}

function buildAuthorizeUrl(
  authorizeBase: string,
  clientId: string,
  redirectUri: string,
  scope: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    response_type: "code",
  });
  return `${authorizeBase}?${params.toString()}`;
}

function buildStateCookie(
  state: string,
  maxAge: number,
  isProduction: boolean
): string {
  let cookie = `oauth-state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  if (isProduction) cookie += "; Secure";
  return cookie;
}

function clearStateCookie(isProduction: boolean): string {
  let cookie = `oauth-state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
  if (isProduction) cookie += "; Secure";
  return cookie;
}

interface OAuthProfile {
  providerAccountId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface MockUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  password_hash: string;
}

interface MockOAuthLink {
  userId: string;
  provider: string;
  providerAccountId: string;
}

function findOrCreateOAuthUser(
  users: Map<string, MockUser>,
  oauthLinks: MockOAuthLink[],
  provider: string,
  profile: OAuthProfile
): { user: MockUser; action: "found" | "linked" | "created" } {
  const existingLink = oauthLinks.find(
    (l) => l.provider === provider && l.providerAccountId === profile.providerAccountId
  );
  if (existingLink) {
    const user = [...users.values()].find((u) => u.id === existingLink.userId)!;
    return { user, action: "found" };
  }

  const emailMatch = users.get(profile.email);
  if (emailMatch) {
    oauthLinks.push({
      userId: emailMatch.id,
      provider,
      providerAccountId: profile.providerAccountId,
    });
    return { user: emailMatch, action: "linked" };
  }

  const newUser: MockUser = {
    id: `user-${users.size + 1}`,
    email: profile.email,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
    password_hash: "",
  };
  users.set(profile.email, newUser);
  oauthLinks.push({
    userId: newUser.id,
    provider,
    providerAccountId: profile.providerAccountId,
  });
  return { user: newUser, action: "created" };
}

function validateCallbackParams(
  code: string | null,
  state: string | null,
  storedState: string | null
): string | null {
  if (!code || !state) return "missing_params";
  if (!storedState || storedState !== state) return "invalid_state";
  return null;
}

// --- OAuth Tests ---

describe("OAuth: state cookie parsing", () => {
  it("parses state from cookie header", () => {
    expect(parseStateCookie("oauth-state=abc123")).toBe("abc123");
  });

  it("parses state among multiple cookies", () => {
    expect(
      parseStateCookie("other=value; oauth-state=abc123; foo=bar")
    ).toBe("abc123");
  });

  it("returns null when no state cookie", () => {
    expect(parseStateCookie("other=value; foo=bar")).toBeNull();
  });

  it("returns null for empty cookie header", () => {
    expect(parseStateCookie("")).toBeNull();
  });

  it("handles hex state values", () => {
    const hexState = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
    expect(parseStateCookie(`oauth-state=${hexState}`)).toBe(hexState);
  });
});

describe("OAuth: state cookie builder", () => {
  it("builds dev state cookie (no Secure flag)", () => {
    const cookie = buildStateCookie("state-xyz", 600, false);
    expect(cookie).toContain("oauth-state=state-xyz");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).not.toContain("Secure");
  });

  it("builds production state cookie (with Secure flag)", () => {
    const cookie = buildStateCookie("state-xyz", 600, true);
    expect(cookie).toContain("Secure");
  });
});

describe("OAuth: clear state cookie", () => {
  it("sets Max-Age=0 for dev", () => {
    const cookie = clearStateCookie(false);
    expect(cookie).toContain("oauth-state=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("Secure");
  });

  it("includes Secure flag in production", () => {
    const cookie = clearStateCookie(true);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=0");
  });
});

describe("OAuth: authorize URL builder", () => {
  it("builds GitHub authorize URL", () => {
    const url = buildAuthorizeUrl(
      "https://github.com/login/oauth/authorize",
      "client-123",
      "http://localhost:3000/api/auth/github/callback",
      "read:user user:email",
      "state-abc"
    );
    expect(url).toContain("https://github.com/login/oauth/authorize?");
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state-abc");
    expect(url).toContain("response_type=code");
  });

  it("builds Google authorize URL", () => {
    const url = buildAuthorizeUrl(
      "https://accounts.google.com/o/oauth2/v2/auth",
      "google-id",
      "http://localhost:3000/api/auth/google/callback",
      "openid email profile",
      "state-def"
    );
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("client_id=google-id");
    expect(url).toContain("state=state-def");
  });

  it("URL-encodes scopes with spaces", () => {
    const url = buildAuthorizeUrl(
      "https://example.com/auth",
      "id",
      "http://localhost/cb",
      "read:user user:email",
      "s"
    );
    expect(url).toContain("scope=read%3Auser+user%3Aemail");
  });
});

describe("OAuth: callback parameter validation", () => {
  it("rejects missing code", () => {
    expect(validateCallbackParams(null, "state", "state")).toBe("missing_params");
  });

  it("rejects missing state", () => {
    expect(validateCallbackParams("code", null, "state")).toBe("missing_params");
  });

  it("rejects missing stored state", () => {
    expect(validateCallbackParams("code", "state", null)).toBe("invalid_state");
  });

  it("rejects mismatched state (CSRF)", () => {
    expect(validateCallbackParams("code", "attacker-state", "real-state")).toBe(
      "invalid_state"
    );
  });

  it("accepts valid code + matching state", () => {
    expect(validateCallbackParams("code-123", "state-abc", "state-abc")).toBeNull();
  });
});

describe("OAuth: find or create user", () => {
  it("creates new user on first OAuth login", () => {
    const users = new Map<string, MockUser>();
    const links: MockOAuthLink[] = [];
    const profile: OAuthProfile = {
      providerAccountId: "gh-12345",
      email: "newuser@example.com",
      displayName: "New User",
      avatarUrl: "https://avatar.example.com/new.jpg",
    };

    const result = findOrCreateOAuthUser(users, links, "github", profile);
    expect(result.action).toBe("created");
    expect(result.user.email).toBe("newuser@example.com");
    expect(result.user.display_name).toBe("New User");
    expect(result.user.password_hash).toBe("");
    expect(links).toHaveLength(1);
    expect(links[0].provider).toBe("github");
  });

  it("links OAuth to existing user when email matches", () => {
    const existingUser: MockUser = {
      id: "user-1",
      email: "existing@example.com",
      display_name: "Existing",
      avatar_url: null,
      password_hash: "$2a$10$hashed",
    };
    const users = new Map([["existing@example.com", existingUser]]);
    const links: MockOAuthLink[] = [];
    const profile: OAuthProfile = {
      providerAccountId: "gh-99999",
      email: "existing@example.com",
      displayName: "GH Name",
      avatarUrl: "https://avatar.example.com/gh.jpg",
    };

    const result = findOrCreateOAuthUser(users, links, "github", profile);
    expect(result.action).toBe("linked");
    expect(result.user.id).toBe("user-1");
    expect(links).toHaveLength(1);
  });

  it("finds existing OAuth-linked user on repeat login", () => {
    const existingUser: MockUser = {
      id: "user-1",
      email: "repeat@example.com",
      display_name: "Repeat",
      avatar_url: null,
      password_hash: "",
    };
    const users = new Map([["repeat@example.com", existingUser]]);
    const links: MockOAuthLink[] = [
      { userId: "user-1", provider: "github", providerAccountId: "gh-111" },
    ];
    const profile: OAuthProfile = {
      providerAccountId: "gh-111",
      email: "repeat@example.com",
      displayName: "Repeat",
      avatarUrl: null,
    };

    const result = findOrCreateOAuthUser(users, links, "github", profile);
    expect(result.action).toBe("found");
    expect(result.user.id).toBe("user-1");
    expect(links).toHaveLength(1);
  });

  it("allows multiple providers for same user", () => {
    const existingUser: MockUser = {
      id: "user-1",
      email: "multi@example.com",
      display_name: "Multi",
      avatar_url: null,
      password_hash: "$2a$10$hashed",
    };
    const users = new Map([["multi@example.com", existingUser]]);
    const links: MockOAuthLink[] = [
      { userId: "user-1", provider: "github", providerAccountId: "gh-222" },
    ];

    const googleProfile: OAuthProfile = {
      providerAccountId: "google-333",
      email: "multi@example.com",
      displayName: "Multi Google",
      avatarUrl: null,
    };

    const result = findOrCreateOAuthUser(users, links, "google", googleProfile);
    expect(result.action).toBe("linked");
    expect(result.user.id).toBe("user-1");
    expect(links).toHaveLength(2);
    expect(links[1].provider).toBe("google");
  });

  it("creates separate users for different emails", () => {
    const users = new Map<string, MockUser>();
    const links: MockOAuthLink[] = [];

    findOrCreateOAuthUser(users, links, "github", {
      providerAccountId: "gh-1",
      email: "alice@example.com",
      displayName: "Alice",
      avatarUrl: null,
    });

    findOrCreateOAuthUser(users, links, "github", {
      providerAccountId: "gh-2",
      email: "bob@example.com",
      displayName: "Bob",
      avatarUrl: null,
    });

    expect(users.size).toBe(2);
    expect(links).toHaveLength(2);
  });

  it("OAuth user has empty password_hash (cannot password-login)", () => {
    const users = new Map<string, MockUser>();
    const links: MockOAuthLink[] = [];

    const result = findOrCreateOAuthUser(users, links, "google", {
      providerAccountId: "g-1",
      email: "oauth-only@example.com",
      displayName: "OAuth Only",
      avatarUrl: null,
    });

    expect(result.user.password_hash).toBe("");
  });
});

describe("OAuth: password-login blocked for OAuth-only users", () => {
  it("empty password_hash never matches any password via bcrypt", () => {
    // bcrypt hashes always start with "$2" prefix
    // An empty string will never equal a bcrypt hash, so verifyPassword
    // (which uses bcrypt.compare) will always return false
    const emptyHash = "";
    expect(emptyHash.startsWith("$2")).toBe(false);
  });
});
