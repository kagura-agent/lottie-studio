"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { getCreatorId } from "@/lib/creatorId";
import { useToast } from "@/contexts/ToastContext";

interface Collection {
  id: string;
  name: string;
  description: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface CollectionSidebarProps {
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onCollectionsLoaded?: (collections: Collection[]) => void;
}

export default function CollectionSidebar({
  selectedCollectionId,
  onSelectCollection,
  onCollectionsLoaded,
}: CollectionSidebarProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(() => !!getCreatorId());
  const [collapsed, setCollapsed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const creatorId = getCreatorId();
    if (!creatorId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/collections?creator_id=${encodeURIComponent(creatorId)}`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCollections(data);
          onCollectionsLoaded?.(data);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [onCollectionsLoaded, refreshKey]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);

    try {
      const creatorId = getCreatorId();
      const res = await apiFetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), creator_id: creatorId }),
      });

      if (res.ok) {
        toast({ message: "Collection created", type: "success" });
        setNewName("");
        setShowCreate(false);
        setRefreshKey((k) => k + 1);
      } else {
        const err = await res.json();
        toast({ message: err.error || "Failed to create", type: "error" });
      }
    } catch {
      toast({ message: "Failed to create collection", type: "error" });
    } finally {
      setCreating(false);
    }
  }, [newName, toast]);

  if (loading) {
    return (
      <div className="w-56 shrink-0 border-r border-zinc-800 p-4 hidden lg:block">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-zinc-800 rounded w-24" />
          <div className="h-8 bg-zinc-800 rounded" />
          <div className="h-8 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-zinc-800 hidden lg:flex flex-col items-center pt-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Expand collections"
          aria-label="Expand collections sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 border-r border-zinc-800 hidden lg:flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Collections
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Collapse"
          aria-label="Collapse collections sidebar"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Collection list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {/* All Animations */}
        <button
          onClick={() => onSelectCollection(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
            selectedCollectionId === null
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="truncate">All Animations</span>
          </div>
        </button>

        {collections.map((col) => (
          <button
            key={col.id}
            onClick={() => onSelectCollection(col.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
              selectedCollectionId === col.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="truncate flex-1">{col.name}</span>
              <span className="text-xs text-zinc-500">{col.item_count}</span>
            </div>
          </button>
        ))}
      </div>

      {/* New Collection */}
      <div className="px-3 pb-4 pt-2 border-t border-zinc-800">
        {showCreate ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) handleCreate();
                if (e.key === "Escape") {
                  setShowCreate(false);
                  setNewName("");
                }
              }}
              placeholder="Collection name..."
              aria-label="New collection name"
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              autoFocus
              disabled={creating}
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex-1 px-2 py-1 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-medium hover:bg-white transition-colors disabled:opacity-50"
              >
                {creating ? "..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
                className="px-2 py-1 rounded-lg text-zinc-400 text-xs hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Collection
          </button>
        )}
      </div>
    </div>
  );
}

export type { Collection };
