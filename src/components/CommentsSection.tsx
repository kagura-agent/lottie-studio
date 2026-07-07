"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface CommentUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: CommentUser;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function UserAvatar({ user, size = "sm" }: { user: CommentUser; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  const initial = (user.displayName || "?")[0].toUpperCase();

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 font-medium`}>
      {initial}
    </div>
  );
}

function CommentInput({
  onSubmit,
  placeholder,
  autoFocus,
  initialValue = "",
  submitLabel = "Post",
  onCancel,
}: {
  onSubmit: (content: string) => Promise<void>;
  placeholder: string;
  autoFocus?: boolean;
  initialValue?: string;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={1000}
        rows={1}
        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500 transition-colors"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{value.length}/1000</span>
        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || submitting}
            className="px-3 py-1 rounded-md bg-zinc-100 text-zinc-900 text-xs font-medium hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Posting..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SingleComment({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  isReply,
}: {
  comment: Comment;
  currentUserId: string | null;
  onReply: (parentId: string) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
  isReply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const isOwner = currentUserId === comment.user.id;
  const wasEdited = comment.updatedAt !== comment.createdAt;

  const handleEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setEditing(false);
  };

  return (
    <div className={`flex gap-2.5 ${isReply ? "ml-9" : ""}`}>
      <UserAvatar user={comment.user} size={isReply ? "sm" : "md"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">
            {comment.user.displayName || "Anonymous"}
          </span>
          <span className="text-xs text-zinc-500">{relativeTime(comment.createdAt)}</span>
          {wasEdited && <span className="text-xs text-zinc-600">(edited)</span>}
        </div>
        {editing ? (
          <div className="mt-1">
            <CommentInput
              onSubmit={handleEdit}
              placeholder="Edit your comment..."
              initialValue={comment.content}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              autoFocus
            />
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-zinc-300 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}
        {!editing && (
          <div className="mt-1 flex items-center gap-3">
            {!isReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Reply
              </button>
            )}
            {isOwner && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentsSection({ animationId }: { animationId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const fetchComments = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/animations/${animationId}/comments?page=${p}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [animationId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/animations/${animationId}/comments?page=1&limit=20`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setComments(data.comments);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [animationId]);

  const handlePost = async (content: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/animations/${animationId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      await fetchComments(1);
    }
  };

  const handleReply = async (content: string, parentId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/animations/${animationId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId }),
    });
    if (res.ok) {
      setReplyingTo(null);
      await fetchComments(page);
    }
  };

  const handleEdit = async (id: string, content: string) => {
    const res = await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      await fetchComments(page);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchComments(page);
    }
  };

  const topLevel = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const reply of replies) {
    const arr = repliesByParent.get(reply.parentId!) || [];
    arr.push(reply);
    repliesByParent.set(reply.parentId!, arr);
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 pb-8">
      <h2 className="text-zinc-100 text-base font-semibold mb-4 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Comments
        {total > 0 && <span className="text-zinc-500 text-sm font-normal">({total})</span>}
      </h2>

      {user ? (
        <div className="mb-6">
          <CommentInput
            onSubmit={handlePost}
            placeholder="Add a comment..."
          />
        </div>
      ) : (
        <button
          onClick={() => router.push("/login")}
          className="mb-6 w-full py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          Log in to comment
        </button>
      )}

      {loading && comments.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm">
          No comments yet. Be the first!
        </div>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <SingleComment
                comment={comment}
                currentUserId={user?.id ?? null}
                onReply={(parentId) => setReplyingTo(replyingTo === parentId ? null : parentId)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {(repliesByParent.get(comment.id) || []).map((reply) => (
                <div key={reply.id} className="mt-3">
                  <SingleComment
                    comment={reply}
                    currentUserId={user?.id ?? null}
                    onReply={() => setReplyingTo(comment.id)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isReply
                  />
                </div>
              ))}
              {replyingTo === comment.id && (
                <div className="mt-3 ml-9">
                  <CommentInput
                    onSubmit={(content) => handleReply(content, comment.id)}
                    placeholder={`Reply to ${comment.user.displayName || "Anonymous"}...`}
                    autoFocus
                    onCancel={() => setReplyingTo(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => fetchComments(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => fetchComments(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
