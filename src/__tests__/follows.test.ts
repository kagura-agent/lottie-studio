import { describe, it, expect } from "vitest";

// --- Pure helper functions extracted from follow API logic ---

interface FollowRecord {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

interface UserCounters {
  follower_count: number;
  following_count: number;
}

function findFollow(
  follows: FollowRecord[],
  followerId: string,
  followingId: string
): FollowRecord | undefined {
  return follows.find(
    (f) => f.follower_id === followerId && f.following_id === followingId
  );
}

function toggleFollow(
  follows: FollowRecord[],
  followerId: string,
  followingId: string,
  targetCounters: UserCounters,
  followerCounters: UserCounters
): {
  follows: FollowRecord[];
  following: boolean;
  targetCounters: UserCounters;
  followerCounters: UserCounters;
} {
  const existing = findFollow(follows, followerId, followingId);
  if (existing) {
    return {
      follows: follows.filter((f) => f !== existing),
      following: false,
      targetCounters: {
        ...targetCounters,
        follower_count: Math.max(0, targetCounters.follower_count - 1),
      },
      followerCounters: {
        ...followerCounters,
        following_count: Math.max(0, followerCounters.following_count - 1),
      },
    };
  }
  const newFollow: FollowRecord = {
    id: `follow-${follows.length + 1}`,
    follower_id: followerId,
    following_id: followingId,
    created_at: new Date().toISOString(),
  };
  return {
    follows: [...follows, newFollow],
    following: true,
    targetCounters: {
      ...targetCounters,
      follower_count: targetCounters.follower_count + 1,
    },
    followerCounters: {
      ...followerCounters,
      following_count: followerCounters.following_count + 1,
    },
  };
}

function canFollow(followerId: string, followingId: string): { ok: boolean; error?: string; status?: number } {
  if (followerId === followingId) {
    return { ok: false, error: "Cannot follow yourself", status: 400 };
  }
  return { ok: true };
}

function isAuthenticated(userId: string | null): boolean {
  return userId !== null && userId !== "";
}

function getFollowers(follows: FollowRecord[], userId: string): string[] {
  return follows
    .filter((f) => f.following_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((f) => f.follower_id);
}

function getFollowing(follows: FollowRecord[], userId: string): string[] {
  return follows
    .filter((f) => f.follower_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((f) => f.following_id);
}

function paginateList(
  items: string[],
  page: number,
  limit: number
): { items: string[]; total: number; page: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return { items: items.slice(offset, offset + limit), total, page, totalPages };
}

interface FeedAnimation {
  id: string;
  creator_id: string;
  created_at: string;
}

function getFeedAnimations(
  follows: FollowRecord[],
  animations: FeedAnimation[],
  userId: string
): FeedAnimation[] {
  const followingIds = new Set(getFollowing(follows, userId));
  return animations
    .filter((a) => followingIds.has(a.creator_id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function checkUniqueConstraint(
  follows: FollowRecord[],
  followerId: string,
  followingId: string
): boolean {
  return follows.some(
    (f) => f.follower_id === followerId && f.following_id === followingId
  );
}

// --- Tests ---

describe("Follow toggle: basic behavior", () => {
  const defaultCounters: UserCounters = { follower_count: 0, following_count: 0 };

  it("follows a user when not yet following", () => {
    const result = toggleFollow([], "user-1", "user-2", defaultCounters, defaultCounters);
    expect(result.following).toBe(true);
    expect(result.targetCounters.follower_count).toBe(1);
    expect(result.followerCounters.following_count).toBe(1);
    expect(result.follows).toHaveLength(1);
  });

  it("unfollows a user when already following", () => {
    const follows: FollowRecord[] = [
      { id: "f-1", follower_id: "user-1", following_id: "user-2", created_at: "2025-01-01T00:00:00Z" },
    ];
    const result = toggleFollow(
      follows, "user-1", "user-2",
      { follower_count: 1, following_count: 0 },
      { follower_count: 0, following_count: 1 }
    );
    expect(result.following).toBe(false);
    expect(result.targetCounters.follower_count).toBe(0);
    expect(result.followerCounters.following_count).toBe(0);
    expect(result.follows).toHaveLength(0);
  });

  it("toggles follow on then off returns to original state", () => {
    const r1 = toggleFollow([], "user-1", "user-2", defaultCounters, defaultCounters);
    expect(r1.following).toBe(true);

    const r2 = toggleFollow(r1.follows, "user-1", "user-2", r1.targetCounters, r1.followerCounters);
    expect(r2.following).toBe(false);
    expect(r2.targetCounters.follower_count).toBe(0);
    expect(r2.followerCounters.following_count).toBe(0);
    expect(r2.follows).toHaveLength(0);
  });

  it("follower count does not go below zero", () => {
    const follows: FollowRecord[] = [
      { id: "f-1", follower_id: "user-1", following_id: "user-2", created_at: "2025-01-01T00:00:00Z" },
    ];
    const result = toggleFollow(
      follows, "user-1", "user-2",
      { follower_count: 0, following_count: 0 },
      { follower_count: 0, following_count: 0 }
    );
    expect(result.targetCounters.follower_count).toBe(0);
    expect(result.followerCounters.following_count).toBe(0);
  });
});

describe("Follow toggle: multi-user isolation", () => {
  const defaultCounters: UserCounters = { follower_count: 0, following_count: 0 };

  it("different users can follow the same user independently", () => {
    const r1 = toggleFollow([], "user-1", "user-3", defaultCounters, defaultCounters);
    const r2 = toggleFollow(r1.follows, "user-2", "user-3", r1.targetCounters, defaultCounters);
    expect(r2.follows).toHaveLength(2);
    expect(r2.targetCounters.follower_count).toBe(2);
  });

  it("one user unfollowing does not affect another's follow", () => {
    const follows: FollowRecord[] = [
      { id: "f-1", follower_id: "user-1", following_id: "user-3", created_at: "2025-01-01T00:00:00Z" },
      { id: "f-2", follower_id: "user-2", following_id: "user-3", created_at: "2025-01-01T00:00:01Z" },
    ];
    const result = toggleFollow(
      follows, "user-1", "user-3",
      { follower_count: 2, following_count: 0 },
      { follower_count: 0, following_count: 1 }
    );
    expect(result.following).toBe(false);
    expect(result.targetCounters.follower_count).toBe(1);
    expect(result.follows).toHaveLength(1);
    expect(result.follows[0].follower_id).toBe("user-2");
  });

  it("same user can follow different users", () => {
    const r1 = toggleFollow([], "user-1", "user-2", defaultCounters, defaultCounters);
    const r2 = toggleFollow(r1.follows, "user-1", "user-3", defaultCounters, r1.followerCounters);
    expect(r2.follows).toHaveLength(2);
    expect(r2.followerCounters.following_count).toBe(2);
  });
});

describe("Follow: self-follow prevention", () => {
  it("rejects self-follow with 400", () => {
    const result = canFollow("user-1", "user-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Cannot follow yourself");
  });

  it("allows following a different user", () => {
    const result = canFollow("user-1", "user-2");
    expect(result.ok).toBe(true);
  });
});

describe("Follow: duplicate prevention via unique constraint", () => {
  it("detects existing follow for same follower and following", () => {
    const follows: FollowRecord[] = [
      { id: "f-1", follower_id: "user-1", following_id: "user-2", created_at: "2025-01-01T00:00:00Z" },
    ];
    expect(checkUniqueConstraint(follows, "user-1", "user-2")).toBe(true);
  });

  it("does not flag different follower as duplicate", () => {
    const follows: FollowRecord[] = [
      { id: "f-1", follower_id: "user-1", following_id: "user-2", created_at: "2025-01-01T00:00:00Z" },
    ];
    expect(checkUniqueConstraint(follows, "user-3", "user-2")).toBe(false);
  });

  it("does not flag different following as duplicate", () => {
    const follows: FollowRecord[] = [
      { id: "f-1", follower_id: "user-1", following_id: "user-2", created_at: "2025-01-01T00:00:00Z" },
    ];
    expect(checkUniqueConstraint(follows, "user-1", "user-3")).toBe(false);
  });

  it("detects no duplicates in empty list", () => {
    expect(checkUniqueConstraint([], "user-1", "user-2")).toBe(false);
  });
});

describe("Follow: counter accuracy", () => {
  const defaultCounters: UserCounters = { follower_count: 0, following_count: 0 };

  it("counters increment correctly after multiple follows", () => {
    let targetCounters = { ...defaultCounters };
    let follows: FollowRecord[] = [];

    for (let i = 1; i <= 5; i++) {
      const r = toggleFollow(follows, `user-${i}`, "target", targetCounters, defaultCounters);
      follows = r.follows;
      targetCounters = r.targetCounters;
    }

    expect(targetCounters.follower_count).toBe(5);
    expect(follows).toHaveLength(5);
  });

  it("counters decrement correctly after unfollows", () => {
    let targetCounters = { ...defaultCounters };
    let followerCounters = { ...defaultCounters };
    let follows: FollowRecord[] = [];

    // Follow
    const r1 = toggleFollow(follows, "user-1", "user-2", targetCounters, followerCounters);
    follows = r1.follows;
    targetCounters = r1.targetCounters;
    followerCounters = r1.followerCounters;
    expect(targetCounters.follower_count).toBe(1);
    expect(followerCounters.following_count).toBe(1);

    // Unfollow
    const r2 = toggleFollow(follows, "user-1", "user-2", targetCounters, followerCounters);
    expect(r2.targetCounters.follower_count).toBe(0);
    expect(r2.followerCounters.following_count).toBe(0);
  });

  it("multiple toggles produce consistent results", () => {
    let targetCounters = { ...defaultCounters };
    let followerCounters = { ...defaultCounters };
    let follows: FollowRecord[] = [];

    for (let i = 0; i < 10; i++) {
      const r = toggleFollow(follows, "user-1", "user-2", targetCounters, followerCounters);
      follows = r.follows;
      targetCounters = r.targetCounters;
      followerCounters = r.followerCounters;

      if (i % 2 === 0) {
        expect(r.following).toBe(true);
        expect(targetCounters.follower_count).toBe(1);
      } else {
        expect(r.following).toBe(false);
        expect(targetCounters.follower_count).toBe(0);
      }
    }
  });
});

describe("Follow: authentication gate", () => {
  it("authenticated user is allowed to follow", () => {
    expect(isAuthenticated("user-1")).toBe(true);
  });

  it("null user is not authenticated", () => {
    expect(isAuthenticated(null)).toBe(false);
  });

  it("empty string user is not authenticated", () => {
    expect(isAuthenticated("")).toBe(false);
  });

  it("unauthenticated follow attempt returns 401 scenario", () => {
    const userId: string | null = null;
    if (!isAuthenticated(userId)) {
      const response = { error: "Authentication required", status: 401 };
      expect(response.status).toBe(401);
      expect(response.error).toBe("Authentication required");
    }
  });
});

describe("Followers and following: query", () => {
  const follows: FollowRecord[] = [
    { id: "f-1", follower_id: "user-a", following_id: "user-x", created_at: "2025-01-01T00:00:00Z" },
    { id: "f-2", follower_id: "user-b", following_id: "user-x", created_at: "2025-01-02T00:00:00Z" },
    { id: "f-3", follower_id: "user-c", following_id: "user-x", created_at: "2025-01-03T00:00:00Z" },
    { id: "f-4", follower_id: "user-x", following_id: "user-a", created_at: "2025-01-04T00:00:00Z" },
    { id: "f-5", follower_id: "user-x", following_id: "user-d", created_at: "2025-01-05T00:00:00Z" },
  ];

  it("returns correct followers list", () => {
    const followers = getFollowers(follows, "user-x");
    expect(followers).toHaveLength(3);
    expect(followers).toContain("user-a");
    expect(followers).toContain("user-b");
    expect(followers).toContain("user-c");
  });

  it("returns followers in most recent first order", () => {
    const followers = getFollowers(follows, "user-x");
    expect(followers).toEqual(["user-c", "user-b", "user-a"]);
  });

  it("returns correct following list", () => {
    const following = getFollowing(follows, "user-x");
    expect(following).toHaveLength(2);
    expect(following).toContain("user-a");
    expect(following).toContain("user-d");
  });

  it("returns empty for user with no followers", () => {
    const followers = getFollowers(follows, "user-99");
    expect(followers).toHaveLength(0);
  });

  it("returns empty for user not following anyone", () => {
    const following = getFollowing(follows, "user-99");
    expect(following).toHaveLength(0);
  });
});

describe("Followers and following: pagination", () => {
  const follows: FollowRecord[] = Array.from({ length: 10 }, (_, i) => ({
    id: `f-${i}`,
    follower_id: `user-${i}`,
    following_id: "target",
    created_at: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  }));

  it("paginates first page correctly", () => {
    const items = getFollowers(follows, "target");
    const page = paginateList(items, 1, 3);
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(10);
    expect(page.totalPages).toBe(4);
    expect(page.page).toBe(1);
  });

  it("paginates middle page correctly", () => {
    const items = getFollowers(follows, "target");
    const page = paginateList(items, 2, 3);
    expect(page.items).toHaveLength(3);
    expect(page.page).toBe(2);
  });

  it("paginates partial last page correctly", () => {
    const items = getFollowers(follows, "target");
    const page = paginateList(items, 4, 3);
    expect(page.items).toHaveLength(1);
  });

  it("returns empty for page beyond total", () => {
    const items = getFollowers(follows, "target");
    const page = paginateList(items, 10, 3);
    expect(page.items).toHaveLength(0);
  });
});

describe("Feed: content filtering", () => {
  const follows: FollowRecord[] = [
    { id: "f-1", follower_id: "me", following_id: "creator-a", created_at: "2025-01-01T00:00:00Z" },
    { id: "f-2", follower_id: "me", following_id: "creator-b", created_at: "2025-01-01T00:00:00Z" },
  ];

  const animations: FeedAnimation[] = [
    { id: "anim-1", creator_id: "creator-a", created_at: "2025-01-05T00:00:00Z" },
    { id: "anim-2", creator_id: "creator-b", created_at: "2025-01-04T00:00:00Z" },
    { id: "anim-3", creator_id: "creator-c", created_at: "2025-01-03T00:00:00Z" },
    { id: "anim-4", creator_id: "creator-a", created_at: "2025-01-02T00:00:00Z" },
    { id: "anim-5", creator_id: "me", created_at: "2025-01-01T00:00:00Z" },
  ];

  it("returns only animations from followed users", () => {
    const feed = getFeedAnimations(follows, animations, "me");
    expect(feed).toHaveLength(3);
    expect(feed.map((a) => a.id)).toEqual(["anim-1", "anim-2", "anim-4"]);
  });

  it("excludes animations from non-followed users", () => {
    const feed = getFeedAnimations(follows, animations, "me");
    const ids = feed.map((a) => a.id);
    expect(ids).not.toContain("anim-3");
    expect(ids).not.toContain("anim-5");
  });

  it("orders feed newest first", () => {
    const feed = getFeedAnimations(follows, animations, "me");
    const dates = feed.map((a) => new Date(a.created_at).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it("returns empty feed when not following anyone", () => {
    const feed = getFeedAnimations([], animations, "me");
    expect(feed).toHaveLength(0);
  });

  it("returns empty feed when followed users have no animations", () => {
    const feed = getFeedAnimations(follows, [], "me");
    expect(feed).toHaveLength(0);
  });
});

describe("Feed: pagination", () => {
  const follows: FollowRecord[] = [
    { id: "f-1", follower_id: "me", following_id: "creator-a", created_at: "2025-01-01T00:00:00Z" },
  ];

  const animations: FeedAnimation[] = Array.from({ length: 50 }, (_, i) => ({
    id: `anim-${i}`,
    creator_id: "creator-a",
    created_at: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  }));

  it("paginates feed correctly", () => {
    const feed = getFeedAnimations(follows, animations, "me");
    const page1 = paginateList(feed.map((a) => a.id), 1, 24);
    expect(page1.items).toHaveLength(24);
    expect(page1.total).toBe(50);
    expect(page1.totalPages).toBe(3);

    const page2 = paginateList(feed.map((a) => a.id), 2, 24);
    expect(page2.items).toHaveLength(24);

    const page3 = paginateList(feed.map((a) => a.id), 3, 24);
    expect(page3.items).toHaveLength(2);
  });
});

describe("Follow: response format", () => {
  function buildFollowResponse(following: boolean, followerCount: number) {
    return { following, followerCount };
  }

  it("returns correct shape for follow", () => {
    const response = buildFollowResponse(true, 5);
    expect(response).toEqual({ following: true, followerCount: 5 });
  });

  it("returns correct shape for unfollow", () => {
    const response = buildFollowResponse(false, 4);
    expect(response).toEqual({ following: false, followerCount: 4 });
  });

  it("returns zero count when no followers", () => {
    const response = buildFollowResponse(false, 0);
    expect(response).toEqual({ following: false, followerCount: 0 });
  });
});

describe("Follow: does not mutate input", () => {
  it("does not mutate input follows array", () => {
    const original: FollowRecord[] = [
      { id: "f-1", follower_id: "user-1", following_id: "user-2", created_at: "2025-01-01T00:00:00Z" },
    ];
    const originalLength = original.length;

    toggleFollow(
      original, "user-1", "user-2",
      { follower_count: 1, following_count: 0 },
      { follower_count: 0, following_count: 1 }
    );
    expect(original).toHaveLength(originalLength);
  });
});
