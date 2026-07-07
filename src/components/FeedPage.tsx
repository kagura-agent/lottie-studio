"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserMenu from "@/components/auth/UserMenu";
import ExploreCard from "@/components/ExploreCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";

interface FeedAnimation {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  frame_count: number | null;
  layer_count: number | null;
  w: number | null;
  h: number | null;
  tags: string | null;
  view_count?: number;
  like_count?: number;
  creator_id?: string | null;
  creation_prompt?: string | null;
  remix_count?: number;
  remixed_from?: string | null;
  remixed_from_name?: string | null;
  comment_count?: number;
  creator_name?: string | null;
}

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [animations, setAnimations] = useState<FeedAnimation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { favorites, toggleFavorite } = useFavorites();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const fetchFeed = useCallback(
    async (p: number, mode: "replace" | "append" = "replace") => {
      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetch(`/api/feed?page=${p}&limit=24`);
        if (!res.ok) return;
        const data = await res.json();
        if (mode === "append") {
          setAnimations((prev) => [...prev, ...data.animations]);
        } else {
          setAnimations(data.animations);
        }
        setPage(p);
        setTotalPages(data.totalPages);
      } catch {
        // ignore
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    if (user) fetchFeed(1);
  }, [user, fetchFeed]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && page < totalPages) {
          fetchFeed(page + 1, "append");
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [page, totalPages, loadingMore, fetchFeed]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-100">Feed</h1>
              <p className="text-sm text-zinc-400 mt-1">
                New animations from creators you follow
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Gallery
              </Link>
              <Link
                href="/explore"
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Explore
              </Link>
              <LanguageSwitcher />
              <UserMenu />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
              >
                <div className="aspect-square bg-zinc-800 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : animations.length === 0 ? (
          <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="w-12 h-12 mx-auto text-zinc-500 mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-zinc-300 mb-2">
              Follow creators to see their work here!
            </h3>
            <p className="text-sm text-zinc-500 mb-6">
              Discover animations and follow the creators you enjoy.
            </p>
            <Link
              href="/explore"
              className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Explore animations
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {animations.map((anim) => (
                <ExploreCard
                  key={anim.id}
                  animation={anim}
                  isFavorite={favorites.has(anim.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
