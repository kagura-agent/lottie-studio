"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LottiePreview from "./LottiePreview";
import Controls from "./Controls";
import type { LoopConfig } from "@/types/loopConfig";

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
    </div>
  );
}
