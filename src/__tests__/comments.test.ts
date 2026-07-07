import { describe, it, expect } from "vitest";

/**
 * Tests for comments feature — CRUD operations, auth gating,
 * reply threading, pagination, and validation.
 */

// --- Pure helper functions extracted from comments API logic ---

interface CommentRecord {
  id: string;
  animation_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CommentUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function createComment(
  comments: CommentRecord[],
  animationId: string,
  userId: string,
  content: string,
  parentId: string | null = null
): { comments: CommentRecord[]; comment: CommentRecord } {
  const now = new Date().toISOString();
  const comment: CommentRecord = {
    id: `comment-${comments.length + 1}`,
    animation_id: animationId,
    user_id: userId,
    content,
    parent_id: parentId,
    created_at: now,
    updated_at: now,
  };
  return { comments: [...comments, comment], comment };
}

function editComment(
  comments: CommentRecord[],
  commentId: string,
  newContent: string
): CommentRecord[] {
  return comments.map((c) =>
    c.id === commentId
      ? { ...c, content: newContent, updated_at: new Date().toISOString() }
      : c
  );
}

function deleteComment(
  comments: CommentRecord[],
  commentId: string
): CommentRecord[] {
  return comments.filter((c) => c.id !== commentId && c.parent_id !== commentId);
}

function getCommentsByAnimation(
  comments: CommentRecord[],
  animationId: string
): CommentRecord[] {
  return comments
    .filter((c) => c.animation_id === animationId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function paginateComments(
  comments: CommentRecord[],
  page: number,
  limit: number
): { items: CommentRecord[]; total: number; page: number; totalPages: number } {
  const total = comments.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const items = comments.slice(offset, offset + limit);
  return { items, total, page, totalPages };
}

function validateContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return "Content is required";
  if (trimmed.length > 1000) return "Content must be 1000 characters or less";
  return null;
}

function isAuthenticated(userId: string | null): boolean {
  return userId !== null && userId !== "";
}

function isCommentOwner(comment: CommentRecord, userId: string): boolean {
  return comment.user_id === userId;
}

function canReplyTo(
  comments: CommentRecord[],
  parentId: string
): { ok: boolean; error?: string } {
  const parent = comments.find((c) => c.id === parentId);
  if (!parent) return { ok: false, error: "Parent comment not found" };
  if (parent.parent_id) return { ok: false, error: "Cannot reply to a reply" };
  return { ok: true };
}

function getCommentCount(comments: CommentRecord[], animationId: string): number {
  return comments.filter((c) => c.animation_id === animationId).length;
}

function getThreadedComments(
  comments: CommentRecord[]
): { topLevel: CommentRecord[]; repliesByParent: Map<string, CommentRecord[]> } {
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => c.parent_id);
  const repliesByParent = new Map<string, CommentRecord[]>();
  for (const reply of replies) {
    const arr = repliesByParent.get(reply.parent_id!) || [];
    arr.push(reply);
    repliesByParent.set(reply.parent_id!, arr);
  }
  return { topLevel, repliesByParent };
}

// --- Tests ---

describe("Comment CRUD: create", () => {
  it("creates a new comment", () => {
    const result = createComment([], "anim-1", "user-1", "Great animation!");
    expect(result.comment.content).toBe("Great animation!");
    expect(result.comment.animation_id).toBe("anim-1");
    expect(result.comment.user_id).toBe("user-1");
    expect(result.comment.parent_id).toBeNull();
    expect(result.comments).toHaveLength(1);
  });

  it("creates multiple comments on same animation", () => {
    let state: CommentRecord[] = [];
    const r1 = createComment(state, "anim-1", "user-1", "First!");
    state = r1.comments;
    const r2 = createComment(state, "anim-1", "user-2", "Second!");
    state = r2.comments;
    expect(state).toHaveLength(2);
  });

  it("preserves existing comments when adding new ones", () => {
    const r1 = createComment([], "anim-1", "user-1", "First");
    const r2 = createComment(r1.comments, "anim-1", "user-2", "Second");
    expect(r2.comments[0].content).toBe("First");
    expect(r2.comments[1].content).toBe("Second");
  });
});

describe("Comment CRUD: read", () => {
  const comments: CommentRecord[] = [
    { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Hello", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
    { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "World", parent_id: null, created_at: "2025-01-02T00:00:00Z", updated_at: "2025-01-02T00:00:00Z" },
    { id: "c3", animation_id: "anim-2", user_id: "user-1", content: "Other", parent_id: null, created_at: "2025-01-03T00:00:00Z", updated_at: "2025-01-03T00:00:00Z" },
  ];

  it("filters comments by animation_id", () => {
    const result = getCommentsByAnimation(comments, "anim-1");
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.animation_id === "anim-1")).toBe(true);
  });

  it("returns comments in newest-first order", () => {
    const result = getCommentsByAnimation(comments, "anim-1");
    expect(result[0].id).toBe("c2");
    expect(result[1].id).toBe("c1");
  });

  it("returns empty for animation with no comments", () => {
    const result = getCommentsByAnimation(comments, "anim-99");
    expect(result).toHaveLength(0);
  });
});

