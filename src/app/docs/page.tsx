"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import lottie, { AnimationItem } from "lottie-web";
import LanguageSwitcher from '@/components/LanguageSwitcher';

// --- Types ---

interface GenerateResponse {
  success: boolean;
  animation?: Record<string, unknown>;
  description?: string;
  error?: string;
}

// --- Syntax Highlighting ---

function JsonHighlight({ code }: { code: string }) {
  const highlighted = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(?:\\.|[^"\\])*")\s*:/g,
      '<span class="text-indigo-400">$1</span>:'
    )
    .replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ': <span class="text-emerald-400">$1</span>'
    )
    .replace(
      /:\s*(true|false|null)/g,
      ': <span class="text-amber-400">$1</span>'
    )
    .replace(
      /:\s*(\d+\.?\d*)/g,
      ': <span class="text-orange-400">$1</span>'
    );

  return (
    <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono leading-relaxed">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  );
}

// --- Method Badge ---

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const colors =
    method === "GET"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${colors}`}
    >
      {method}
    </span>
  );
}

// --- Collapsible Section ---

function EndpointSection({
  method,
  path,
  title,
  children,
  defaultOpen = false,
}: {
  method: "GET" | "POST";
  path: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <MethodBadge method={method} />
        <code className="text-sm text-zinc-200 font-mono">{path}</code>
        <span className="ml-auto text-sm text-zinc-500">{title}</span>
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-zinc-800/50 pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// --- Try It Panel ---

function TryItPanel() {
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState<string>("512");
  const [height, setHeight] = useState<string>("512");
  const [duration, setDuration] = useState<string>("2");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    // Clean up previous animation
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }

    try {
      const body: Record<string, unknown> = { prompt: prompt.trim() };
      const w = parseInt(width);
      const h = parseInt(height);
      const d = parseFloat(duration);
      if (!isNaN(w) && w >= 64 && w <= 2048) body.width = w;
      if (!isNaN(h) && h >= 64 && h <= 2048) body.height = h;
      if (!isNaN(d) && d >= 0.5 && d <= 30) body.duration = d;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: GenerateResponse = await res.json();
      setResponse(data);

      if (data.success && data.animation && previewRef.current) {
        previewRef.current.innerHTML = "";
        animRef.current = lottie.loadAnimation({
          container: previewRef.current,
          animationData: data.animation,
          renderer: "svg",
          loop: true,
          autoplay: true,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [prompt, width, height, duration]);

  useEffect(() => {
    return () => {
      if (animRef.current) {
        animRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-4">
      <h4 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Try it live
      </h4>

      {/* Prompt input */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5">Prompt *</label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A bouncing blue ball with a shadow"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleGenerate();
          }}
        />
      </div>

      {/* Optional params */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Width (64-2048)
          </label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            min={64}
            max={2048}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Height (64-2048)
          </label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            min={64}
            max={2048}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Duration (0.5-30s)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min={0.5}
            max={30}
            step={0.5}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/30"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating...
          </span>
        ) : (
          "Generate"
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Response */}
      {response && !response.success && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          Error: {response.error}
        </div>
      )}

      {response && response.success && (
        <div className="space-y-4">
          {/* Description */}
          {response.description && (
            <p className="text-sm text-zinc-400 italic">
              {response.description}
            </p>
          )}

          {/* Live Preview */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
            <div
              ref={previewRef}
              className="w-full max-w-sm mx-auto aspect-square"
            />
          </div>

          {/* Raw JSON toggle */}
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showRawJson ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {showRawJson ? "Hide" : "Show"} raw JSON response
          </button>
          {showRawJson && (
            <JsonHighlight code={JSON.stringify(response, null, 2)} />
          )}
        </div>
      )}
    </div>
  );
}

// --- API Key Generator ---

function ApiKeyGenerator() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; key: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate key");
      } else {
        setResult(data);
        setName("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [name]);

  const copyKey = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-200">Generate API Key</h3>
      <div className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. my-app)"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleGenerate(); }}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !name.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-semibold text-emerald-300">Save this key — it won&apos;t be shown again</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm font-mono text-zinc-200 break-all">
              {result.key}
            </code>
            <button
              onClick={copyKey}
              className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export default function DocsPage() {
  const t = useTranslations();
  const baseUrl = "https://lottie.kagura-agent.com";

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-zinc-100 hover:text-white transition-colors"
          >
            Lottie Studio
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/explore"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {t('gallery.explore')}
            </Link>
            <Link
              href="/docs"
              className="text-sm text-indigo-400 font-medium"
            >
              {t('gallery.apiDocs')}
            </Link>
            <Link
              href="/editor/new"
              className="px-3 py-1.5 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              {t('gallery.createAnimation')}
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
            {t('docs.title')}
          </h1>
          <p className="mt-3 text-zinc-400 text-lg">
            {t('docs.description')}
          </p>
        </div>

        {/* Base URL */}
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {t('docs.baseUrl')}
            </span>
            <code className="text-sm font-mono text-zinc-200 bg-zinc-800 px-3 py-1 rounded-md">
              {baseUrl}
            </code>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-950/10 px-6 py-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-400 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-amber-300">
                Rate Limiting
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                The <code className="text-amber-400/80">/api/generate</code>{" "}
                endpoint is rate-limited to{" "}
                <strong className="text-zinc-200">
                  5 requests per minute
                </strong>{" "}
                per IP address. Other endpoints have no rate limits.
              </p>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-4">
          {/* POST /api/generate */}
          <EndpointSection
            method="POST"
            path="/api/generate"
            title="Generate animation from text"
            defaultOpen={true}
          >
            <p className="text-sm text-zinc-400">
              Generate a Lottie animation from a natural language prompt. The AI
              will create a production-ready animation based on your description.
            </p>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.request')}
              </h4>
              <JsonHighlight
                code={JSON.stringify(
                  {
                    prompt: "A bouncing blue ball with shadow",
                    width: 512,
                    height: 512,
                    duration: 2,
                  },
                  null,
                  2
                )}
              />
              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    prompt
                  </code>
                  <span className="text-zinc-500">string, required</span>
                  <span className="text-zinc-400">
                    — Description of the animation to generate
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    width
                  </code>
                  <span className="text-zinc-500">number, optional</span>
                  <span className="text-zinc-400">
                    — Width in pixels (64-2048, default: 512)
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    height
                  </code>
                  <span className="text-zinc-500">number, optional</span>
                  <span className="text-zinc-400">
                    — Height in pixels (64-2048, default: 512)
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    duration
                  </code>
                  <span className="text-zinc-500">number, optional</span>
                  <span className="text-zinc-400">
                    — Duration in seconds (0.5-30, default: 2)
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.response')}
              </h4>
              <JsonHighlight
                code={JSON.stringify(
                  {
                    success: true,
                    animation: { "...": "Lottie JSON" },
                    description: "A blue circle bouncing with an oval shadow beneath it",
                  },
                  null,
                  2
                )}
              />
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.response')}
              </h4>
              <JsonHighlight
                code={JSON.stringify(
                  {
                    success: false,
                    error: "Rate limit exceeded. Try again in 60 seconds.",
                  },
                  null,
                  2
                )}
              />
            </div>

            {/* Try It */}
            <TryItPanel />
          </EndpointSection>

          {/* GET /api/animations/explore */}
          <EndpointSection
            method="GET"
            path="/api/animations/explore"
            title="Browse community animations"
          >
            <p className="text-sm text-zinc-400">
              Browse paginated community animations with optional filtering and
              sorting.
            </p>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.parameters')}
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    page
                  </code>
                  <span className="text-zinc-500">number</span>
                  <span className="text-zinc-400">
                    — Page number (default: 1)
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    limit
                  </code>
                  <span className="text-zinc-500">number</span>
                  <span className="text-zinc-400">
                    — Items per page (default: 20)
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    sort
                  </code>
                  <span className="text-zinc-500">string</span>
                  <span className="text-zinc-400">
                    — Sort order: newest, popular, or views
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    search
                  </code>
                  <span className="text-zinc-500">string</span>
                  <span className="text-zinc-400">
                    — Search query to filter by name
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <code className="text-indigo-400 font-mono shrink-0">
                    tag
                  </code>
                  <span className="text-zinc-500">string</span>
                  <span className="text-zinc-400">— Filter by tag</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.example')}
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">
                GET /api/animations/explore?page=1&amp;limit=10&amp;sort=popular
              </pre>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.response')}
              </h4>
              <JsonHighlight
                code={JSON.stringify(
                  [
                    {
                      id: "abc123",
                      name: "Bouncing Ball",
                      frame_count: 60,
                      duration_seconds: 2,
                      width: 512,
                      height: 512,
                      view_count: 142,
                      like_count: 12,
                      tags: ["motion", "ball"],
                      created_at: "2025-01-15T08:30:00Z",
                    },
                  ],
                  null,
                  2
                )}
              />
            </div>
          </EndpointSection>

          {/* GET /api/animations/{id}/json */}
          <EndpointSection
            method="GET"
            path="/api/animations/{id}/json"
            title="Get raw Lottie JSON"
          >
            <p className="text-sm text-zinc-400">
              Retrieve the raw Lottie JSON data for a specific animation. This
              can be used directly with lottie-web or any Lottie player.
            </p>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.parameters')}
              </h4>
              <div className="flex items-start gap-2 text-sm">
                <code className="text-indigo-400 font-mono shrink-0">id</code>
                <span className="text-zinc-500">string, required</span>
                <span className="text-zinc-400">
                  — The animation ID
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.example')}
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">
                {`lottie.loadAnimation({
  container: document.getElementById('my-animation'),
  renderer: 'svg',
  loop: true,
  autoplay: true,
  path: '${baseUrl}/api/animations/abc123/json'
});`}
              </pre>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.response')}
              </h4>
              <p className="text-sm text-zinc-400 mb-2">
                Returns the full Lottie JSON object directly (Content-Type:
                application/json).
              </p>
              <JsonHighlight
                code={JSON.stringify(
                  {
                    v: "5.7.4",
                    fr: 30,
                    ip: 0,
                    op: 60,
                    w: 512,
                    h: 512,
                    layers: ["..."],
                  },
                  null,
                  2
                )}
              />
            </div>
          </EndpointSection>

          {/* GET /api/health */}
          <EndpointSection
            method="GET"
            path="/api/health"
            title="Health check"
          >
            <p className="text-sm text-zinc-400">
              Simple health check endpoint to verify the API is running.
            </p>

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                {t('docs.response')}
              </h4>
              <JsonHighlight
                code={JSON.stringify(
                  {
                    status: "ok",
                    timestamp: "2025-01-15T08:30:00.000Z",
                  },
                  null,
                  2
                )}
              />
            </div>
          </EndpointSection>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-zinc-800">
          <p className="text-sm text-zinc-500 text-center">
            All endpoints return JSON. Public endpoints require no authentication.
            v1 API endpoints require an API key.
          </p>
        </div>

        {/* ─── v1 API Section ─── */}
        <div className="mt-16 pt-12 border-t border-zinc-800">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
              v1 API
            </h2>
            <p className="mt-2 text-zinc-400">
              Authenticated API for programmatic animation generation and management. All v1 endpoints require an API key.
            </p>
          </div>

          {/* Authentication info */}
          <div className="mb-8 rounded-xl border border-indigo-500/20 bg-indigo-950/10 px-6 py-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-indigo-300">Authentication</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Include your API key in the <code className="text-indigo-400/80">Authorization</code> header:
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-sm font-mono text-zinc-300">
                  Authorization: Bearer ls_your_api_key_here
                </pre>
              </div>
            </div>
          </div>

          {/* Rate limiting info */}
          <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-950/10 px-6 py-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-amber-300">Rate Limiting</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Each API key has a per-key rate limit (default: <strong className="text-zinc-200">60 requests per minute</strong>).
                  When exceeded, the API returns <code className="text-amber-400/80">429</code> with a <code className="text-amber-400/80">Retry-After</code> header.
                </p>
              </div>
            </div>
          </div>

          {/* API Key Generator */}
          <div className="mb-8">
            <ApiKeyGenerator />
          </div>

          {/* v1 Endpoints */}
          <div className="space-y-4">
            {/* POST /api/v1/generate */}
            <EndpointSection
              method="POST"
              path="/api/v1/generate"
              title="Generate animation (authenticated)"
              defaultOpen={false}
            >
              <p className="text-sm text-zinc-400">
                Generate a Lottie animation from a text prompt. The animation is saved and can be retrieved later by ID.
              </p>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Request</h4>
                <JsonHighlight code={JSON.stringify({ prompt: "A spinning gear icon", width: 512, height: 512 }, null, 2)} />
                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <code className="text-indigo-400 font-mono shrink-0">prompt</code>
                    <span className="text-zinc-500">string, required</span>
                    <span className="text-zinc-400">— Description of the animation</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <code className="text-indigo-400 font-mono shrink-0">width</code>
                    <span className="text-zinc-500">number, optional</span>
                    <span className="text-zinc-400">— Width in pixels (64-2048, default: 512)</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <code className="text-indigo-400 font-mono shrink-0">height</code>
                    <span className="text-zinc-500">number, optional</span>
                    <span className="text-zinc-400">— Height in pixels (64-2048, default: 512)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Response</h4>
                <JsonHighlight code={JSON.stringify({ id: "uuid-here", lottieJson: { "...": "Lottie JSON" }, description: "A metallic gear rotating clockwise" }, null, 2)} />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Example</h4>
                <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`curl -X POST ${baseUrl}/api/v1/generate \\
  -H "Authorization: Bearer ls_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A spinning gear icon"}'`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`const res = await fetch("${baseUrl}/api/v1/generate", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ls_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prompt: "A spinning gear icon" }),
});
const { id, lottieJson, description } = await res.json();`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`import requests

