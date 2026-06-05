"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LottiePreview from "./LottiePreview";
import JsonEditor from "./JsonEditor";
import ChatPanel from "./ChatPanel";
import Controls from "./Controls";
import { useAnimationSocket } from "@/hooks/useAnimationSocket";

interface EditorPageProps {
  id: string;
  initialName: string;
  initialData: object;
}

export default function EditorPage({ id, initialName, initialData }: EditorPageProps) {
  const router = useRouter();
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialData, null, 2));
  const [animationData, setAnimationData] = useState<object | null>(initialData);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [seekFrame, setSeekFrame] = useState<number | undefined>(undefined);
  const [rightPanel, setRightPanel] = useState<"chat" | "json">("chat");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExternalUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/api/animations/${id}`);
      if (!res.ok) return;
      const result = await res.json();
      if (result.data) {
        const text = JSON.stringify(result.data, null, 2);
        setJsonText(text);
        setAnimationData(result.data);
      }
      if (result.name) setName(result.name);
    } catch {
      // ignore fetch errors
    }
  }, [id]);

  useAnimationSocket(id, handleExternalUpdate);

  const handleJsonChange = useCallback((value: string) => {
    setJsonText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(value);
        setAnimationData(parsed);
      } catch {
        setAnimationData(null);
      }
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleExport = () => {
    if (!animationData) return;
    const json = JSON.stringify(animationData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const sanitized = name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitized}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch(`/api/animations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: parsed }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleFrameChange = useCallback((frame: number, total: number) => {
    setCurrentFrame(frame);
    setTotalFrames(total);
  }, []);

  const handleSeek = useCallback((frame: number) => {
    setSeekFrame(frame);
    setIsPlaying(false);
  }, []);

  const handleRestart = useCallback(() => {
    setSeekFrame(0);
    setIsPlaying(true);
    // Clear seekFrame after a tick so LottiePreview processes it
    setTimeout(() => setSeekFrame(undefined), 50);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          &larr; Gallery
        </Link>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-transparent border-b border-zinc-700 text-zinc-100 text-lg font-semibold px-1 py-0.5 focus:outline-none focus:border-zinc-400 transition-colors flex-1 min-w-0"
        />
        <button
          onClick={handleExport}
          disabled={animationData === null}
          className="px-4 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export
        </button>
        <button
          onClick={handleSave}
          disabled={saving || animationData === null}
          className="px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saveStatus === "saved" && (
          <span className="text-emerald-400 text-sm">Saved</span>
        )}
        {saveStatus === "error" && (
          <span className="text-red-400 text-sm">Error saving</span>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Preview panel */}
        <div className="flex flex-col md:w-1/2 min-h-[300px] md:min-h-0 border-b md:border-b-0 md:border-r border-zinc-800">
          <div className="flex-1 p-4 min-h-0">
            <LottiePreview
              animationData={animationData}
              isPlaying={isPlaying}
              speed={speed}
              loop={loop}
              onFrameChange={handleFrameChange}
              seekToFrame={seekFrame}
            />
          </div>
          <Controls
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            speed={speed}
            onSpeedChange={setSpeed}
            loop={loop}
            onToggleLoop={() => setLoop((l) => !l)}
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            onSeek={handleSeek}
          />
          <div className="flex justify-center px-4 pb-3">
            <button
              onClick={handleRestart}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors"
            >
              Restart
            </button>
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex flex-col flex-1 min-h-[300px] md:min-h-0">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
            <button
              onClick={() => setRightPanel("chat")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rightPanel === "chat"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setRightPanel("json")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rightPanel === "json"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              JSON
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {rightPanel === "chat" ? (
              <ChatPanel animationId={id} />
            ) : (
              <JsonEditor value={jsonText} onChange={handleJsonChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
