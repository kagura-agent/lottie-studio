import { describe, it, expect } from "vitest";

// --- Pure helper functions extracted from notification logic ---

interface Notification {
  id: string;
  user_id: string;
  type: "follow" | "comment" | "like";
  actor_id: string;
  animation_id: string | null;
  comment_id: string | null;
  read: number;
  created_at: string;
}

function shouldCreateNotification(userId: string, actorId: string): boolean {
  return userId !== actorId;
}

function createNotification(
  notifications: Notification[],
  params: {
    userId: string;
    type: "follow" | "comment" | "like";
    actorId: string;
    animationId?: string;
    commentId?: string;
  }
): Notification[] {
  if (!shouldCreateNotification(params.userId, params.actorId)) {
    return notifications;
  }
  const newNotification: Notification = {
    id: `notif-${notifications.length + 1}`,
    user_id: params.userId,
    type: params.type,
    actor_id: params.actorId,
    animation_id: params.animationId ?? null,
    comment_id: params.commentId ?? null,
    read: 0,
    created_at: new Date().toISOString(),
  };
  return [...notifications, newNotification];
}

function getUnreadCount(notifications: Notification[], userId: string): number {
  return notifications.filter((n) => n.user_id === userId && n.read === 0).length;
}

function markAsRead(
  notifications: Notification[],
  userId: string,
  notificationId?: string
): Notification[] {
  return notifications.map((n) => {
    if (n.user_id !== userId) return n;
    if (notificationId && n.id !== notificationId) return n;
    return { ...n, read: 1 };
  });
}

function paginateNotifications(
  notifications: Notification[],
  userId: string,
  page: number,
  limit: number
): { items: Notification[]; total: number; page: number; totalPages: number } {
  const userNotifs = notifications
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = userNotifs.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return {
    items: userNotifs.slice(offset, offset + limit),
    total,
    page,
    totalPages,
  };
}

// --- Tests ---

