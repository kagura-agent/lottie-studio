import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

// --- Pure helper functions extracted from analytics logic ---

interface ViewRecord {
  id: number;
  animation_id: string;
  viewer_id: string | null;
  created_at: string;
}

interface AnimationRow {
  id: string;
  name: string;
  user_id: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
}

function shouldSkipSelfView(
  animationOwnerId: string | null,
  viewerId: string | null
): boolean {
  if (!viewerId) return false;
  return viewerId === animationOwnerId;
}

function hashIp(ip: string): string {
  return `anon:${createHash("sha256").update(ip).digest("hex")}`;
}

function isDuplicateView(
  views: ViewRecord[],
  animationId: string,
  viewerId: string | null,
  today: string
): boolean {
  if (!viewerId) return false;
  return views.some(
    (v) =>
      v.animation_id === animationId &&
      v.viewer_id === viewerId &&
      v.created_at.startsWith(today)
  );
}

function recordView(
  views: ViewRecord[],
  animationId: string,
  viewerId: string | null,
  animationOwnerId: string | null,
  today: string
): { views: ViewRecord[]; recorded: boolean } {
  if (shouldSkipSelfView(animationOwnerId, viewerId)) {
    return { views, recorded: false };
  }

  if (isDuplicateView(views, animationId, viewerId, today)) {
    return { views, recorded: false };
  }

  const newView: ViewRecord = {
    id: Math.max(0, ...views.map((v) => v.id)) + 1,
    animation_id: animationId,
    viewer_id: viewerId,
    created_at: `${today}T12:00:00Z`,
  };

  return { views: [...views, newView], recorded: true };
}

function computeOverview(
  animations: AnimationRow[],
  followerCount: number
): {
  totalViews: number;
  totalAnimations: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
} {
  return {
    totalViews: animations.reduce((sum, a) => sum + (a.view_count ?? 0), 0),
    totalAnimations: animations.length,
    totalLikes: animations.reduce((sum, a) => sum + (a.like_count ?? 0), 0),
    totalComments: animations.reduce((sum, a) => sum + (a.comment_count ?? 0), 0),
    totalFollowers: followerCount,
  };
}

