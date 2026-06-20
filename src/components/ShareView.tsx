"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LottiePreview from "./LottiePreview";
import Controls from "./Controls";
import FullscreenPreview from "./FullscreenPreview";
import { exportDotLottie } from "@/lib/dotlottieExporter";
import type { LoopConfig } from "@/types/loopConfig";

const BASE_URL = "https://lottie.kagura-agent.com";

interface EmbedModalProps {
  id: string;
  onClose: () => void;
}

function EmbedModal({ id, onClose }: EmbedModalProps) {
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(300);
  const [autoplay, setAutoplay] = useState(true);
  const [loop, setLoop] = useState(true);
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => {
    const attrs = [
      `src="${BASE_URL}/api/animations/${id}/json"`,
      `background="transparent"`,
      `speed="1"`,
      loop ? "loop" : "",
      autoplay ? "autoplay" : "",
      `style="width: ${width}px; height: ${height}px;"`,
    ]
      .filter(Boolean)
      .join("\n  ");

    return `<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>\n<lottie-player\n  ${attrs}\n></lottie-player>`;
  }, [id, width, height, autoplay, loop]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = snippet;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [snippet]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-zinc-100 text-lg font-semibold">Embed Code</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-4 mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400 text-xs">Width (px)</span>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value) || 300)}
              className="w-24 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm focus:outline-none focus:border-zinc-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400 text-xs">Height (px)</span>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value) || 300)}
              className="w-24 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm focus:outline-none focus:border-zinc-400"
            />
          </label>
        </div>

        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-600"
            />
            Autoplay
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-600"
            />
            Loop
          </label>
        </div>

        <div className="relative">
          <pre className="bg-zinc-950 border border-zinc-700 rounded-lg p-4 overflow-x-auto text-xs text-zinc-300 font-mono leading-relaxed">
            <code>{snippet}</code>
          </pre>
        </div>

        <button
          onClick={handleCopy}
          className="mt-4 w-full px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
        >
          {copied ? "✓ Copied!" : "Copy to Clipboard"}
        </button>
      </div>
    </div>
  );
}

interface ShareViewProps {
  id: string;
  name: string;
  animationData: object;
  messages?: { role: string; content: string; imageUrl?: string }[];
}

/** Strip JSON code blocks from assistant messages, keeping only conversational text */
function stripJsonBlocks(content: string): string {
  // Remove ```json ... ``` blocks
  let stripped = content.replace(/```json[\s\S]*?```/g, "");
  // Remove standalone ``` blocks that look like JSON (start with { or [)
  stripped = stripped.replace(/```\s*[\[{][\s\S]*?```/g, "");
  // Collapse multiple blank lines
  stripped = stripped.replace(/\n{3,}/g, "\n\n").trim();
  return stripped;
}

function ChatHistory({ messages }: { messages: { role: string; content: string; imageUrl?: string }[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full max-w-2xl mx-auto mt-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-medium"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        💬 How this was made
        <span className="text-zinc-500 text-xs">({messages.length} messages)</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 border-l-2 border-zinc-700 pl-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const displayContent = isUser ? msg.content : stripJsonBlocks(msg.content);
            if (!displayContent && !msg.imageUrl) return null;
            return (
              <div key={i} className="flex flex-col gap-1">
                <span className={`text-xs font-medium ${
                  isUser ? "text-blue-400" : "text-emerald-400"
                }`}>
                  {isUser ? "Prompt" : "Assistant"}
                </span>
                {msg.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- base64 data URLs from user uploads, not optimizable by next/image
                  <img
                    src={msg.imageUrl}
                    alt="Attachment"
                    className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                  />
                )}
                {displayContent && (
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                    {displayContent}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ShareView({ id, name, animationData, messages }: ShareViewProps) {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loopConfig, setLoopConfig] = useState<LoopConfig>({ mode: "loop" });
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [seekFrame, setSeekFrame] = useState<number | undefined>(undefined);
  const [isRemixing, setIsRemixing] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  // Close download dropdown on outside click
  useEffect(() => {
    if (!downloadOpen) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [downloadOpen]);

  const handleDownloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(animationData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadOpen(false);
  }, [animationData, name]);

  const handleDownloadDotLottie = useCallback(async () => {
    const blob = await exportDotLottie(animationData, name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.lottie`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadOpen(false);
  }, [animationData, name]);

  const handleFrameChange = useCallback((frame: number, total: number) => {
    setCurrentFrame(frame);
    setTotalFrames(total);
  }, []);

  const handleSeek = useCallback((frame: number) => {
    setSeekFrame(frame);
    setIsPlaying(false);
  }, []);

  const handleRemix = useCallback(async () => {
    setIsRemixing(true);
    try {
      const res = await fetch(`/api/animations/${id}/remix`, { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to remix animation");
      }
      const data = await res.json();
      router.push(`/editor/${data.id}`);
    } catch {
      setIsRemixing(false);
      alert("Failed to remix animation. Please try again.");
    }
  }, [id, router]);

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          &larr; Gallery
        </Link>
        <h1 className="text-zinc-100 text-lg font-semibold px-1 flex-1 min-w-0 truncate">
          {name}
        </h1>
        <button
          onClick={() => setShowEmbed(true)}
          className="px-4 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          title="Get embed code"
        >
          &lt;/&gt; Embed
        </button>
        <div className="relative" ref={downloadRef}>
          <button
            onClick={() => setDownloadOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
            title="Download"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          {downloadOpen && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[180px] py-1">
              <button
                onClick={handleDownloadJson}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download JSON
              </button>
              <button
                onClick={handleDownloadDotLottie}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download .lottie
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setFullscreenOpen(true)}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          title="Fullscreen preview"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        <button
          onClick={handleRemix}
          disabled={isRemixing}
          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:from-purple-400 hover:to-pink-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRemixing ? "Remixing…" : "✨ Remix"}
        </button>
        <Link
          href={`/editor/${id}`}
          className="px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
        >
          Open in Editor
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center p-4 md:p-8 min-h-0 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0">
            <LottiePreview
              animationData={animationData}
              isPlaying={isPlaying}
              speed={speed}
              loopConfig={loopConfig}
              onFrameChange={handleFrameChange}
              seekToFrame={seekFrame}
            />
          </div>
          <Controls
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            speed={speed}
            onSpeedChange={setSpeed}
            loopConfig={loopConfig}
            onLoopConfigChange={setLoopConfig}
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            onSeek={handleSeek}
            frameRate={(animationData as Record<string, unknown>)?.fr as number ?? 30}
          />
        </div>
        {messages && messages.length > 0 && (
          <ChatHistory messages={messages} />
        )}
      </div>

      {showEmbed && <EmbedModal id={id} onClose={() => setShowEmbed(false)} />}
      {fullscreenOpen && (
        <FullscreenPreview
          animationData={animationData}
          isPlaying={isPlaying}
          speed={speed}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onSpeedChange={setSpeed}
          onSeek={handleSeek}
          onClose={() => setFullscreenOpen(false)}
        />
      )}
    </div>
  );
}
