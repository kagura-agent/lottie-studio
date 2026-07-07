"use client";

import { useState, useEffect, useCallback } from "react";

interface InstalledPlugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  enabled: number;
  installed_at: string;
}

export default function PluginManager() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInstalled = useCallback(async () => {
    const res = await fetch("/api/users/me/plugins");
    if (res.ok) {
      setPlugins(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  async function handleUninstall(slug: string) {
    const res = await fetch(`/api/plugins/${slug}/install`, { method: "DELETE" });
    if (res.ok) {
      setPlugins((prev) => prev.filter((p) => p.slug !== slug));
    }
  }

  if (loading) {
    return <div className="p-4 text-zinc-500">Loading installed plugins...</div>;
  }

  if (plugins.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500">
        No plugins installed. Browse the plugin registry to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <h2 className="text-sm font-semibold text-zinc-300">Installed Plugins</h2>
      {plugins.map((plugin) => (
        <div
          key={plugin.id}
          className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3"
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100">{plugin.name}</span>
              <span className="text-xs text-zinc-500">v{plugin.version}</span>
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                {plugin.category}
              </span>
            </div>
            <p className="text-xs text-zinc-500">{plugin.description}</p>
          </div>
          <button
            onClick={() => handleUninstall(plugin.slug)}
            className="ml-4 shrink-0 rounded-md bg-red-900/30 px-3 py-1 text-xs text-red-400 hover:bg-red-900/50"
          >
            Uninstall
          </button>
        </div>
      ))}
    </div>
  );
}