res = requests.post(
    "${baseUrl}/api/v1/generate",
    headers={"Authorization": "Bearer ls_your_key"},
    json={"prompt": "A spinning gear icon"},
)
data = res.json()
animation_id = data["id"]
lottie_json = data["lottieJson"]`}</pre>
              </div>
            </EndpointSection>

            {/* GET /api/v1/animations/[id] */}
            <EndpointSection
              method="GET"
              path="/api/v1/animations/{id}"
              title="Get animation by ID"
              defaultOpen={false}
            >
              <p className="text-sm text-zinc-400">
                Retrieve an animation&apos;s metadata and Lottie JSON by its ID.
              </p>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Response</h4>
                <JsonHighlight code={JSON.stringify({ id: "uuid-here", name: "A spinning gear icon", lottieJson: { "...": "Lottie JSON" }, created_at: "2025-07-05 12:00:00" }, null, 2)} />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Example</h4>
                <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`curl ${baseUrl}/api/v1/animations/YOUR_ID \\
  -H "Authorization: Bearer ls_your_key"`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`const res = await fetch("${baseUrl}/api/v1/animations/YOUR_ID", {
  headers: { "Authorization": "Bearer ls_your_key" },
});
const { id, name, lottieJson, created_at } = await res.json();`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`import requests

