"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import AnimationCard from "@/components/AnimationCard";
import TemplateCard from "@/components/TemplateCard";
import HeroWelcome from "@/components/HeroWelcome";
import Link from "next/link";
import { parseLottieFile } from "@/lib/importLottie";

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc";

interface Animation {
  id: string;
  name: string;
  frame_count: number | null;
  duration_seconds: number | null;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  file: string;
}

export default function GalleryPage() {
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lottie-gallery-sort") as SortOption) || "newest";
    }
    return "newest";
  });
  const [heroDismissed, setHeroDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lottie-hero-dismissed") === "true";
    }
    return false;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);
  const router = useRouter();

  const handleHeroDismiss = useCallback(() => {
    localStorage.setItem("lottie-hero-dismissed", "true");
    setHeroDismissed(true);
  }, []);

  const filteredAndSortedAnimations = useMemo(() => {
    let result = animations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [animations, searchQuery, sortOption]);

  const handleSortChange = useCallback((value: SortOption) => {
    setSortOption(value);
    localStorage.setItem("lottie-gallery-sort", value);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/animations")
        .then((res) => res.json())
        .catch(() => []),
      fetch("/templates/index.json")
        .then((res) => res.json())
        .catch(() => []),
    ])
      .then(([animData, templateData]) => {
        setAnimations(animData);
        setTemplates(templateData);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/animations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setAnimations((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setImportError("Failed to delete animation");
      setTimeout(() => setImportError(null), 5000);
    }
  }, []);

  const handleDuplicate = useCallback(async (id: string) => {
    try {
      const dataRes = await fetch(`/api/animations/${id}`);
      if (!dataRes.ok) throw new Error("Failed to fetch animation");
      const { data, name } = await dataRes.json();
      const createRes = await fetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${name} (copy)`, data }),
      });
      if (!createRes.ok) throw new Error("Failed to duplicate");
      const newAnim = await createRes.json();
      router.push(`/editor/${newAnim.id}`);
    } catch {
      setImportError("Failed to duplicate animation");
      setTimeout(() => setImportError(null), 5000);
    }
  }, [router]);

  const handleImport = useCallback(async (file: File) => {
    setImportError(null);
    setImporting(true);
    try {
      const { name, data } = await parseLottieFile(file);
      const res = await fetch("/api/animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data }),
      });
      if (!res.ok) throw new Error("Failed to save animation");
      const anim = await res.json();
      router.push(`/editor/${anim.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setTimeout(() => setImportError(null), 5000);
    } finally {
      setImporting(false);
    }
  }, [router]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = "";
  }, [handleImport]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current--;
    if (dragCountRef.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImport(file);
  }, [handleImport]);

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) return;

    setImportError(null);
    setImportingUrl(true);
    try {
      const res = await fetch("/api/animations/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to import from URL");
      }

      const { id } = await res.json();
      router.push(`/editor/${id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setTimeout(() => setImportError(null), 5000);
    } finally {
      setImportingUrl(false);
    }
  }, [urlInput, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Import error alert */}
        {importError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 text-sm">
            {importError}
          </div>
        )}

        {/* Hero welcome for first-time visitors */}
        {animations.length === 0 && !heroDismissed && (
          <HeroWelcome onDismiss={handleHeroDismiss} />
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-100">
                {animations.length > 0 ? "Animations" : "Get Started"}
              </h1>
              {animations.length > 0 && (
                <p className="text-sm text-zinc-400 mt-1">
                  {animations.length} animation
                  {animations.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.lottie"
                className="hidden"
                onChange={handleFileChange}
              />
              <Link
                href="/explore"
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Explore
              </Link>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import"}
              </button>
              <button
                onClick={() => {
                  setShowUrlImport(!showUrlImport);
                  if (!showUrlImport) {
                    setUrlInput("");
                    setImportError(null);
                  }
                }}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Import URL
              </button>
              <Link
                href="/editor/new"
                className="px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Create Animation
              </Link>
            </div>
          </div>

          {/* URL Import Input */}
          {showUrlImport && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !importingUrl) {
                      handleUrlImport();
                    }
                  }}
                  placeholder="https://example.com/animation.json"
                  disabled={importingUrl}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleUrlImport}
                  disabled={!urlInput.trim() || importingUrl}
                  className="px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importingUrl ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Templates Section */}
        {templates.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                <h2 className="text-lg font-medium text-zinc-200">
                  Templates
                </h2>
              </div>
              <span className="text-xs text-zinc-500">
                Pick a starter and remix it with chat
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.id}
                  id={tmpl.id}
                  name={tmpl.name}
                  description={tmpl.description}
                  category={tmpl.category}
                  file={tmpl.file}
                />
              ))}
            </div>
          </div>
        )}

        {/* User Animations Section */}
        {animations.length > 0 && (
          <>
            {templates.length > 0 && (
              <div className="border-t border-zinc-800 my-8" />
            )}
            <div className="mb-4">
              <h2 className="text-lg font-medium text-zinc-200">
                Your Animations
              </h2>
            </div>
            {/* Search and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search animations..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
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
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
              </select>
            </div>
            {filteredAndSortedAnimations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAndSortedAnimations.map((anim) => (
                  <AnimationCard
                    key={anim.id}
                    id={anim.id}
                    name={anim.name}
                    frameCount={anim.frame_count}
                    durationSeconds={anim.duration_seconds}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-500">
                  No animations match your search
                </p>
              </div>
            )}
          </>
        )}

        {/* Empty state for no user animations (templates still visible above) */}
        {animations.length === 0 && templates.length > 0 && (
          <>
            <div className="border-t border-zinc-800 my-8" />
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">
                Pick a template above to get started, or{" "}
                <Link
                  href="/editor/new"
                  className="text-zinc-300 underline hover:text-white transition-colors"
                >
                  create from scratch
                </Link>
              </p>
            </div>
          </>
        )}

        {/* Fallback if everything is empty */}
        {animations.length === 0 && templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-zinc-500"
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
              <h2 className="text-xl font-semibold text-zinc-100">
                No animations yet
              </h2>
              <p className="text-sm text-zinc-400 max-w-sm">
                Get started by creating your first Lottie animation in the
                editor.
              </p>
            </div>
            <Link
              href="/editor/new"
              className="px-5 py-2.5 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              Create Animation
            </Link>
          </div>
        )}
      </div>

      {/* Drag-and-drop overlay */}
      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-zinc-500 px-16 py-12 text-center">
            <svg
              className="w-12 h-12 text-zinc-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-lg font-medium text-zinc-200">
              Drop .json or .lottie file to import
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              Lottie animation files only
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
