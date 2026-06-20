"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import ExploreCard from "@/components/ExploreCard";

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "most-viewed";

interface ExploreAnimation {
  id: string;
  name: string;
  created_at: string;
  frame_count: number | null;
  layer_count: number | null;
  w: number | null;
  h: number | null;
  tags: string | null;
  view_count?: number;
}

interface ExploreResponse {
  animations: ExploreAnimation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  tagCounts: Record<string, number>;
}

const TAG_ORDER = [
  "loading", "text", "logo", "icon", "nature", "abstract",
  "geometric", "character", "transition", "ui-element",
  "celebration", "notification",
];

export default function ExplorePage() {
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [activeTag, setActiveTag] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("tag") || "";
    }
    return "";
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAnimations = useCallback(async (p: number, q: string, sort: SortOption, tag?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "24", sort });
      if (q) params.set("q", q);
      if (tag) params.set("tag", tag);
      const res = await fetch(`/api/animations/explore?${params}`);
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
    let cancelled = false;

    const load = async () => {
      setError(null);
      try {
        const params = new URLSearchParams({ page: "1", limit: "24", sort: sortOption });
        if (activeTag) params.set("tag", activeTag);
        const res = await fetch(`/api/animations/explore?${params}`);
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 429) {
            setError("Too many requests. Please wait a moment and try again.");
            return;
          }
          throw new Error("Failed to fetch animations");
        }
        const json: ExploreResponse = await res.json();
        setData(json);
        setPage(1);
      } catch {
        if (!cancelled) setError("Failed to load animations. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [sortOption, activeTag]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchAnimations(1, value, sortOption, activeTag);
    }, 300);
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
    setPage(1);
    fetchAnimations(1, searchQuery, value, activeTag);
  };

  const handleTagChange = (tag: string) => {
    const newTag = tag === activeTag ? "" : tag;
    setActiveTag(newTag);
    setPage(1);
    fetchAnimations(1, searchQuery, sortOption, newTag);
    // URL sync
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (newTag) {
        url.searchParams.set("tag", newTag);
      } else {
        url.searchParams.delete("tag");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

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

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search animations..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={sortOption}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most-viewed">Most viewed</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        </div>

        {/* Category filter chips */}
        {data?.tagCounts && Object.keys(data.tagCounts).length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            <button
              onClick={() => handleTagChange("")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTag === ""
                  ? "bg-white text-zinc-900"
                  : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              All
            </button>
            {TAG_ORDER.filter((t) => (data.tagCounts[t] ?? 0) > 0).map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagChange(tag)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTag === tag
                    ? "bg-white text-zinc-900"
                    : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1)} ({data.tagCounts[tag]})
              </button>
            ))}
          </div>
        )}

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
              onClick={() => fetchAnimations(page, searchQuery, sortOption, activeTag)}
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
            {searchQuery ? (
              <>
                <h2 className="text-lg font-medium text-zinc-300 mb-2">
                  No results found
                </h2>
                <p className="text-sm text-zinc-500 mb-6">
                  Try a different search term
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
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
                  onClick={() => fetchAnimations(page - 1, searchQuery, sortOption, activeTag)}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-400">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  onClick={() => fetchAnimations(page + 1, searchQuery, sortOption, activeTag)}
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
