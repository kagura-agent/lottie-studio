"use client";

import { useState, useCallback } from "react";

interface FeedbackButtonsProps {
  messageId: string;
  animationId: string;
}

export default function FeedbackButtons({ messageId, animationId }: FeedbackButtonsProps) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = useCallback(async (newRating: 1 | -1, feedbackComment?: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          animationId,
          rating: newRating,
          ...(feedbackComment ? { comment: feedbackComment } : {}),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "removed") {
        setRating(null);
      } else {
        setRating(newRating);
      }
    } finally {
      setSubmitting(false);
    }
  }, [messageId, animationId]);

  const handleThumbUp = () => {
    if (submitting) return;
    setShowComment(false);
    submitFeedback(1);
  };

  const handleThumbDown = () => {
    if (submitting) return;
    if (rating === -1) {
      submitFeedback(-1);
      setShowComment(false);
    } else {
      setShowComment(true);
      submitFeedback(-1);
    }
  };

  const handleCommentSubmit = () => {
    if (!comment.trim()) return;
    submitFeedback(-1, comment.trim());
    setShowComment(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          onClick={handleThumbUp}
          disabled={submitting}
          className={`p-1 rounded transition-colors text-xs ${
            rating === 1
              ? "text-green-400 bg-green-400/10"
              : "text-zinc-500 hover:text-green-400 hover:bg-zinc-800"
          }`}
          aria-label="Thumbs up"
          title="Good response"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M2.09 15a1 1 0 0 0 1-1V8a1 1 0 1 0-2 0v6a1 1 0 0 0 1 1ZM5.765 13H4.09V8c.663 0 1.218-.466 1.556-.78a18.95 18.95 0 0 0 1.038-1.048 16.9 16.9 0 0 0 .907-1.058c.26-.34.587-.822.58-1.385-.005-.491-.17-1.084-.482-1.621A3.32 3.32 0 0 0 5.908.552a.75.75 0 0 0-.907.71c0 .216.032.468.097.727.047.187.104.378.158.553l.01.033c.054.176.104.338.137.466.063.239.077.38.053.497a.86.86 0 0 1-.247.398c-.088.083-.246.186-.535.186H2.59a1.5 1.5 0 0 0-1.478 1.242l-.015.088a27.4 27.4 0 0 0-.353 4.108c0 .673.018 1.322.065 1.942A1.5 1.5 0 0 0 2.298 13h3.467Z" />
            <path d="M12.09 13H8.09V8h4a1.5 1.5 0 0 0 1.478-1.242l.015-.088c.194-1.133.353-2.588.353-4.108 0-.673-.018-1.322-.065-1.942A1.5 1.5 0 0 0 12.382.13H8.765c-.688 0-1.218.466-1.556.78a18.95 18.95 0 0 0-1.038 1.048 16.9 16.9 0 0 0-.907 1.058c-.26.34-.587.822-.58 1.385.005.491.17 1.084.482 1.621A3.32 3.32 0 0 0 6.948 7.8V13h5.142a1.5 1.5 0 0 0 1.478-1.242l.015-.088c.068-.397.146-.88.217-1.421A1.5 1.5 0 0 0 12.312 9H12.09v4Z" />
          </svg>
        </button>
        <button
          onClick={handleThumbDown}
          disabled={submitting}
          className={`p-1 rounded transition-colors text-xs ${
            rating === -1
              ? "text-red-400 bg-red-400/10"
              : "text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
          }`}
          aria-label="Thumbs down"
          title="Bad response"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M13.91 1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V2a1 1 0 0 0-1-1ZM10.235 3h1.675v5c-.663 0-1.218.466-1.556.78a18.95 18.95 0 0 0-1.038 1.048 16.9 16.9 0 0 0-.907 1.058c-.26.34-.587.822-.58 1.385.005.491.17 1.084.482 1.621a3.32 3.32 0 0 0 1.781 1.476.75.75 0 0 0 .907-.71c0-.216-.032-.468-.097-.727a7.86 7.86 0 0 0-.158-.553l-.01-.033a7.62 7.62 0 0 1-.137-.466 1.13 1.13 0 0 1-.053-.497.86.86 0 0 1 .247-.398c.088-.083.246-.186.535-.186h2.5a1.5 1.5 0 0 0 1.478-1.242l.015-.088c.194-1.133.353-2.588.353-4.108 0-.673-.018-1.322-.065-1.942A1.5 1.5 0 0 0 13.702 3h-3.467Z" />
            <path d="M3.91 3h4V8h-4a1.5 1.5 0 0 1-1.478-1.242l-.015-.088A27.4 27.4 0 0 1 2.064 2.56c0-.673.018-1.322.065-1.942A1.5 1.5 0 0 1 3.618.13h3.617c.688 0 1.218.466 1.556.78.295.273.64.618 1.038 1.048.312.338.618.694.907 1.058.26.34.587.822.58 1.385-.005.491-.17 1.084-.482 1.621A3.32 3.32 0 0 1 9.052 7.8V3H3.91a1.5 1.5 0 0 1-1.478-1.242l-.015-.088A14.18 14.18 0 0 1 2.2 .249 1.5 1.5 0 0 1 3.688 3H3.91Z" />
          </svg>
        </button>
      </div>
      {showComment && rating === -1 && (
        <div className="flex gap-1 items-center">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
            placeholder="What went wrong?"
            className="text-xs bg-zinc-800 text-zinc-200 rounded px-2 py-1 border border-zinc-700 focus:outline-none focus:border-zinc-500 w-48"
            autoFocus
          />
          <button
            onClick={handleCommentSubmit}
            disabled={!comment.trim()}
            className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
