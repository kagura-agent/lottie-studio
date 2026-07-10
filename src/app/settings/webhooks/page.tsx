"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

const ALL_EVENTS = [
  "animation.created",
  "animation.updated",
  "animation.shared",
  "animation.commented",
  "animation.liked",
  "template.submitted",
  "template.approved",
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  format: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  deliveries?: Delivery[];
}

interface Delivery {
  id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  created_at: string;
}

export default function WebhooksSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedWebhook, setExpandedWebhook] = useState<Webhook | null>(null);

  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formFormat, setFormFormat] = useState("generic");
  const [formActive, setFormActive] = useState(true);
  const [error, setError] = useState("");

  const fetchWebhooks = useCallback(async () => {
    const res = await fetch("/api/webhooks");
    if (res.ok) {
      const data = await res.json();
      setWebhooks(data.webhooks);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/webhooks");
      if (res.ok && !cancelled) {
        const data = await res.json();
        setWebhooks(data.webhooks);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formUrl || formEvents.length === 0) {
      setError("URL and at least one event are required");
      return;
    }

    const body = { url: formUrl, events: formEvents, format: formFormat, active: formActive };

    if (editingId) {
      const res = await fetch(`/api/webhooks/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update");
        return;
      }
    } else {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        return;
      }
      const data = await res.json();
      setNewSecret(data.secret);
    }

    setShowForm(false);
    setEditingId(null);
    resetForm();
    fetchWebhooks();
  }

  function resetForm() {
    setFormUrl("");
    setFormEvents([]);
    setFormFormat("generic");
    setFormActive(true);
    setError("");
  }

  function startEdit(w: Webhook) {
    setEditingId(w.id);
    setFormUrl(w.url);
    setFormEvents(w.events);
    setFormFormat(w.format);
    setFormActive(w.active);
    setShowForm(true);
    setNewSecret(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    fetchWebhooks();
  }

  async function handleTest(id: string) {
    await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
    if (expandedId === id) loadDeliveries(id);
  }

  async function loadDeliveries(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedWebhook(null);
      return;
    }
    const res = await fetch(`/api/webhooks/${id}`);
    if (res.ok) {
      const data = await res.json();
      setExpandedId(id);
      setExpandedWebhook(data);
    }
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  if (loading || !user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Webhook Integrations</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); resetForm(); setNewSecret(null); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Add Webhook
        </button>
      </div>

      {newSecret && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="font-medium text-green-800 dark:text-green-200 mb-1">Webhook created! Save your secret — it won&apos;t be shown again:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-1 bg-white dark:bg-gray-800 rounded border text-sm font-mono">{newSecret}</code>
            <button
              onClick={() => navigator.clipboard.writeText(newSecret)}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg dark:border-gray-700">
          <h2 className="font-semibold mb-3">{editingId ? "Edit Webhook" : "New Webhook"}</h2>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

          <label className="block mb-3">
            <span className="text-sm font-medium">URL</span>
            <input
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="mt-1 block w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              required
            />
          </label>

          <fieldset className="mb-3">
            <legend className="text-sm font-medium mb-1">Events</legend>
            <div className="grid grid-cols-2 gap-1">
              {ALL_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  {event}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block mb-3">
            <span className="text-sm font-medium">Format</span>
            <select
              value={formFormat}
              onChange={(e) => setFormFormat(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="generic">Generic JSON</option>
              <option value="slack">Slack</option>
              <option value="discord">Discord</option>
            </select>
          </label>

          <label className="flex items-center gap-2 mb-4 text-sm">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
            />
            Active
          </label>

          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              {editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {webhooks.length === 0 && !showForm && (
          <p className="text-gray-500 text-center py-8">No webhooks configured. Add one to get started.</p>
        )}
        {webhooks.map((w) => (
          <div key={w.id} className="border rounded-lg dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${w.active ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="font-mono text-sm truncate max-w-md">{w.url}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{w.format}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleTest(w.id)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                  Test
                </button>
                <button onClick={() => startEdit(w)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                  Edit
                </button>
                <button onClick={() => handleDelete(w.id)} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">
                  Delete
                </button>
                <button onClick={() => loadDeliveries(w.id)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                  {expandedId === w.id ? "Hide" : "Logs"}
                </button>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {w.events.map((e) => (
                <span key={e} className="text-xs px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                  {e}
                </span>
              ))}
            </div>

            {expandedId === w.id && expandedWebhook?.deliveries && (
              <div className="mt-3 border-t pt-3 dark:border-gray-700">
                <h4 className="text-sm font-medium mb-2">Recent Deliveries</h4>
                {expandedWebhook.deliveries.length === 0 ? (
                  <p className="text-xs text-gray-500">No deliveries yet</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="pb-1">Event</th>
                        <th className="pb-1">Status</th>
                        <th className="pb-1">Result</th>
                        <th className="pb-1">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expandedWebhook.deliveries.map((d) => (
                        <tr key={d.id} className="border-t dark:border-gray-700">
                          <td className="py-1">{d.event}</td>
                          <td>{d.status_code ?? "—"}</td>
                          <td>
                            <span className={d.success ? "text-green-600" : "text-red-600"}>
                              {d.success ? "✓" : "✗"}
                            </span>
                          </td>
                          <td className="text-gray-500">{new Date(d.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
