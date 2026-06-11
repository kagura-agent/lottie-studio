"use client";

import { useState, useEffect, useCallback } from "react";

interface Version {
  id: number;
  version_num: number;
  trigger_message: string | null;
  created_at: string;
}

interface VersionHistoryProps {
  animationId: string;
  open: boolean;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z"); // SQLite stores UTC without Z
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function VersionHistory({ animationId, open, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/animations/${animationId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [animationId]);

  useEffect(() => {
    if (open) fetchVersions();
  }, [open, fetchVersions]);

  const handleRestore = async (versionNum: number) => {
    setRestoring(versionNum);
    try {
      const res = await fetch(`/api/animations/${animationId}/versions/${versionNum}`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchVersions();
      }
    } catch {
      // ignore
    } finally {
      setRestoring(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-zinc-900 border-l border-zinc-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">Version History</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && versions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
              Loading...
            </div>
          ) : versions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm px-4 text-center">
              No versions yet. Versions are created when the AI modifies your animation.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  className={`px-4 py-3 ${idx === 0 ? "bg-zinc-800/50" : "hover:bg-zinc-800/30"} transition-colors`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-400">v{v.version_num}</span>
                        {idx === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      {v.trigger_message && (
                        <p className="text-sm text-zinc-300 mt-1 line-clamp-2">
                          {v.trigger_message}
                        </p>
                      )}
                      <p className="text-xs text-zinc-500 mt-1">
                        {timeAgo(v.created_at)}
                      </p>
                    </div>
                    {idx !== 0 && (
                      <button
                        onClick={() => handleRestore(v.version_num)}
                        disabled={restoring !== null}
                        className="shrink-0 px-2.5 py-1 rounded text-xs font-medium border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {restoring === v.version_num ? "..." : "Restore"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