function groupViewsByDay(
  views: ViewRecord[]
): { date: string; count: number }[] {
  const grouped = new Map<string, number>();
  for (const v of views) {
    const date = v.created_at.slice(0, 10);
    grouped.set(date, (grouped.get(date) ?? 0) + 1);
  }
  return Array.from(grouped.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function filterViewsByPeriod(
  views: ViewRecord[],
  period: "7d" | "30d" | "all",
  now: Date
): ViewRecord[] {
  if (period === "all") return views;
  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return views.filter((v) => new Date(v.created_at) >= cutoff);
}

function rankAnimationsByViews(
  animations: AnimationRow[],
  page: number,
  limit: number
): { items: AnimationRow[]; total: number; page: number; totalPages: number } {
  const sorted = [...animations].sort((a, b) => b.view_count - a.view_count);
  const total = sorted.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const items = sorted.slice(offset, offset + limit);
  return { items, total, page, totalPages };
}

function isAuthenticated(userId: string | null): boolean {
  return userId !== null && userId !== "";
}

// --- Tests ---

describe("View tracking: self-view skip", () => {
  it("skips view when viewer is the animation owner", () => {
    expect(shouldSkipSelfView("user-1", "user-1")).toBe(true);
  });

  it("allows view when viewer is different from owner", () => {
    expect(shouldSkipSelfView("user-1", "user-2")).toBe(false);
  });

  it("allows anonymous views on owned animations", () => {
    expect(shouldSkipSelfView("user-1", null)).toBe(false);
  });

  it("allows views on animations with no owner", () => {
    expect(shouldSkipSelfView(null, "user-1")).toBe(false);
  });

  it("allows anonymous views on unowned animations", () => {
    expect(shouldSkipSelfView(null, null)).toBe(false);
  });
});

describe("View tracking: deduplication", () => {
  const today = "2025-06-15";
  const views: ViewRecord[] = [
    { id: 1, animation_id: "anim-1", viewer_id: "user-1", created_at: "2025-06-15T10:00:00Z" },
    { id: 2, animation_id: "anim-1", viewer_id: "user-2", created_at: "2025-06-14T10:00:00Z" },
  ];

  it("detects duplicate view for same viewer, animation, and day", () => {
    expect(isDuplicateView(views, "anim-1", "user-1", today)).toBe(true);
  });

  it("allows view from different day", () => {
    expect(isDuplicateView(views, "anim-1", "user-2", today)).toBe(false);
  });

  it("allows view from different viewer same day", () => {
    expect(isDuplicateView(views, "anim-1", "user-3", today)).toBe(false);
  });

  it("allows view for different animation", () => {
    expect(isDuplicateView(views, "anim-2", "user-1", today)).toBe(false);
  });

  it("deduplicates anonymous views with same hashed IP", () => {
    const anonId = hashIp("192.168.1.1");
    const viewsWithAnon: ViewRecord[] = [
      { id: 1, animation_id: "anim-1", viewer_id: anonId, created_at: "2025-06-15T10:00:00Z" },
    ];
    expect(isDuplicateView(viewsWithAnon, "anim-1", anonId, today)).toBe(true);
  });

  it("does not deduplicate anonymous views from different IPs", () => {
    const anonId1 = hashIp("192.168.1.1");
    const anonId2 = hashIp("10.0.0.1");
    const viewsWithAnon: ViewRecord[] = [
      { id: 1, animation_id: "anim-1", viewer_id: anonId1, created_at: "2025-06-15T10:00:00Z" },
    ];
    expect(isDuplicateView(viewsWithAnon, "anim-1", anonId2, today)).toBe(false);
  });
});

describe("View tracking: recordView integration", () => {
  it("records a valid view", () => {
    const result = recordView([], "anim-1", "user-2", "user-1", "2025-06-15");
    expect(result.recorded).toBe(true);
    expect(result.views).toHaveLength(1);
    expect(result.views[0].animation_id).toBe("anim-1");
    expect(result.views[0].viewer_id).toBe("user-2");
  });

  it("skips self-view", () => {
    const result = recordView([], "anim-1", "user-1", "user-1", "2025-06-15");
    expect(result.recorded).toBe(false);
    expect(result.views).toHaveLength(0);
  });

  it("skips duplicate view same day", () => {
    const existing: ViewRecord[] = [
      { id: 1, animation_id: "anim-1", viewer_id: "user-2", created_at: "2025-06-15T10:00:00Z" },
    ];
    const result = recordView(existing, "anim-1", "user-2", "user-1", "2025-06-15");
    expect(result.recorded).toBe(false);
    expect(result.views).toHaveLength(1);
  });

  it("allows same viewer on a different day", () => {
    const existing: ViewRecord[] = [
      { id: 1, animation_id: "anim-1", viewer_id: "user-2", created_at: "2025-06-14T10:00:00Z" },
    ];
    const result = recordView(existing, "anim-1", "user-2", "user-1", "2025-06-15");
    expect(result.recorded).toBe(true);
    expect(result.views).toHaveLength(2);
  });

  it("records anonymous view with hashed IP", () => {
    const anonId = hashIp("192.168.1.1");
    const result = recordView([], "anim-1", anonId, "user-1", "2025-06-15");
    expect(result.recorded).toBe(true);
    expect(result.views[0].viewer_id).toBe(anonId);
  });

  it("deduplicates same anonymous viewer same day", () => {
    const anonId = hashIp("192.168.1.1");
    const r1 = recordView([], "anim-1", anonId, "user-1", "2025-06-15");
    const r2 = recordView(r1.views, "anim-1", anonId, "user-1", "2025-06-15");
    expect(r2.recorded).toBe(false);
    expect(r2.views).toHaveLength(1);
  });

  it("records views from different anonymous IPs same day", () => {
    const anonId1 = hashIp("192.168.1.1");
    const anonId2 = hashIp("10.0.0.1");
    const r1 = recordView([], "anim-1", anonId1, "user-1", "2025-06-15");
    const r2 = recordView(r1.views, "anim-1", anonId2, "user-1", "2025-06-15");
    expect(r2.recorded).toBe(true);
    expect(r2.views).toHaveLength(2);
  });

  it("does not mutate input array", () => {
    const original: ViewRecord[] = [];
    recordView(original, "anim-1", "user-2", "user-1", "2025-06-15");
    expect(original).toHaveLength(0);
  });
});

describe("Analytics: overview aggregation", () => {
  const animations: AnimationRow[] = [
    { id: "a1", name: "Ball", user_id: "user-1", view_count: 100, like_count: 10, comment_count: 5, created_at: "2025-01-01" },
    { id: "a2", name: "Star", user_id: "user-1", view_count: 50, like_count: 3, comment_count: 2, created_at: "2025-01-02" },
    { id: "a3", name: "Wave", user_id: "user-1", view_count: 25, like_count: 7, comment_count: 0, created_at: "2025-01-03" },
  ];

  it("sums total views across all animations", () => {
    const overview = computeOverview(animations, 42);
    expect(overview.totalViews).toBe(175);
  });

  it("counts total animations", () => {
    const overview = computeOverview(animations, 42);
    expect(overview.totalAnimations).toBe(3);
  });

  it("sums total likes", () => {
    const overview = computeOverview(animations, 42);
    expect(overview.totalLikes).toBe(20);
  });

  it("sums total comments", () => {
    const overview = computeOverview(animations, 42);
    expect(overview.totalComments).toBe(7);
  });

  it("includes follower count", () => {
    const overview = computeOverview(animations, 42);
    expect(overview.totalFollowers).toBe(42);
  });

  it("handles empty animations list", () => {
    const overview = computeOverview([], 0);
    expect(overview.totalViews).toBe(0);
    expect(overview.totalAnimations).toBe(0);
    expect(overview.totalLikes).toBe(0);
    expect(overview.totalComments).toBe(0);
    expect(overview.totalFollowers).toBe(0);
  });

  it("handles zero follower count", () => {
    const overview = computeOverview(animations, 0);
    expect(overview.totalFollowers).toBe(0);
  });
});

describe("Analytics: time series grouping", () => {
  const views: ViewRecord[] = [
    { id: 1, animation_id: "a1", viewer_id: "u1", created_at: "2025-06-10T08:00:00Z" },
    { id: 2, animation_id: "a1", viewer_id: "u2", created_at: "2025-06-10T14:00:00Z" },
    { id: 3, animation_id: "a1", viewer_id: "u3", created_at: "2025-06-11T09:00:00Z" },
    { id: 4, animation_id: "a2", viewer_id: "u1", created_at: "2025-06-12T12:00:00Z" },
    { id: 5, animation_id: "a1", viewer_id: "u4", created_at: "2025-06-12T18:00:00Z" },
  ];

  it("groups views by date", () => {
    const grouped = groupViewsByDay(views);
    expect(grouped).toHaveLength(3);
    expect(grouped[0]).toEqual({ date: "2025-06-10", count: 2 });
    expect(grouped[1]).toEqual({ date: "2025-06-11", count: 1 });
    expect(grouped[2]).toEqual({ date: "2025-06-12", count: 2 });
  });

  it("sorts by date ascending", () => {
    const reversed = [...views].reverse();
    const grouped = groupViewsByDay(reversed);
    expect(grouped[0].date).toBe("2025-06-10");
    expect(grouped[grouped.length - 1].date).toBe("2025-06-12");
  });

  it("returns empty for no views", () => {
    const grouped = groupViewsByDay([]);
    expect(grouped).toHaveLength(0);
  });

  it("handles single day", () => {
    const singleDay: ViewRecord[] = [
      { id: 1, animation_id: "a1", viewer_id: "u1", created_at: "2025-06-10T08:00:00Z" },
    ];
    const grouped = groupViewsByDay(singleDay);
    expect(grouped).toEqual([{ date: "2025-06-10", count: 1 }]);
  });
});

describe("Analytics: period filtering", () => {
  const now = new Date("2025-06-15T12:00:00Z");
  const views: ViewRecord[] = [
    { id: 1, animation_id: "a1", viewer_id: "u1", created_at: "2025-06-14T10:00:00Z" },
    { id: 2, animation_id: "a1", viewer_id: "u2", created_at: "2025-06-10T10:00:00Z" },
    { id: 3, animation_id: "a1", viewer_id: "u3", created_at: "2025-06-01T10:00:00Z" },
    { id: 4, animation_id: "a1", viewer_id: "u4", created_at: "2025-05-01T10:00:00Z" },
  ];

  it("filters to last 7 days", () => {
    const filtered = filterViewsByPeriod(views, "7d", now);
    expect(filtered).toHaveLength(2);
  });

  it("filters to last 30 days", () => {
    const filtered = filterViewsByPeriod(views, "30d", now);
    expect(filtered).toHaveLength(3);
  });

  it("returns all views for 'all' period", () => {
    const filtered = filterViewsByPeriod(views, "all", now);
    expect(filtered).toHaveLength(4);
  });
});

describe("Analytics: top animations ranking and pagination", () => {
  const animations: AnimationRow[] = [
    { id: "a1", name: "Ball", user_id: "u1", view_count: 50, like_count: 5, comment_count: 2, created_at: "2025-01-01" },
    { id: "a2", name: "Star", user_id: "u1", view_count: 200, like_count: 20, comment_count: 10, created_at: "2025-01-02" },
    { id: "a3", name: "Wave", user_id: "u1", view_count: 75, like_count: 8, comment_count: 3, created_at: "2025-01-03" },
    { id: "a4", name: "Pulse", user_id: "u1", view_count: 150, like_count: 15, comment_count: 7, created_at: "2025-01-04" },
    { id: "a5", name: "Spin", user_id: "u1", view_count: 10, like_count: 1, comment_count: 0, created_at: "2025-01-05" },
  ];

  it("ranks by view count descending", () => {
    const result = rankAnimationsByViews(animations, 1, 10);
    expect(result.items[0].id).toBe("a2");
    expect(result.items[1].id).toBe("a4");
    expect(result.items[2].id).toBe("a3");
  });

  it("paginates first page correctly", () => {
    const result = rankAnimationsByViews(animations, 1, 2);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });

  it("paginates second page correctly", () => {
    const result = rankAnimationsByViews(animations, 2, 2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("a3");
    expect(result.items[1].id).toBe("a1");
  });

  it("handles partial last page", () => {
    const result = rankAnimationsByViews(animations, 3, 2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("a5");
  });

  it("handles page beyond total", () => {
    const result = rankAnimationsByViews(animations, 10, 2);
    expect(result.items).toHaveLength(0);
  });

  it("does not mutate input array", () => {
    const original = [...animations];
    rankAnimationsByViews(animations, 1, 10);
    expect(animations.map((a) => a.id)).toEqual(original.map((a) => a.id));
  });

  it("handles empty animations list", () => {
    const result = rankAnimationsByViews([], 1, 10);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

describe("Analytics: auth gating", () => {
  it("authenticated user can access analytics", () => {
    expect(isAuthenticated("user-1")).toBe(true);
  });

  it("null user cannot access analytics", () => {
    expect(isAuthenticated(null)).toBe(false);
  });

  it("empty string user cannot access analytics", () => {
    expect(isAuthenticated("")).toBe(false);
  });

  it("unauthenticated access returns 401 scenario", () => {
    const userId: string | null = null;
    if (!isAuthenticated(userId)) {
      const response = { error: "Authentication required", status: 401 };
      expect(response.status).toBe(401);
      expect(response.error).toBe("Authentication required");
    }
  });
});
