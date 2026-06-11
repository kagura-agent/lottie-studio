"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LottiePreview from "./LottiePreview";
import Controls from "./Controls";
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
}

export default function ShareView({ id, name, animationData }: ShareViewProps) {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loopConfig, setLoopConfig] = useState<LoopConfig>({ mode: "loop" });
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [seekFrame, setSeekFrame] = useState<number | undefined>(undefined);
  const [isRemixing, setIsRemixing] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

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

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 min-h-0">
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
      </div>

      {showEmbed && <EmbedModal id={id} onClose={() => setShowEmbed(false)} />}
    </div>
  );
}