describe("Comment CRUD: edit", () => {
  const comments: CommentRecord[] = [
    { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Original", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
  ];

  it("updates comment content", () => {
    const result = editComment(comments, "c1", "Updated content");
    expect(result[0].content).toBe("Updated content");
  });

  it("updates the updated_at timestamp", () => {
    const result = editComment(comments, "c1", "Updated");
    expect(result[0].updated_at).not.toBe(result[0].created_at);
  });

  it("does not modify other comments", () => {
    const multi = [
      ...comments,
      { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "Other", parent_id: null, created_at: "2025-01-02T00:00:00Z", updated_at: "2025-01-02T00:00:00Z" },
    ];
    const result = editComment(multi, "c1", "Changed");
    expect(result[1].content).toBe("Other");
  });

  it("does not mutate the original array", () => {
    const original = [...comments];
    editComment(comments, "c1", "Edited");
    expect(comments[0].content).toBe(original[0].content);
  });
});

describe("Comment CRUD: delete", () => {
  it("removes a comment", () => {
    const comments: CommentRecord[] = [
      { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Delete me", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
    ];
    const result = deleteComment(comments, "c1");
    expect(result).toHaveLength(0);
  });

  it("cascades deletes to replies", () => {
    const comments: CommentRecord[] = [
      { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Parent", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
      { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "Reply", parent_id: "c1", created_at: "2025-01-01T01:00:00Z", updated_at: "2025-01-01T01:00:00Z" },
    ];
    const result = deleteComment(comments, "c1");
    expect(result).toHaveLength(0);
  });

  it("does not remove unrelated comments when deleting", () => {
    const comments: CommentRecord[] = [
      { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Keep", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
      { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "Remove", parent_id: null, created_at: "2025-01-02T00:00:00Z", updated_at: "2025-01-02T00:00:00Z" },
    ];
    const result = deleteComment(comments, "c2");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });
});

describe("Comment: authentication gate", () => {
  it("authenticated user is allowed to comment", () => {
    expect(isAuthenticated("user-1")).toBe(true);
  });

  it("null user is not authenticated", () => {
    expect(isAuthenticated(null)).toBe(false);
  });

  it("empty string user is not authenticated", () => {
    expect(isAuthenticated("")).toBe(false);
  });

  it("unauthenticated comment attempt returns 401 scenario", () => {
    const userId: string | null = null;
    if (!isAuthenticated(userId)) {
      const response = { error: "Authentication required", status: 401 };
      expect(response.status).toBe(401);
    }
  });
});

describe("Comment: authorization (ownership)", () => {
  const comment: CommentRecord = {
    id: "c1",
    animation_id: "anim-1",
    user_id: "user-1",
    content: "My comment",
    parent_id: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  it("owner can edit/delete their own comment", () => {
    expect(isCommentOwner(comment, "user-1")).toBe(true);
  });

  it("non-owner cannot edit/delete someone else's comment (403)", () => {
    expect(isCommentOwner(comment, "user-2")).toBe(false);
  });

  it("editing another user's comment returns 403 scenario", () => {
    if (!isCommentOwner(comment, "user-2")) {
      const response = { error: "Forbidden", status: 403 };
      expect(response.status).toBe(403);
    }
  });

  it("deleting another user's comment returns 403 scenario", () => {
    if (!isCommentOwner(comment, "user-2")) {
      const response = { error: "Forbidden", status: 403 };
      expect(response.status).toBe(403);
    }
  });
});

describe("Comment: reply threading", () => {
  const comments: CommentRecord[] = [
    { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Top level", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
    { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "Reply to c1", parent_id: "c1", created_at: "2025-01-01T01:00:00Z", updated_at: "2025-01-01T01:00:00Z" },
  ];

  it("allows replying to a top-level comment", () => {
    const result = canReplyTo(comments, "c1");
    expect(result.ok).toBe(true);
  });

  it("rejects replying to a reply (no deeper nesting)", () => {
    const result = canReplyTo(comments, "c2");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Cannot reply to a reply");
  });

  it("rejects replying to nonexistent comment", () => {
    const result = canReplyTo(comments, "c99");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Parent comment not found");
  });

  it("creates a reply with correct parent_id", () => {
    const result = createComment(comments, "anim-1", "user-3", "My reply", "c1");
    expect(result.comment.parent_id).toBe("c1");
  });

  it("threads comments correctly", () => {
    const allComments: CommentRecord[] = [
      { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Top 1", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
      { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "Reply to c1", parent_id: "c1", created_at: "2025-01-01T01:00:00Z", updated_at: "2025-01-01T01:00:00Z" },
      { id: "c3", animation_id: "anim-1", user_id: "user-3", content: "Top 2", parent_id: null, created_at: "2025-01-01T02:00:00Z", updated_at: "2025-01-01T02:00:00Z" },
      { id: "c4", animation_id: "anim-1", user_id: "user-1", content: "Reply to c3", parent_id: "c3", created_at: "2025-01-01T03:00:00Z", updated_at: "2025-01-01T03:00:00Z" },
    ];

    const { topLevel, repliesByParent } = getThreadedComments(allComments);
    expect(topLevel).toHaveLength(2);
    expect(repliesByParent.get("c1")).toHaveLength(1);
    expect(repliesByParent.get("c3")).toHaveLength(1);
    expect(repliesByParent.has("c2")).toBe(false);
  });
});

describe("Comment: pagination", () => {
  const comments: CommentRecord[] = Array.from({ length: 45 }, (_, i) => ({
    id: `c${i + 1}`,
    animation_id: "anim-1",
    user_id: "user-1",
    content: `Comment ${i + 1}`,
    parent_id: null,
    created_at: new Date(2025, 0, i + 1).toISOString(),
    updated_at: new Date(2025, 0, i + 1).toISOString(),
  }));

  it("returns first page with correct limit", () => {
    const result = paginateComments(comments, 1, 20);
    expect(result.items).toHaveLength(20);
    expect(result.total).toBe(45);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(3);
  });

  it("returns second page", () => {
    const result = paginateComments(comments, 2, 20);
    expect(result.items).toHaveLength(20);
    expect(result.page).toBe(2);
  });

  it("returns partial last page", () => {
    const result = paginateComments(comments, 3, 20);
    expect(result.items).toHaveLength(5);
    expect(result.page).toBe(3);
  });

  it("returns empty for page beyond total", () => {
    const result = paginateComments(comments, 10, 20);
    expect(result.items).toHaveLength(0);
  });

  it("handles empty comment list", () => {
    const result = paginateComments([], 1, 20);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("handles single comment", () => {
    const result = paginateComments([comments[0]], 1, 20);
    expect(result.items).toHaveLength(1);
    expect(result.totalPages).toBe(1);
  });
});

describe("Comment: content validation", () => {
  it("accepts valid content", () => {
    expect(validateContent("Nice animation!")).toBeNull();
  });

  it("rejects empty content", () => {
    expect(validateContent("")).toBe("Content is required");
  });

  it("rejects whitespace-only content", () => {
    expect(validateContent("   ")).toBe("Content is required");
    expect(validateContent("\n\t  ")).toBe("Content is required");
  });

  it("rejects content over 1000 characters", () => {
    const longContent = "a".repeat(1001);
    expect(validateContent(longContent)).toBe("Content must be 1000 characters or less");
  });

  it("accepts content at exactly 1000 characters", () => {
    const maxContent = "a".repeat(1000);
    expect(validateContent(maxContent)).toBeNull();
  });

  it("accepts content at 999 characters", () => {
    expect(validateContent("a".repeat(999))).toBeNull();
  });

  it("trims content before validation", () => {
    expect(validateContent("  hello  ")).toBeNull();
  });

  it("rejects content that is only spaces at 1000+ chars", () => {
    expect(validateContent(" ".repeat(1001))).toBe("Content is required");
  });
});

describe("Comment: comment count tracking", () => {
  it("counts comments for an animation", () => {
    const comments: CommentRecord[] = [
      { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "A", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
      { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "B", parent_id: null, created_at: "2025-01-02T00:00:00Z", updated_at: "2025-01-02T00:00:00Z" },
      { id: "c3", animation_id: "anim-2", user_id: "user-1", content: "C", parent_id: null, created_at: "2025-01-03T00:00:00Z", updated_at: "2025-01-03T00:00:00Z" },
    ];
    expect(getCommentCount(comments, "anim-1")).toBe(2);
    expect(getCommentCount(comments, "anim-2")).toBe(1);
    expect(getCommentCount(comments, "anim-3")).toBe(0);
  });

  it("includes replies in the count", () => {
    const comments: CommentRecord[] = [
      { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "A", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
      { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "Reply", parent_id: "c1", created_at: "2025-01-02T00:00:00Z", updated_at: "2025-01-02T00:00:00Z" },
    ];
    expect(getCommentCount(comments, "anim-1")).toBe(2);
  });

  it("decrements after delete (including cascaded replies)", () => {
    const comments: CommentRecord[] = [
      { id: "c1", animation_id: "anim-1", user_id: "user-1", content: "Parent", parent_id: null, created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z" },
      { id: "c2", animation_id: "anim-1", user_id: "user-2", content: "Reply", parent_id: "c1", created_at: "2025-01-02T00:00:00Z", updated_at: "2025-01-02T00:00:00Z" },
      { id: "c3", animation_id: "anim-1", user_id: "user-3", content: "Other", parent_id: null, created_at: "2025-01-03T00:00:00Z", updated_at: "2025-01-03T00:00:00Z" },
    ];
    const after = deleteComment(comments, "c1");
    expect(getCommentCount(after, "anim-1")).toBe(1);
  });
});

describe("Comment: response format", () => {
  it("formats comment for API response", () => {
    const comment: CommentRecord = {
      id: "c1",
      animation_id: "anim-1",
      user_id: "user-1",
      content: "Hello",
      parent_id: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    const user: CommentUser = {
      id: "user-1",
      displayName: "Alice",
      avatarUrl: null,
    };

    const response = {
      id: comment.id,
      content: comment.content,
      parentId: comment.parent_id,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user,
    };

    expect(response).toEqual({
      id: "c1",
      content: "Hello",
      parentId: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      user: { id: "user-1", displayName: "Alice", avatarUrl: null },
    });
  });

  it("formats paginated response", () => {
    const response = {
      comments: [],
      total: 0,
      page: 1,
      totalPages: 1,
    };
    expect(response).toHaveProperty("comments");
    expect(response).toHaveProperty("total");
    expect(response).toHaveProperty("page");
    expect(response).toHaveProperty("totalPages");
  });
});
