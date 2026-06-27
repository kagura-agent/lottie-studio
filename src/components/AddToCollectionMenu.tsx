"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { getCreatorId } from "@/lib/creatorId";
import { useToast } from "@/contexts/ToastContext";

interface Collection {
  id: string;
  name: string;
  item_count: number;
}

interface AddToCollectionMenuProps {
  animationId: string;
  onClose: () => void;
}

export default function AddToCollectionMenu({
  animationId,
  onClose,
}: AddToCollectionMenuProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(() => !!getCreatorId());
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Fetch collections and determine which ones contain this animation
  useEffect(() => {
    const creatorId = getCreatorId();
    if (!creatorId) {
      return;
    }

    fetch(`/api/collections?creator_id=${encodeURIComponent(creatorId)}`)
      .then((res) => res.json())
      .then(async (cols: Collection[]) => {
        setCollections(cols);

        // Check which collections contain this animation
        const inCollections = new Set<string>();
        for (const col of cols) {
          try {
            const res = await fetch(`/api/collections/${col.id}`);
            if (res.ok) {
              const data = await res.json();
              const animations = data.animations || [];
              if (animations.some((a: { id: string }) => a.id === animationId)) {
                inCollections.add(col.id);
              }
            }
          } catch {
            // skip
          }
        }
        setMemberOf(inCollections);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [animationId]);

  const toggleCollection = useCallback(
    async (collectionId: string) => {
      const isIn = memberOf.has(collectionId);

      try {
        if (isIn) {
          // Remove from collection
          const res = await apiFetch(
            `/api/collections/${collectionId}/items/${animationId}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            setMemberOf((prev) => {
              const next = new Set(prev);
              next.delete(collectionId);
              return next;
            });
            toast({ message: "Removed from collection", type: "info" });
          }
        } else {
          // Add to collection
          const res = await apiFetch(
            `/api/collections/${collectionId}/items`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ animationIds: [animationId] }),
            }
          );
          if (res.ok) {
            setMemberOf((prev) => new Set(prev).add(collectionId));
            toast({ message: "Added to collection", type: "success" });
          }
        }
      } catch {
        toast({ message: "Failed to update collection", type: "error" });
      }
    },
    [animationId, memberOf, toast]
  );

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
        const col = await res.json();
        // Add animation to the new collection
        await apiFetch(`/api/collections/${col.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ animationIds: [animationId] }),
        });

        setCollections((prev) => [...prev, { ...col, item_count: 1 }]);
        setMemberOf((prev) => new Set(prev).add(col.id));
        setNewName("");
        setShowCreate(false);
        toast({ message: "Collection created & animation added", type: "success" });
      }
    } catch {
      toast({ message: "Failed to create collection", type: "error" });
    } finally {
      setCreating(false);
    }
  }, [newName, animationId, toast]);

  return (
    <div
      ref={menuRef}
      className="absolute top-10 right-0 w-56 rounded-xl bg-zinc-800 border border-zinc-700 shadow-xl shadow-black/50 z-30 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-zinc-700">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Add to Collection
        </h4>
      </div>

      <div className="max-h-48 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 text-center">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto" />
          </div>
        ) : collections.length === 0 && !showCreate ? (
          <div className="px-3 py-3 text-xs text-zinc-500 text-center">
            No collections yet
          </div>
        ) : (
          collections.map((col) => (
            <button
              key={col.id}
              onClick={() => toggleCollection(col.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  memberOf.has(col.id)
                    ? "bg-zinc-100 border-zinc-100"
                    : "border-zinc-600"
                }`}
              >
                {memberOf.has(col.id) && (
                  <svg className="w-3 h-3 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="truncate">{col.name}</span>
            </button>
          ))
        )}
      </div>

      {/* Create new collection */}
      <div className="border-t border-zinc-700 px-3 py-2">
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
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-600 bg-zinc-900 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              autoFocus
              disabled={creating}
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex-1 px-2 py-1 rounded text-xs bg-zinc-100 text-zinc-900 font-medium hover:bg-white disabled:opacity-50"
              >
                {creating ? "..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
                className="px-2 py-1 rounded text-xs text-zinc-400 hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create new collection
          </button>
        )}
      </div>
    </div>
  );
}
