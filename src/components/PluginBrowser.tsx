"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Plugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author_name: string | null;
  category: string;
  downloads: number;
  created_at: string;
}

const CATEGORIES = ["all", "transition", "effect", "generator", "modifier", "utility"];

export default function PluginBrowser() {
  const { user } = useAuth();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPlugins = useCallback(async () => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`/api/plugins?${params}`);
    if (res.ok) {
      setPlugins(await res.json());
    }
    setLoading(false);
  }, [category, search]);

  const fetchInstalled = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/users/me/plugins");
    if (res.ok) {
      const list = await res.json();
      setInstalledIds(new Set(list.map((p: Plugin) => p.id)));
    }
  }, [user]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  async function handleInstall(slug: string, pluginId: string) {
    const res = await fetch(`/api/plugins/${slug}/install`, { method: "POST" });
    if (res.ok) {
      setInstalledIds((prev) => new Set(prev).add(pluginId));
      fetchPlugins();
    }
  }

  async function handleUninstall(slug: string, pluginId: string) {
    const res = await fetch(`/api/plugins/${slug}/install`, { method: "DELETE" });
    if (res.ok) {
      setInstalledIds((prev) => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search plugins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === cat
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-zinc-500">Loading plugins...</div>
      ) : plugins.length === 0 ? (
        <div className="py-8 text-center text-zinc-500">No plugins found</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-zinc-100">{plugin.name}</h3>
                  <p className="text-xs text-zinc-500">
                    v{plugin.version} by {plugin.author_name || "Unknown"}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                  {plugin.category}
                </span>
              </div>
              <p className="flex-1 text-sm text-zinc-400">{plugin.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {plugin.downloads} downloads
                </span>
                {user && (
                  installedIds.has(plugin.id) ? (
                    <button
                      onClick={() => handleUninstall(plugin.slug, plugin.id)}
                      className="rounded-md bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                    >
                      Uninstall
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstall(plugin.slug, plugin.id)}
                      className="rounded-md bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500"
                    >
                      Install
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
