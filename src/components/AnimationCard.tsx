"use client";

import { useEffect, useRef, useState } from "react";
import lottie, { AnimationItem } from "lottie-web";
import { useRouter } from "next/navigation";

interface AnimationCardProps {
  id: string;
  name: string;
  frameCount: number | null;
  durationSeconds: number | null;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export default function AnimationCard({
  id,
  name,
  frameCount,
  durationSeconds,
  onDelete,
  onDuplicate,
}: AnimationCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    fetch(`/api/animations/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !containerRef.current || !json.data) return;

        try {
          animRef.current = lottie.loadAnimation({
            container: containerRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: json.data,
          });
          setLoaded(true);
        } catch {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [id]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const duration =
    durationSeconds != null ? `${durationSeconds.toFixed(1)}s` : "—";
  const frames = frameCount != null ? `${frameCount} frames` : "—";

  return (
    <>
      <div
        onClick={() => router.push(`/editor/${id}`)}
        className="group block rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-zinc-900/50 cursor-pointer"
      >
        <div
          className="relative aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        >
          <div ref={containerRef} className="w-full h-full p-4" />
          {!loaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
              Failed to load
            </div>
          )}

          {/* Overflow menu button */}
          {(onDelete || onDuplicate) && (
            <div ref={menuRef} className="absolute top-2 right-2 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="w-8 h-8 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Animation actions"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute top-10 right-0 w-40 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl shadow-black/50 py-1 z-20">
                  {onDuplicate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onDuplicate(id);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 17.1c0 1.326-1.074 2.4-2.4 2.4H5.4A2.4 2.4 0 013 17.1V8.7a2.4 2.4 0 012.4-2.4h1.2m4.8-2.4h5.4A2.4 2.4 0 0119.2 6.3v8.4a2.4 2.4 0 01-2.4 2.4h-8.4a2.4 2.4 0 01-2.4-2.4V6.3a2.4 2.4 0 012.4-2.4z" />
                      </svg>
                      Duplicate
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        setConfirmingDelete(true);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 hover:text-red-300 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
            {name}
          </h3>
          <div className="mt-1 flex gap-3 text-xs text-zinc-500">
            <span>{duration}</span>
            <span>{frames}</span>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmingDelete(false);
          }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Delete animation?</h3>
            <p className="mt-2 text-sm text-zinc-400">
              &ldquo;{name}&rdquo; and its chat history will be permanently deleted. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete?.(id);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
