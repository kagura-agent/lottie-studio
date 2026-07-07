"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Collaboration {
  id: string;
  token: string;
  permission: string;
  expiresAt: string;
  memberCount: number;
}

interface CollaborateDialogProps {
  animationId: string;
  open: boolean;
  onClose: () => void;
}

export default function CollaborateDialog({ animationId, open, onClose }: CollaborateDialogProps) {
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [permission, setPermission] = useState<"edit" | "view">("edit");
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchCollaborations = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/animations/${animationId}/collaborate`);
      if (res.ok) {
        const data = await res.json();
        setCollaborations(data.collaborations);
      }
    } catch {
      // ignore fetch errors
    }
  }, [animationId]);

  useEffect(() => {
    if (open) {
      fetchCollaborations();
    }
  }, [open, fetchCollaborations]);

  const createLink = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/animations/${animationId}/collaborate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission }),
      });
      if (res.ok) {
        await fetchCollaborations();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const revokeLink = async (token: string) => {
    try {
      await apiFetch(`/api/animations/${animationId}/collaborate/${token}`, {
        method: "DELETE",
      });
      setCollaborations((prev) => prev.filter((c) => c.token !== token));
    } catch {
      // ignore
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/editor/${animationId}?collab=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Collaborate</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="flex gap-2 mb-4">
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as "edit" | "view")}
            className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="edit">Can Edit</option>
            <option value="view">View Only</option>
          </select>
          <button
            onClick={createLink}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Link"}
          </button>
        </div>

        {collaborations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Active Links</h3>
            {collaborations.map((collab) => (
              <div
                key={collab.id}
                className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      collab.permission === "edit"
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-zinc-600/30 text-zinc-300"
                    }`}>
                      {collab.permission === "edit" ? "Edit" : "View"}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {collab.memberCount} member{collab.memberCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => copyLink(collab.token)}
                    className="text-zinc-400 hover:text-white p-1 rounded text-xs"
                    title="Copy link"
                  >
                    {copiedToken === collab.token ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => revokeLink(collab.token)}
                    className="text-zinc-500 hover:text-red-400 p-1 rounded text-xs"
                    title="Revoke"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {collaborations.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-4">
            No active collaboration links. Create one to invite others.
          </p>
        )}
      </div>
    </div>
  );
}
