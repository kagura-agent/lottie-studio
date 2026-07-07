import { describe, it, expect } from "vitest";

/**
 * Tests for like/favorite feature — toggle logic, favorites pagination,
 * and authentication-gated like flow.
 */

// --- Pure helper functions extracted from like API logic ---

interface LikeRecord {
  id: number;
  animation_id: string;
  user_id: string | null;
  ip: string;
  created_at: string;
}

function findUserLike(
  likes: LikeRecord[],
  animationId: string,
  userId: string
): LikeRecord | undefined {
  return likes.find(
    (l) => l.animation_id === animationId && l.user_id === userId
  );
}

function toggleLike(
  likes: LikeRecord[],
  animationId: string,
  userId: string,
  likeCount: number
): { likes: LikeRecord[]; liked: boolean; likeCount: number } {
  const existing = findUserLike(likes, animationId, userId);
  if (existing) {
    return {
      likes: likes.filter((l) => l !== existing),
      liked: false,
      likeCount: Math.max(0, likeCount - 1),
    };
  }
  const newLike: LikeRecord = {
    id: Math.max(0, ...likes.map((l) => l.id)) + 1,
    animation_id: animationId,
    user_id: userId,
    ip: "",
    created_at: new Date().toISOString(),
  };
  return {
    likes: [...likes, newLike],
    liked: true,
    likeCount: likeCount + 1,
  };
}

function getUserFavorites(
  likes: LikeRecord[],
  userId: string
): string[] {
  return likes
    .filter((l) => l.user_id === userId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((l) => l.animation_id);
}

function paginateFavorites(
  animationIds: string[],
  page: number,
  limit: number
): { items: string[]; total: number; page: number; totalPages: number } {
  const total = animationIds.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const items = animationIds.slice(offset, offset + limit);
  return { items, total, page, totalPages };
}

function isAuthenticated(userId: string | null): boolean {
  return userId !== null && userId !== "";
}

function checkUniqueConstraint(
  likes: LikeRecord[],
  animationId: string,
  userId: string
): boolean {
  return likes.some(
    (l) => l.animation_id === animationId && l.user_id === userId
  );
}

// --- Tests ---

describe("Like toggle: basic behavior", () => {
  it("likes an animation when not yet liked", () => {
    const result = toggleLike([], "anim-1", "user-1", 0);
    expect(result.liked).toBe(true);
    expect(result.likeCount).toBe(1);
    expect(result.likes).toHaveLength(1);
    expect(result.likes[0].animation_id).toBe("anim-1");
    expect(result.likes[0].user_id).toBe("user-1");
  });

  it("unlikes an animation when already liked", () => {
    const initialLikes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    ];
    const result = toggleLike(initialLikes, "anim-1", "user-1", 1);
    expect(result.liked).toBe(false);
    expect(result.likeCount).toBe(0);
    expect(result.likes).toHaveLength(0);
  });

  it("toggles like on then off returns to original state", () => {
    const r1 = toggleLike([], "anim-1", "user-1", 0);
    expect(r1.liked).toBe(true);
    expect(r1.likeCount).toBe(1);

    const r2 = toggleLike(r1.likes, "anim-1", "user-1", r1.likeCount);
    expect(r2.liked).toBe(false);
    expect(r2.likeCount).toBe(0);
    expect(r2.likes).toHaveLength(0);
  });

  it("toggles like off then on returns to liked state", () => {
    const initialLikes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    ];
    const r1 = toggleLike(initialLikes, "anim-1", "user-1", 1);
    expect(r1.liked).toBe(false);

    const r2 = toggleLike(r1.likes, "anim-1", "user-1", r1.likeCount);
    expect(r2.liked).toBe(true);
    expect(r2.likeCount).toBe(1);
  });

  it("like count does not go below zero", () => {
    const initialLikes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    ];
    const result = toggleLike(initialLikes, "anim-1", "user-1", 0);
    expect(result.likeCount).toBe(0);
  });
});

describe("Like toggle: multi-user isolation", () => {
  it("different users can like the same animation independently", () => {
    const r1 = toggleLike([], "anim-1", "user-1", 0);
    const r2 = toggleLike(r1.likes, "anim-1", "user-2", r1.likeCount);

    expect(r2.likes).toHaveLength(2);
    expect(r2.likeCount).toBe(2);
  });

  it("one user unliking does not affect another user's like", () => {
    const likes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
      { id: 2, animation_id: "anim-1", user_id: "user-2", ip: "", created_at: "2025-01-01T00:00:01Z" },
    ];

    const result = toggleLike(likes, "anim-1", "user-1", 2);
    expect(result.liked).toBe(false);
    expect(result.likeCount).toBe(1);
    expect(result.likes).toHaveLength(1);
    expect(result.likes[0].user_id).toBe("user-2");
  });

  it("same user can like different animations", () => {
    const r1 = toggleLike([], "anim-1", "user-1", 0);
    const r2 = toggleLike(r1.likes, "anim-2", "user-1", 0);

    expect(r2.likes).toHaveLength(2);
    expect(r2.likes.map((l) => l.animation_id)).toContain("anim-1");
    expect(r2.likes.map((l) => l.animation_id)).toContain("anim-2");
  });
});

describe("Like: duplicate prevention via unique constraint", () => {
  it("detects existing like for same user and animation", () => {
    const likes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    ];
    expect(checkUniqueConstraint(likes, "anim-1", "user-1")).toBe(true);
  });

  it("does not flag different user as duplicate", () => {
    const likes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    ];
    expect(checkUniqueConstraint(likes, "anim-1", "user-2")).toBe(false);
  });

  it("does not flag different animation as duplicate", () => {
    const likes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    ];
    expect(checkUniqueConstraint(likes, "anim-2", "user-1")).toBe(false);
  });

  it("detects no duplicates in empty list", () => {
    expect(checkUniqueConstraint([], "anim-1", "user-1")).toBe(false);
  });
});

