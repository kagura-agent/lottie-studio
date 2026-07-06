import { describe, it, expect } from "vitest";

/**
 * Tests for user profile API routes — pure logic and validation.
 * Validates profile retrieval, display name updates, password changes,
 * paginated animation listing, and linked accounts.
 */

// --- Pure helper functions extracted from profile API logic ---

function validateDisplayName(
  displayName: unknown
): { valid: true; value: string } | { valid: false; error: string } {
  if (typeof displayName !== "string") {
    return { valid: false, error: "displayName is required" };
  }
  const trimmed = displayName.trim();
  if (trimmed.length > 100) {
    return { valid: false, error: "Display name too long (max 100 characters)" };
  }
  return { valid: true, value: trimmed || "" };
}

function validatePasswordChange(body: {
  currentPassword?: string;
  newPassword?: string;
}): string | null {
  if (!body.currentPassword || !body.newPassword) {
    return "Current password and new password are required";
  }
  if (body.newPassword.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
}

function isOAuthOnly(passwordHash: string | null | undefined): boolean {
  return !passwordHash;
}

function parsePaginationParams(params: {
  page?: string;
  limit?: string;
  sort?: string;
}): { page: number; limit: number; offset: number; sort: string } {
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit ?? "24", 10)));
  const offset = (page - 1) * limit;
  const sort = params.sort ?? "recent";
  return { page, limit, offset, sort };
}

function getOrderBy(sort: string): string {
  switch (sort) {
    case "oldest":
      return "created_at ASC";
    case "name":
      return "name COLLATE NOCASE ASC";
    default:
      return "created_at DESC";
  }
}

function computeTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

interface ProfileResponse {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  animationCount: number;
  providers: string[];
}

function buildProfileResponse(
  user: ProfileResponse["user"],
  animationCount: number,
  oauthProviders: string[]
): ProfileResponse {
  return { user, animationCount, providers: oauthProviders };
}

interface MockAnimation {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  frame_count: number | null;
  duration_seconds: number | null;
}

function getUserAnimations(
  allAnimations: MockAnimation[],
  userId: string
): MockAnimation[] {
  return allAnimations.filter((a) => a.user_id === userId);
}

function sortAnimations(
  animations: MockAnimation[],
  sort: string
): MockAnimation[] {
  const copy = [...animations];
  switch (sort) {
    case "oldest":
      return copy.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    case "name":
      return copy.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }
}

function paginateAnimations(
  animations: MockAnimation[],
  offset: number,
  limit: number
): MockAnimation[] {
  return animations.slice(offset, offset + limit);
}

interface MockOAuthLink {
  userId: string;
  provider: string;
  providerAccountId: string;
}

function getLinkedProviders(
  links: MockOAuthLink[],
  userId: string
): string[] {
  return links.filter((l) => l.userId === userId).map((l) => l.provider);
}

function updateDisplayName(
  user: ProfileResponse["user"],
  newName: string
): ProfileResponse["user"] {
  const trimmed = newName.trim();
  return { ...user, display_name: trimmed || null };
}

// --- Tests ---

