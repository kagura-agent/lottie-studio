"use client";

import { useState, useCallback, useRef, useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LottiePreview from "./LottiePreview";
import JsonEditor from "./JsonEditor";
import ChatPanel from "./ChatPanel";
import Controls from "./Controls";
import BackgroundPicker, { type CanvasBackground } from "./BackgroundPicker";
import { useAnimationSocket } from "@/hooks/useAnimationSocket";
import { useAnimationHistory } from "@/hooks/useAnimationHistory";

interface EditorPageProps {
  id: string;
  initialName: string;
  initialData: object;
}

export default function EditorPage({ id, initialName, initialData }: EditorPageProps) {
  const router = useRouter();
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialData, null, 2));
  const [animationData, setAnimationData] = useState<object | null>(initialData);
  const { pushState, undo, redo, canUndo, canRedo } = useAnimationHistory(initialData);
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
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [gifExporting, setGifExporting] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"canvas" | "chat">("chat");
  const [canvasBg, setCanvasBg] = useState<CanvasBackground>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(`lottie-bg-${id}`) as CanvasBackground) || "checkered";
    }
    return "checkered";
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleBgChange = useCallback((bg: CanvasBackground) => {
    setCanvasBg(bg);
    localStorage.setItem(`lottie-bg-${id}`, bg);
  }, [id]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileMenuOpen]);

  const handleExternalUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/api/animations/${id}`);
      if (!res.ok) return;
      const result = await res.json();
      if (result.data) {
        const text = JSON.stringify(result.data, null, 2);
        setJsonText(text);
        setAnimationData(result.data);
        pushState(result.data);
      }
      if (result.name) setName(result.name);
    } catch {
      // ignore fetch errors
    }
  }, [id, pushState]);

  useAnimationSocket(id, handleExternalUpdate);

  const applyHistoryState = useCallback((data: object) => {
    const text = JSON.stringify(data, null, 2);
    setJsonText(text);
    setAnimationData(data);
  }, []);

  const handleUndo = useCallback(() => {
    const state = undo();
    if (state) applyHistoryState(state);
  }, [undo, applyHistoryState]);

  const handleRedo = useCallback(() => {
    const state = redo();
    if (state) applyHistoryState(state);
  }, [redo, applyHistoryState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const handleJsonChange = useCallback((value: string) => {
    setJsonText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(value);
        setAnimationData(parsed);
        pushState(parsed);
      } catch {
        setAnimationData(null);
      }
    }, 500);
  }, [pushState]);

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

  const handleExportGif = async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || gifExporting) return;
    setGifExporting(true);
    setGifProgress(0);
    try {
      const { exportToGif } = await import("@/lib/gifExporter");
      const blob = await exportToGif({
        animationData,
        onProgress: setGifProgress,
      });
      const url = URL.createObjectURL(blob);
      const sanitized = name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitized}.gif`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("GIF export failed:", err);
      alert("GIF export failed. Please try again.");
    } finally {
      setGifExporting(false);
      setGifProgress(0);
    }
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
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <Link
          href="/"
          className="px-2 md:px-3 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors shrink-0"
        >
          &larr;
          <span className="hidden md:inline"> Gallery</span>
        </Link>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-transparent border-b border-zinc-700 text-zinc-100 text-base md:text-lg font-semibold px-1 py-0.5 focus:outline-none focus:border-zinc-400 transition-colors flex-1 min-w-0"
        />
        {/* Desktop action buttons */}
        <button
          onClick={handleExport}
          disabled={animationData === null}
          className="hidden md:inline-flex px-4 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export
        </button>
        <button
          onClick={handleExportGif}
          disabled={animationData === null || gifExporting}
          className="hidden md:inline-flex px-4 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {gifExporting ? `GIF ${Math.round(gifProgress * 100)}%` : "Export GIF"}
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
            setShareStatus("copied");
            setTimeout(() => setShareStatus("idle"), 2000);
          }}
          className="hidden md:inline-flex px-4 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors"
        >
          {shareStatus === "copied" ? "Copied!" : "Share"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || animationData === null}
          className="px-3 md:px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {saving ? "..." : "Save"}
        </button>
        {saveStatus === "saved" && (
          <span className="text-emerald-400 text-sm shrink-0">✓</span>
        )}
        {saveStatus === "error" && (
          <span className="text-red-400 text-sm shrink-0">Error</span>
        )}
        {/* Mobile overflow menu */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
          >
            ⋯
          </button>
          {mobileMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
              <button
                onClick={() => { handleExport(); setMobileMenuOpen(false); }}
                disabled={animationData === null}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export JSON
              </button>
              <button
                onClick={(e) => { handleExportGif(e as unknown as MouseEvent); setMobileMenuOpen(false); }}
                disabled={animationData === null || gifExporting}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gifExporting ? `Export GIF (${Math.round(gifProgress * 100)}%)` : "Export GIF"}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
                  setShareStatus("copied");
                  setTimeout(() => setShareStatus("idle"), 2000);
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              >
                {shareStatus === "copied" ? "✓ Link Copied" : "Copy Share Link"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile view toggle */}
      <div className="flex md:hidden border-b border-zinc-800 bg-zinc-900 shrink-0">
        <button
          onClick={() => setMobileView("canvas")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            mobileView === "canvas"
              ? "text-zinc-100 border-b-2 border-zinc-100"
              : "text-zinc-400"
          }`}
        >
          Canvas
        </button>
        <button
          onClick={() => setMobileView("chat")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            mobileView === "chat"
              ? "text-zinc-100 border-b-2 border-zinc-100"
              : "text-zinc-400"
          }`}
        >
          Chat
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Preview panel - hidden on mobile when chat is active */}
        <div className={`flex-col md:w-1/2 md:min-h-0 md:border-r border-zinc-800 ${
          mobileView === "canvas" ? "flex flex-1" : "hidden md:flex"
        }`}>
          <div className="flex-1 p-4 min-h-0">
            <LottiePreview
              animationData={animationData}
              isPlaying={isPlaying}
              speed={speed}
              loop={loop}
              onFrameChange={handleFrameChange}
              seekToFrame={seekFrame}
              background={canvasBg}
            />
          </div>
          <div className="flex items-center border-t border-zinc-800">
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
              frameRate={(animationData as Record<string, unknown>)?.fr as number ?? 30}
            />
            <div className="px-2 py-2 bg-zinc-900">
              <BackgroundPicker value={canvasBg} onChange={handleBgChange} />
            </div>
          </div>
          <div className="flex justify-center gap-2 px-4 pb-3">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Redo
            </button>
            <button
              onClick={handleRestart}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Restart
            </button>
          </div>
        </div>

        {/* Editor panel - hidden on mobile when canvas is active */}
        <div className={`flex-col flex-1 md:min-h-0 ${
          mobileView === "chat" ? "flex" : "hidden md:flex"
        }`}>
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
            <button
              onClick={() => setRightPanel("chat")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                rightPanel === "chat"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setRightPanel("json")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
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