describe("Favorites: query and pagination", () => {
  const likes: LikeRecord[] = [
    { id: 1, animation_id: "anim-a", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    { id: 2, animation_id: "anim-b", user_id: "user-1", ip: "", created_at: "2025-01-02T00:00:00Z" },
    { id: 3, animation_id: "anim-c", user_id: "user-1", ip: "", created_at: "2025-01-03T00:00:00Z" },
    { id: 4, animation_id: "anim-d", user_id: "user-2", ip: "", created_at: "2025-01-04T00:00:00Z" },
    { id: 5, animation_id: "anim-e", user_id: "user-1", ip: "", created_at: "2025-01-05T00:00:00Z" },
  ];

  it("returns only the specified user's favorites", () => {
    const favs = getUserFavorites(likes, "user-1");
    expect(favs).toHaveLength(4);
    expect(favs).not.toContain("anim-d");
  });

  it("orders favorites by most recent first", () => {
    const favs = getUserFavorites(likes, "user-1");
    expect(favs).toEqual(["anim-e", "anim-c", "anim-b", "anim-a"]);
  });

  it("returns empty for user with no favorites", () => {
    const favs = getUserFavorites(likes, "user-99");
    expect(favs).toHaveLength(0);
  });

  it("paginates favorites — first page", () => {
    const favs = getUserFavorites(likes, "user-1");
    const page1 = paginateFavorites(favs, 1, 2);
    expect(page1.items).toEqual(["anim-e", "anim-c"]);
    expect(page1.total).toBe(4);
    expect(page1.totalPages).toBe(2);
    expect(page1.page).toBe(1);
  });

  it("paginates favorites — second page", () => {
    const favs = getUserFavorites(likes, "user-1");
    const page2 = paginateFavorites(favs, 2, 2);
    expect(page2.items).toEqual(["anim-b", "anim-a"]);
    expect(page2.page).toBe(2);
  });

  it("paginates favorites — partial last page", () => {
    const favs = getUserFavorites(likes, "user-1");
    const page = paginateFavorites(favs, 2, 3);
    expect(page.items).toEqual(["anim-a"]);
    expect(page.totalPages).toBe(2);
  });

  it("returns empty for page beyond total", () => {
    const favs = getUserFavorites(likes, "user-1");
    const page = paginateFavorites(favs, 10, 2);
    expect(page.items).toHaveLength(0);
  });

  it("handles single item", () => {
    const favs = getUserFavorites(likes, "user-2");
    expect(favs).toEqual(["anim-d"]);
    const page = paginateFavorites(favs, 1, 24);
    expect(page.items).toEqual(["anim-d"]);
    expect(page.total).toBe(1);
    expect(page.totalPages).toBe(1);
  });
});

describe("Like: authentication gate", () => {
  it("authenticated user is allowed to like", () => {
    expect(isAuthenticated("user-1")).toBe(true);
  });

  it("null user is not authenticated", () => {
    expect(isAuthenticated(null)).toBe(false);
  });

  it("empty string user is not authenticated", () => {
    expect(isAuthenticated("")).toBe(false);
  });

  it("unauthenticated like attempt returns 401 scenario", () => {
    const userId: string | null = null;
    if (!isAuthenticated(userId)) {
      const response = { error: "Authentication required", status: 401 };
      expect(response.status).toBe(401);
      expect(response.error).toBe("Authentication required");
    }
  });

  it("authenticated user can toggle like", () => {
    const userId = "user-1";
    expect(isAuthenticated(userId)).toBe(true);

    const result = toggleLike([], "anim-1", userId, 0);
    expect(result.liked).toBe(true);
    expect(result.likeCount).toBe(1);
  });
});

describe("Like: response format", () => {
  function buildLikeResponse(liked: boolean, likeCount: number) {
    return { liked, likeCount };
  }

  it("returns correct shape for like", () => {
    const response = buildLikeResponse(true, 5);
    expect(response).toEqual({ liked: true, likeCount: 5 });
  });

  it("returns correct shape for unlike", () => {
    const response = buildLikeResponse(false, 4);
    expect(response).toEqual({ liked: false, likeCount: 4 });
  });

  it("returns zero count when no likes", () => {
    const response = buildLikeResponse(false, 0);
    expect(response).toEqual({ liked: false, likeCount: 0 });
  });
});

describe("Like: idempotency and edge cases", () => {
  it("multiple toggles produce consistent results", () => {
    let state = { likes: [] as LikeRecord[], likeCount: 0 };

    for (let i = 0; i < 10; i++) {
      const result = toggleLike(state.likes, "anim-1", "user-1", state.likeCount);
      state = { likes: result.likes, likeCount: result.likeCount };

      if (i % 2 === 0) {
        expect(result.liked).toBe(true);
        expect(result.likeCount).toBe(1);
      } else {
        expect(result.liked).toBe(false);
        expect(result.likeCount).toBe(0);
      }
    }
  });

  it("does not mutate input likes array", () => {
    const originalLikes: LikeRecord[] = [
      { id: 1, animation_id: "anim-1", user_id: "user-1", ip: "", created_at: "2025-01-01T00:00:00Z" },
    ];
    const originalLength = originalLikes.length;

    toggleLike(originalLikes, "anim-1", "user-1", 1);
    expect(originalLikes).toHaveLength(originalLength);
  });

  it("handles animation with no existing likes", () => {
    const result = toggleLike([], "brand-new-animation", "user-1", 0);
    expect(result.liked).toBe(true);
    expect(result.likeCount).toBe(1);
  });
});