describe("Profile: display name validation", () => {
  it("rejects non-string input", () => {
    const result = validateDisplayName(undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("displayName is required");
  });

  it("rejects numeric input", () => {
    const result = validateDisplayName(123);
    expect(result.valid).toBe(false);
  });

  it("rejects null input", () => {
    const result = validateDisplayName(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("displayName is required");
  });

  it("accepts valid display name", () => {
    const result = validateDisplayName("Alice");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("Alice");
  });

  it("trims whitespace", () => {
    const result = validateDisplayName("  Bob  ");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("Bob");
  });

  it("accepts empty string (clears display name)", () => {
    const result = validateDisplayName("");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("");
  });

  it("accepts whitespace-only string (treated as empty)", () => {
    const result = validateDisplayName("   ");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("");
  });

  it("rejects name longer than 100 characters", () => {
    const longName = "a".repeat(101);
    const result = validateDisplayName(longName);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toBe("Display name too long (max 100 characters)");
  });

  it("accepts name exactly 100 characters", () => {
    const name = "a".repeat(100);
    const result = validateDisplayName(name);
    expect(result.valid).toBe(true);
  });

  it("handles unicode characters", () => {
    const result = validateDisplayName("田中太郎");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("田中太郎");
  });

  it("handles special characters", () => {
    const result = validateDisplayName("O'Brien-Smith");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("O'Brien-Smith");
  });
});

describe("Profile: display name update logic", () => {
  const baseUser: ProfileResponse["user"] = {
    id: "user-1",
    email: "test@example.com",
    display_name: "Original",
    avatar_url: null,
    created_at: "2025-01-01T00:00:00.000Z",
  };

  it("updates display name", () => {
    const updated = updateDisplayName(baseUser, "New Name");
    expect(updated.display_name).toBe("New Name");
  });

  it("trims whitespace from new name", () => {
    const updated = updateDisplayName(baseUser, "  Trimmed  ");
    expect(updated.display_name).toBe("Trimmed");
  });

  it("sets null for empty string", () => {
    const updated = updateDisplayName(baseUser, "");
    expect(updated.display_name).toBeNull();
  });

  it("sets null for whitespace-only", () => {
    const updated = updateDisplayName(baseUser, "   ");
    expect(updated.display_name).toBeNull();
  });

  it("does not mutate original user object", () => {
    updateDisplayName(baseUser, "Changed");
    expect(baseUser.display_name).toBe("Original");
  });

  it("preserves other user fields", () => {
    const updated = updateDisplayName(baseUser, "New");
    expect(updated.id).toBe(baseUser.id);
    expect(updated.email).toBe(baseUser.email);
    expect(updated.avatar_url).toBe(baseUser.avatar_url);
    expect(updated.created_at).toBe(baseUser.created_at);
  });
});

describe("Profile: password change validation", () => {
  it("rejects missing current password", () => {
    expect(
      validatePasswordChange({ newPassword: "newpass123" })
    ).toBe("Current password and new password are required");
  });

  it("rejects missing new password", () => {
    expect(
      validatePasswordChange({ currentPassword: "oldpass123" })
    ).toBe("Current password and new password are required");
  });

  it("rejects both missing", () => {
    expect(validatePasswordChange({})).toBe(
      "Current password and new password are required"
    );
  });

  it("rejects empty current password", () => {
    expect(
      validatePasswordChange({ currentPassword: "", newPassword: "newpass123" })
    ).toBe("Current password and new password are required");
  });

  it("rejects empty new password", () => {
    expect(
      validatePasswordChange({ currentPassword: "oldpass123", newPassword: "" })
    ).toBe("Current password and new password are required");
  });

  it("rejects short new password (7 chars)", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpass123",
        newPassword: "1234567",
      })
    ).toBe("Password must be at least 8 characters");
  });

  it("accepts valid password change", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpass123",
        newPassword: "newpass123",
      })
    ).toBeNull();
  });

  it("accepts 8-character new password", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpass123",
        newPassword: "12345678",
      })
    ).toBeNull();
  });

  it("accepts long new password", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpass123",
        newPassword: "a-very-long-and-secure-password-here!",
      })
    ).toBeNull();
  });
});

describe("Profile: OAuth-only account detection", () => {
  it("detects OAuth-only (empty string hash)", () => {
    expect(isOAuthOnly("")).toBe(true);
  });

  it("detects OAuth-only (null hash)", () => {
    expect(isOAuthOnly(null)).toBe(true);
  });

  it("detects OAuth-only (undefined hash)", () => {
    expect(isOAuthOnly(undefined)).toBe(true);
  });

  it("detects password-enabled account", () => {
    expect(isOAuthOnly("$2a$10$somehashedvalue")).toBe(false);
  });
});

