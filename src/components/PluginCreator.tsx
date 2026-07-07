"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

const CATEGORIES = ["transition", "effect", "generator", "modifier", "utility"];

export default function PluginCreator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("effect");
  const [version, setVersion] = useState("1.0.0");
  const [code, setCode] = useState(
    `function transform(animation, config) {\n  // Modify and return the animation JSON\n  return animation;\n}`
  );
  const [configSchema, setConfigSchema] = useState("{}");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      toast({ message: "Please log in to publish plugins", type: "error" });
      return;
    }

    let parsedSchema;
    try {
      parsedSchema = JSON.parse(configSchema);
    } catch {
      toast({ message: "Invalid config schema JSON", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          category,
          version,
          code,
          config_schema: parsedSchema,
        }),
      });

      if (res.ok) {
        toast({ message: "Plugin published successfully!", type: "success" });
        setName("");
        setDescription("");
        setCode(`function transform(animation, config) {\n  // Modify and return the animation JSON\n  return animation;\n}`);
        setConfigSchema("{}");
      } else {
        const data = await res.json();
        toast({ message: data.error || "Failed to publish plugin", type: "error" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold text-zinc-300">Publish a Plugin</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">Version</label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Transform Code</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={8}
          spellCheck={false}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Config Schema (JSON)</label>
        <textarea
          value={configSchema}
          onChange={(e) => setConfigSchema(e.target.value)}
          rows={3}
          spellCheck={false}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim() || !code.trim()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Publishing..." : "Publish Plugin"}
      </button>
    </form>
  );
}
