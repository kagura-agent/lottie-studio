"use client";

import { useEffect, useState } from "react";

interface Submission {
  id: string;
  animation_id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string | null;
  status: string;
  reviewer_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  animation_name: string;
}

export default function AdminTemplatesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function fetchSubmissions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/submissions?status=${filter}`, {
        headers: { "X-Admin-Token": token },
      });
      if (res.ok) {
        setSubmissions(await res.json());
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void (async () => { await fetchSubmissions(); })();
    }
  }, [filter]);

  async function handleReview(id: string, status: "approved" | "rejected") {
    await fetch(`/api/templates/submissions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": token,
      },
      body: JSON.stringify({ status, reviewerNotes: notes[id] || undefined }),
    });
    fetchSubmissions();
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-80">
          <h1 className="text-lg font-semibold text-zinc-100 mb-4">Admin Access</h1>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm mb-3 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={fetchSubmissions}
            className="w-full px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">Template Submissions</h1>

        <div className="flex gap-2 mb-6">
          {["pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s
                  ? "bg-zinc-100 text-zinc-900"
                  : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : submissions.length === 0 ? (
          <p className="text-zinc-500">No {filter} submissions.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-zinc-100 font-medium">{sub.title}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{sub.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-zinc-500">
                      <span>Animation: {sub.animation_name}</span>
                      {sub.category && <span className="px-2 py-0.5 rounded-full bg-zinc-800">{sub.category}</span>}
                      {sub.tags && sub.tags.split(",").map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-zinc-800">{t.trim()}</span>
                      ))}
                      <span>Submitted: {new Date(sub.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      sub.status === "pending"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : sub.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                {sub.status === "pending" && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <textarea
                      value={notes[sub.id] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [sub.id]: e.target.value }))}
                      placeholder="Reviewer notes (optional)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm mb-3 resize-none focus:outline-none focus:border-zinc-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(sub.id, "approved")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(sub.id, "rejected")}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {sub.reviewer_notes && (
                  <p className="mt-3 text-sm text-zinc-400 italic">Note: {sub.reviewer_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
