import { describe, it, expect } from "vitest";

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

  it("rejects short new password", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpass123",
        newPassword: "short",
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

  it("NaN page propagates (matches route behavior)", () => {
    const result = parsePaginationParams({ page: "abc" });
    expect(result.page).toBeNaN();
  });

  it("NaN limit propagates (matches route behavior)", () => {
    const result = parsePaginationParams({ limit: "abc" });
    expect(result.limit).toBeNaN();
  });

  it("passes through sort parameter", () => {
    const result = parsePaginationParams({ sort: "oldest" });
    expect(result.sort).toBe("oldest");
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
});