describe("Notification creation", () => {
  it("creates a follow notification", () => {
    const result = createNotification([], {
      userId: "user-2",
      type: "follow",
      actorId: "user-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("follow");
    expect(result[0].user_id).toBe("user-2");
    expect(result[0].actor_id).toBe("user-1");
  });

  it("creates a like notification with animation reference", () => {
    const result = createNotification([], {
      userId: "user-2",
      type: "like",
      actorId: "user-1",
      animationId: "anim-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("like");
    expect(result[0].animation_id).toBe("anim-1");
  });

  it("creates a comment notification with animation and comment reference", () => {
    const result = createNotification([], {
      userId: "user-2",
      type: "comment",
      actorId: "user-1",
      animationId: "anim-1",
      commentId: "comment-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("comment");
    expect(result[0].animation_id).toBe("anim-1");
    expect(result[0].comment_id).toBe("comment-1");
  });

  it("sets null for optional fields when not provided", () => {
    const result = createNotification([], {
      userId: "user-2",
      type: "follow",
      actorId: "user-1",
    });
    expect(result[0].animation_id).toBeNull();
    expect(result[0].comment_id).toBeNull();
  });

  it("creates notification as unread by default", () => {
    const result = createNotification([], {
      userId: "user-2",
      type: "follow",
      actorId: "user-1",
    });
    expect(result[0].read).toBe(0);
  });

  it("appends to existing notifications", () => {
    const first = createNotification([], {
      userId: "user-2",
      type: "follow",
      actorId: "user-1",
    });
    const second = createNotification(first, {
      userId: "user-2",
      type: "like",
      actorId: "user-3",
      animationId: "anim-1",
    });
    expect(second).toHaveLength(2);
  });
});

describe("No self-notification", () => {
  it("skips notification when actor is the same as recipient", () => {
    const result = createNotification([], {
      userId: "user-1",
      type: "like",
      actorId: "user-1",
      animationId: "anim-1",
    });
    expect(result).toHaveLength(0);
  });

  it("shouldCreateNotification returns false for self", () => {
    expect(shouldCreateNotification("user-1", "user-1")).toBe(false);
  });

  it("shouldCreateNotification returns true for different users", () => {
    expect(shouldCreateNotification("user-1", "user-2")).toBe(true);
  });

  it("does not mutate existing array on self-notification", () => {
    const existing: Notification[] = [
      {
        id: "notif-1",
        user_id: "user-2",
        type: "follow",
        actor_id: "user-3",
        animation_id: null,
        comment_id: null,
        read: 0,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];
    const result = createNotification(existing, {
      userId: "user-1",
      type: "like",
      actorId: "user-1",
    });
    expect(result).toHaveLength(1);
    expect(result).toBe(existing);
  });
});

describe("Unread count", () => {
  const notifications: Notification[] = [
    { id: "n-1", user_id: "user-1", type: "follow", actor_id: "user-2", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-01T00:00:00Z" },
    { id: "n-2", user_id: "user-1", type: "like", actor_id: "user-3", animation_id: "anim-1", comment_id: null, read: 0, created_at: "2025-01-02T00:00:00Z" },
    { id: "n-3", user_id: "user-1", type: "comment", actor_id: "user-4", animation_id: "anim-1", comment_id: "c-1", read: 1, created_at: "2025-01-03T00:00:00Z" },
    { id: "n-4", user_id: "user-2", type: "follow", actor_id: "user-1", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-04T00:00:00Z" },
  ];

  it("counts unread notifications for a specific user", () => {
    expect(getUnreadCount(notifications, "user-1")).toBe(2);
  });

  it("does not count read notifications", () => {
    const allRead = notifications.map((n) => ({ ...n, read: 1 as number }));
    expect(getUnreadCount(allRead, "user-1")).toBe(0);
  });

  it("does not count other users' notifications", () => {
    expect(getUnreadCount(notifications, "user-2")).toBe(1);
  });

  it("returns zero for user with no notifications", () => {
    expect(getUnreadCount(notifications, "user-99")).toBe(0);
  });

  it("returns zero for empty notifications", () => {
    expect(getUnreadCount([], "user-1")).toBe(0);
  });
});

describe("Mark as read: single notification", () => {
  const notifications: Notification[] = [
    { id: "n-1", user_id: "user-1", type: "follow", actor_id: "user-2", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-01T00:00:00Z" },
    { id: "n-2", user_id: "user-1", type: "like", actor_id: "user-3", animation_id: "anim-1", comment_id: null, read: 0, created_at: "2025-01-02T00:00:00Z" },
  ];

  it("marks a specific notification as read", () => {
    const result = markAsRead(notifications, "user-1", "n-1");
    expect(result[0].read).toBe(1);
    expect(result[1].read).toBe(0);
  });

  it("does not affect other users' notifications", () => {
    const withOtherUser: Notification[] = [
      ...notifications,
      { id: "n-3", user_id: "user-2", type: "follow", actor_id: "user-1", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-03T00:00:00Z" },
    ];
    const result = markAsRead(withOtherUser, "user-1", "n-1");
    expect(result[2].read).toBe(0);
  });

  it("does not mutate original array", () => {
    const original = [...notifications];
    markAsRead(notifications, "user-1", "n-1");
    expect(notifications[0].read).toBe(0);
    expect(notifications).toEqual(original);
  });
});

describe("Mark as read: all notifications", () => {
  const notifications: Notification[] = [
    { id: "n-1", user_id: "user-1", type: "follow", actor_id: "user-2", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-01T00:00:00Z" },
    { id: "n-2", user_id: "user-1", type: "like", actor_id: "user-3", animation_id: "anim-1", comment_id: null, read: 0, created_at: "2025-01-02T00:00:00Z" },
    { id: "n-3", user_id: "user-2", type: "follow", actor_id: "user-1", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-03T00:00:00Z" },
  ];

  it("marks all notifications for a user as read", () => {
    const result = markAsRead(notifications, "user-1");
    expect(result[0].read).toBe(1);
    expect(result[1].read).toBe(1);
  });

  it("does not mark other users' notifications as read", () => {
    const result = markAsRead(notifications, "user-1");
    expect(result[2].read).toBe(0);
  });

  it("unread count is zero after marking all", () => {
    const result = markAsRead(notifications, "user-1");
    expect(getUnreadCount(result, "user-1")).toBe(0);
  });
});

describe("Notification pagination", () => {
  const notifications: Notification[] = Array.from({ length: 15 }, (_, i) => ({
    id: `n-${i}`,
    user_id: "user-1",
    type: "like" as const,
    actor_id: `user-${i + 10}`,
    animation_id: `anim-${i}`,
    comment_id: null,
    read: 0,
    created_at: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  }));

  it("returns correct first page", () => {
    const result = paginateNotifications(notifications, "user-1", 1, 5);
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(15);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });

  it("returns items in newest-first order", () => {
    const result = paginateNotifications(notifications, "user-1", 1, 5);
    const dates = result.items.map((n) => new Date(n.created_at).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThan(dates[i + 1]);
    }
  });

  it("returns correct middle page", () => {
    const result = paginateNotifications(notifications, "user-1", 2, 5);
    expect(result.items).toHaveLength(5);
    expect(result.page).toBe(2);
  });

  it("returns partial last page", () => {
    const result = paginateNotifications(notifications, "user-1", 3, 5);
    expect(result.items).toHaveLength(5);
  });

  it("returns empty for page beyond total", () => {
    const result = paginateNotifications(notifications, "user-1", 10, 5);
    expect(result.items).toHaveLength(0);
  });

  it("filters to only the specified user", () => {
    const mixed = [
      ...notifications,
      { id: "n-other", user_id: "user-2", type: "follow" as const, actor_id: "user-1", animation_id: null, comment_id: null, read: 0, created_at: "2025-02-01T00:00:00Z" },
    ];
    const result = paginateNotifications(mixed, "user-1", 1, 100);
    expect(result.total).toBe(15);
    expect(result.items.every((n) => n.user_id === "user-1")).toBe(true);
  });

  it("returns empty for user with no notifications", () => {
    const result = paginateNotifications(notifications, "user-99", 1, 5);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("Notification: does not mutate input", () => {
  it("createNotification does not mutate input array", () => {
    const original: Notification[] = [
      { id: "n-1", user_id: "user-1", type: "follow", actor_id: "user-2", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-01T00:00:00Z" },
    ];
    const originalLength = original.length;
    createNotification(original, {
      userId: "user-1",
      type: "like",
      actorId: "user-3",
      animationId: "anim-1",
    });
    expect(original).toHaveLength(originalLength);
  });

  it("markAsRead does not mutate input array", () => {
    const original: Notification[] = [
      { id: "n-1", user_id: "user-1", type: "follow", actor_id: "user-2", animation_id: null, comment_id: null, read: 0, created_at: "2025-01-01T00:00:00Z" },
    ];
    markAsRead(original, "user-1", "n-1");
    expect(original[0].read).toBe(0);
  });
});
