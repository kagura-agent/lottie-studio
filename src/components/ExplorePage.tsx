"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import ExploreCard from "@/components/ExploreCard";

interface ExploreAnimation {
  id: string;
  name: string;
  created_at: string;
  frame_count: number | null;
  layer_count: number | null;
  w: number | null;
  h: number | null;
}

interface ExploreResponse {
  animations: ExploreAnimation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ExplorePage() {
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchAnimations = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/animations/explore?page=${p}&limit=24`);
      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many requests. Please wait a moment and try again.");
          return;
        }
        throw new Error("Failed to fetch animations");
      }
      const json: ExploreResponse = await res.json();
      setData(json);
      setPage(p);
    } catch {
      setError("Failed to load animations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnimations(1);
  }, [fetchAnimations]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-100">Explore</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Discover animations created by the community
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Back to Gallery
              </Link>
              <Link
                href="/editor/new"
                className="px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Create your own
              </Link>
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-zinc-800" />
                <div className="p-4">
                  <div className="h-4 bg-zinc-800 rounded w-3/4" />
                  <div className="mt-2 h-3 bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-zinc-400 mb-4">{error}</p>
            <button
              onClick={() => fetchAnimations(page)}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.animations.length === 0 && (
          <div className="text-center py-16">
            <div className="text-zinc-500 mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-zinc-300 mb-2">
              No shared animations yet
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Be the first to share an animation with the community!
            </p>
            <Link
              href="/editor/new"
              className="inline-block px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              Create your own
            </Link>
          </div>
        )}

        {/* Animation grid */}
        {!loading && !error && data && data.animations.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.animations.map((anim) => (
                <ExploreCard key={anim.id} animation={anim} />
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => fetchAnimations(page - 1)}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-400">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  onClick={() => fetchAnimations(page + 1)}
                  disabled={page >= data.totalPages}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