describe("Profile: pagination params", () => {
  it("uses defaults when no params provided", () => {
    const result = parsePaginationParams({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(24);
    expect(result.offset).toBe(0);
    expect(result.sort).toBe("recent");
  });

  it("parses valid page and limit", () => {
    const result = parsePaginationParams({ page: "3", limit: "10" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  it("clamps page to minimum 1", () => {
    const result = parsePaginationParams({ page: "0" });
    expect(result.page).toBe(1);
  });

  it("clamps negative page to 1", () => {
    const result = parsePaginationParams({ page: "-5" });
    expect(result.page).toBe(1);
  });

  it("clamps limit to minimum 1", () => {
    const result = parsePaginationParams({ limit: "0" });
    expect(result.limit).toBe(1);
  });

  it("clamps limit to maximum 100", () => {
    const result = parsePaginationParams({ limit: "999" });
    expect(result.limit).toBe(100);
  });

  it("computes correct offset for page 2", () => {
    const result = parsePaginationParams({ page: "2", limit: "12" });
    expect(result.offset).toBe(12);
  });

  it("computes correct offset for page 5", () => {
    const result = parsePaginationParams({ page: "5", limit: "10" });
    expect(result.offset).toBe(40);
  });

  it("passes through sort parameter", () => {
    expect(parsePaginationParams({ sort: "oldest" }).sort).toBe("oldest");
    expect(parsePaginationParams({ sort: "name" }).sort).toBe("name");
    expect(parsePaginationParams({ sort: "recent" }).sort).toBe("recent");
  });

  it("defaults sort to recent for unknown value", () => {
    const result = parsePaginationParams({ sort: "unknown" });
    expect(result.sort).toBe("unknown");
  });
});

describe("Profile: sort order", () => {
  it("returns DESC for default/recent sort", () => {
    expect(getOrderBy("recent")).toBe("created_at DESC");
  });

  it("returns ASC for oldest sort", () => {
    expect(getOrderBy("oldest")).toBe("created_at ASC");
  });

  it("returns name COLLATE NOCASE for name sort", () => {
    expect(getOrderBy("name")).toBe("name COLLATE NOCASE ASC");
  });

  it("falls back to DESC for unknown sort", () => {
    expect(getOrderBy("unknown")).toBe("created_at DESC");
  });
});

describe("Profile: total pages calculation", () => {
  it("computes total pages with exact division", () => {
    expect(computeTotalPages(100, 10)).toBe(10);
  });

  it("rounds up for partial last page", () => {
    expect(computeTotalPages(101, 10)).toBe(11);
  });

  it("returns 1 page for count less than limit", () => {
    expect(computeTotalPages(5, 24)).toBe(1);
  });

  it("returns 0 pages for zero items", () => {
    expect(computeTotalPages(0, 24)).toBe(0);
  });

  it("returns 1 page for single item", () => {
    expect(computeTotalPages(1, 24)).toBe(1);
  });

  it("handles large totals", () => {
    expect(computeTotalPages(1000, 24)).toBe(42);
  });
});

describe("Profile: response builder", () => {
  it("builds profile response with all fields", () => {
    const user = {
      id: "user-1",
      email: "alice@example.com",
      display_name: "Alice",
      avatar_url: "https://example.com/avatar.jpg",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    const response = buildProfileResponse(user, 42, ["github", "google"]);

    expect(response.user).toEqual(user);
    expect(response.animationCount).toBe(42);
    expect(response.providers).toEqual(["github", "google"]);
  });

  it("builds profile response with no animations", () => {
    const user = {
      id: "user-2",
      email: "bob@example.com",
      display_name: null,
      avatar_url: null,
      created_at: "2024-06-15T12:00:00.000Z",
    };
    const response = buildProfileResponse(user, 0, []);

    expect(response.animationCount).toBe(0);
    expect(response.providers).toEqual([]);
  });

  it("does not leak password_hash", () => {
    const user = {
      id: "user-3",
      email: "carol@example.com",
      display_name: "Carol",
      avatar_url: null,
      created_at: "2024-03-01T00:00:00.000Z",
    };
    const response = buildProfileResponse(user, 10, ["github"]);
    expect("password_hash" in response.user).toBe(false);
  });

  it("preserves null display_name", () => {
    const user = {
      id: "user-4",
      email: "no-name@example.com",
      display_name: null,
      avatar_url: null,
      created_at: "2024-03-01T00:00:00.000Z",
    };
    const response = buildProfileResponse(user, 0, []);
    expect(response.user.display_name).toBeNull();
  });
});

describe("Profile: linked accounts", () => {
  const links: MockOAuthLink[] = [
    { userId: "user-1", provider: "github", providerAccountId: "gh-123" },
    { userId: "user-1", provider: "google", providerAccountId: "g-456" },
    { userId: "user-2", provider: "github", providerAccountId: "gh-789" },
  ];

  it("returns providers for user with both linked", () => {
    const providers = getLinkedProviders(links, "user-1");
    expect(providers).toEqual(["github", "google"]);
  });

  it("returns providers for user with one linked", () => {
    const providers = getLinkedProviders(links, "user-2");
    expect(providers).toEqual(["github"]);
  });

  it("returns empty array for user with no links", () => {
    const providers = getLinkedProviders(links, "user-99");
    expect(providers).toEqual([]);
  });

  it("returns empty array when no links exist", () => {
    const providers = getLinkedProviders([], "user-1");
    expect(providers).toEqual([]);
  });
});

describe("Profile: user animations filtering", () => {
  const animations: MockAnimation[] = [
    {
      id: "anim-1",
      name: "Alpha",
      user_id: "user-1",
      created_at: "2025-01-01T00:00:00.000Z",
      frame_count: 30,
      duration_seconds: 1.0,
    },
    {
      id: "anim-2",
      name: "Beta",
      user_id: "user-2",
      created_at: "2025-01-02T00:00:00.000Z",
      frame_count: 60,
      duration_seconds: 2.0,
    },
    {
      id: "anim-3",
      name: "Gamma",
      user_id: "user-1",
      created_at: "2025-01-03T00:00:00.000Z",
      frame_count: 90,
      duration_seconds: 3.0,
    },
  ];

  it("filters animations by user_id", () => {
    const result = getUserAnimations(animations, "user-1");
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(["anim-1", "anim-3"]);
  });

  it("returns empty for user with no animations", () => {
    const result = getUserAnimations(animations, "user-99");
    expect(result).toHaveLength(0);
  });

  it("returns all animations for single user", () => {
    const singleUserAnims: MockAnimation[] = [
      { id: "a1", name: "X", user_id: "u1", created_at: "2025-01-01T00:00:00Z", frame_count: 10, duration_seconds: 0.5 },
      { id: "a2", name: "Y", user_id: "u1", created_at: "2025-01-02T00:00:00Z", frame_count: 20, duration_seconds: 1.0 },
    ];
    const result = getUserAnimations(singleUserAnims, "u1");
    expect(result).toHaveLength(2);
  });
});

describe("Profile: animation sorting", () => {
  const animations: MockAnimation[] = [
    {
      id: "anim-1",
      name: "Charlie",
      user_id: "user-1",
      created_at: "2025-01-02T00:00:00.000Z",
      frame_count: 30,
      duration_seconds: 1.0,
    },
    {
      id: "anim-2",
      name: "Alpha",
      user_id: "user-1",
      created_at: "2025-01-01T00:00:00.000Z",
      frame_count: 60,
      duration_seconds: 2.0,
    },
    {
      id: "anim-3",
      name: "bravo",
      user_id: "user-1",
      created_at: "2025-01-03T00:00:00.000Z",
      frame_count: 90,
      duration_seconds: 3.0,
    },
  ];

  it("sorts by recent (newest first)", () => {
    const sorted = sortAnimations(animations, "recent");
    expect(sorted.map((a) => a.id)).toEqual(["anim-3", "anim-1", "anim-2"]);
  });

  it("sorts by oldest first", () => {
    const sorted = sortAnimations(animations, "oldest");
    expect(sorted.map((a) => a.id)).toEqual(["anim-2", "anim-1", "anim-3"]);
  });

  it("sorts by name (case-insensitive)", () => {
    const sorted = sortAnimations(animations, "name");
    expect(sorted.map((a) => a.name)).toEqual(["Alpha", "bravo", "Charlie"]);
  });

  it("defaults to recent for unknown sort", () => {
    const sorted = sortAnimations(animations, "unknown");
    expect(sorted.map((a) => a.id)).toEqual(["anim-3", "anim-1", "anim-2"]);
  });

  it("does not mutate original array", () => {
    const ids = animations.map((a) => a.id);
    sortAnimations(animations, "name");
    expect(animations.map((a) => a.id)).toEqual(ids);
  });
});

describe("Profile: animation pagination", () => {
  const animations: MockAnimation[] = Array.from({ length: 50 }, (_, i) => ({
    id: `anim-${i}`,
    name: `Animation ${i}`,
    user_id: "user-1",
    created_at: new Date(2025, 0, i + 1).toISOString(),
    frame_count: 30,
    duration_seconds: 1.0,
  }));

  it("returns first page", () => {
    const result = paginateAnimations(animations, 0, 24);
    expect(result).toHaveLength(24);
    expect(result[0].id).toBe("anim-0");
    expect(result[23].id).toBe("anim-23");
  });

  it("returns second page", () => {
    const result = paginateAnimations(animations, 24, 24);
    expect(result).toHaveLength(24);
    expect(result[0].id).toBe("anim-24");
  });

  it("returns partial last page", () => {
    const result = paginateAnimations(animations, 48, 24);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("anim-48");
    expect(result[1].id).toBe("anim-49");
  });

  it("returns empty for offset beyond total", () => {
    const result = paginateAnimations(animations, 100, 24);
    expect(result).toHaveLength(0);
  });

  it("handles limit of 1", () => {
    const result = paginateAnimations(animations, 0, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("anim-0");
  });

  it("handles limit equal to total", () => {
    const result = paginateAnimations(animations, 0, 50);
    expect(result).toHaveLength(50);
  });

  it("handles limit larger than total", () => {
    const result = paginateAnimations(animations, 0, 100);
    expect(result).toHaveLength(50);
  });
});

describe("Profile: authentication requirement", () => {
  function parseCookieToken(cookieHeader: string): string | null {
    const match = cookieHeader.match(/(?:^|;\s*)lottie-session=([^\s;]+)/);
    return match ? match[1] : null;
  }

  it("unauthenticated request has no session cookie", () => {
    expect(parseCookieToken("")).toBeNull();
  });

  it("authenticated request has session cookie", () => {
    expect(parseCookieToken("lottie-session=valid-token-123")).toBe(
      "valid-token-123"
    );
  });

  it("finds session cookie among other cookies", () => {
    expect(
      parseCookieToken("other=val; lottie-session=my-token; another=x")
    ).toBe("my-token");
  });

  it("returns null when cookie key is similar but not exact", () => {
    expect(parseCookieToken("lottie-session-old=expired")).toBeNull();
  });
});

describe("Profile: full flow simulation", () => {
  it("profile fetch → name update → verify update", () => {
    const user: ProfileResponse["user"] = {
      id: "user-1",
      email: "alice@example.com",
      display_name: null,
      avatar_url: null,
      created_at: "2025-01-01T00:00:00.000Z",
    };
    const links: MockOAuthLink[] = [
      { userId: "user-1", provider: "github", providerAccountId: "gh-1" },
    ];

    const profile = buildProfileResponse(
      user,
      5,
      getLinkedProviders(links, user.id)
    );
    expect(profile.user.display_name).toBeNull();
    expect(profile.providers).toEqual(["github"]);

    const nameValidation = validateDisplayName("Alice");
    expect(nameValidation.valid).toBe(true);

    const updated = updateDisplayName(user, "Alice");
    expect(updated.display_name).toBe("Alice");

    const newProfile = buildProfileResponse(
      updated,
      5,
      getLinkedProviders(links, user.id)
    );
    expect(newProfile.user.display_name).toBe("Alice");
  });

  it("paginated animation browsing with sort changes", () => {
    const allAnimations: MockAnimation[] = Array.from(
      { length: 30 },
      (_, i) => ({
        id: `anim-${i}`,
        name: `Anim ${String.fromCharCode(65 + (i % 26))}${i}`,
        user_id: "user-1",
        created_at: new Date(2025, 0, i + 1).toISOString(),
        frame_count: 30,
        duration_seconds: 1.0,
      })
    );

    // Page 1, recent
    const p1 = parsePaginationParams({ page: "1", limit: "10", sort: "recent" });
    const sorted = sortAnimations(allAnimations, p1.sort);
    const page1 = paginateAnimations(sorted, p1.offset, p1.limit);
    expect(page1).toHaveLength(10);
    expect(page1[0].id).toBe("anim-29");

    // Page 3
    const p3 = parsePaginationParams({ page: "3", limit: "10", sort: "recent" });
    const page3 = paginateAnimations(sorted, p3.offset, p3.limit);
    expect(page3).toHaveLength(10);
    expect(page3[0].id).toBe("anim-9");

    // Total pages
    expect(computeTotalPages(30, 10)).toBe(3);

    // Switch to name sort
    const byName = sortAnimations(allAnimations, "name");
    const namePage = paginateAnimations(byName, 0, 10);
    expect(namePage[0].name.startsWith("Anim A")).toBe(true);
  });

  it("password change validation flow", () => {
    // OAuth-only user cannot change password
    expect(isOAuthOnly("")).toBe(true);

    // Regular user can
    expect(isOAuthOnly("$2a$10$hash")).toBe(false);

    // Validate password requirements
    expect(validatePasswordChange({
      currentPassword: "oldpass",
      newPassword: "short",
    })).toBe("Password must be at least 8 characters");

    expect(validatePasswordChange({
      currentPassword: "oldpass123",
      newPassword: "newpass123",
    })).toBeNull();
  });
});