res = requests.get(
    "${baseUrl}/api/v1/animations/YOUR_ID",
    headers={"Authorization": "Bearer ls_your_key"},
)
data = res.json()
lottie_json = data["lottieJson"]`}</pre>
              </div>
            </EndpointSection>

            {/* GET /api/v1/templates */}
            <EndpointSection
              method="GET"
              path="/api/v1/templates"
              title="List templates"
              defaultOpen={false}
            >
              <p className="text-sm text-zinc-400">
                List all available animation templates.
              </p>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Response</h4>
                <JsonHighlight code={JSON.stringify({ templates: [{ id: "bouncing-ball", name: "Bouncing Ball", category: "Motion" }] }, null, 2)} />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Example</h4>
                <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`curl ${baseUrl}/api/v1/templates \\
  -H "Authorization: Bearer ls_your_key"`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`const res = await fetch("${baseUrl}/api/v1/templates", {
  headers: { "Authorization": "Bearer ls_your_key" },
});
const { templates } = await res.json();`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`import requests

res = requests.get(
    "${baseUrl}/api/v1/templates",
    headers={"Authorization": "Bearer ls_your_key"},
)
templates = res.json()["templates"]`}</pre>
              </div>
            </EndpointSection>

            {/* GET /api/v1/templates/[id] */}
            <EndpointSection
              method="GET"
              path="/api/v1/templates/{id}"
              title="Get template by ID"
              defaultOpen={false}
            >
              <p className="text-sm text-zinc-400">
                Get a specific template with its full Lottie JSON data.
              </p>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Response</h4>
                <JsonHighlight code={JSON.stringify({ id: "bouncing-ball", name: "Bouncing Ball", category: "Motion", lottieJson: { "...": "Lottie JSON" } }, null, 2)} />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Example</h4>
                <pre className="overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`curl ${baseUrl}/api/v1/templates/bouncing-ball \\
  -H "Authorization: Bearer ls_your_key"`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`const res = await fetch("${baseUrl}/api/v1/templates/bouncing-ball", {
  headers: { "Authorization": "Bearer ls_your_key" },
});
const { id, name, category, lottieJson } = await res.json();`}</pre>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300">{`import requests

res = requests.get(
    "${baseUrl}/api/v1/templates/bouncing-ball",
    headers={"Authorization": "Bearer ls_your_key"},
)
data = res.json()
lottie_json = data["lottieJson"]`}</pre>
              </div>
            </EndpointSection>
          </div>
        </div>
      </main>
    </div>
  );
}
