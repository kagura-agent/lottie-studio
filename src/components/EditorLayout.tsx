"use client";

import { useState, useCallback, useRef, useEffect, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { LoopConfig } from "@/types/loopConfig";
import type { Command } from "@/lib/commands";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LottiePreview from "./LottiePreview";
import JsonEditor from "./JsonEditor";
import ChatPanel from "./ChatPanel";
import LayerPanel from "./LayerPanel";
import Controls from "./Controls";
import BackgroundPicker, { type CanvasBackground } from "./BackgroundPicker";
import ArtboardPicker from "./ArtboardPicker";
import ExportDropdown from "./ExportDropdown";
import ColorPalette from "./ColorPalette";
import TimingEditor from "./TimingEditor";
import EasingEditor from "./EasingEditor";
import { useAnimationSocket } from "@/hooks/useAnimationSocket";
import { useAnimationHistory } from "@/hooks/useAnimationHistory";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import LanguageSwitcher from "./LanguageSwitcher";
import UserMenu from "./auth/UserMenu";
import { captureAndUploadThumbnail } from "@/lib/captureThumbnail";
import ErrorBoundary from "./ErrorBoundary";
import VersionHistory from "./VersionHistory";
import ShortcutsHelp from "./ShortcutsHelp";
import CommandPalette from "./CommandPalette";
import FullscreenPreview from "./FullscreenPreview";
import EmbedDialog from "./EmbedDialog";
import KeyframeTimeline from "./KeyframeTimeline";
import QualityPanel from "./QualityPanel";
import ImportLottie from "./ImportLottie";
import ThemePanel, { ThemeIndicator } from "./ThemePanel";
import OnboardingTour from "./OnboardingTour";
import { optimizeLottie } from "@/lib/optimizer";
import { rescaleDuration } from "@/lib/rescaleDuration";
import { rescaleForExport } from "@/lib/rescaleForExport";
import { ExportPreset, getPresetFilename } from "@/lib/exportPresets";
import { useToast } from "@/contexts/ToastContext";

interface EditorPageProps {
  id: string | null;
  initialName: string;
  initialData: object | null;
  remixedFrom?: { id: string; name: string };
  initialPrompt?: string;
}

/**
 * Iteratively export a GIF with reducing quality/framerate until it fits under maxSize.
 * Strategy: reduce GIF quality (increase quality number = lower quality),
 * then reduce framerate by skipping frames.
 */
async function exportWithSizeLimit(
  animationData: object,
  maxSize: number,
  onProgress: (p: number) => void
): Promise<Blob> {
  const { exportToGif } = await import("@/lib/gifExporter");

  // First attempt with default settings
  let blob = await exportToGif({ animationData, onProgress });
  if (blob.size <= maxSize) return blob;

  // Second attempt: reduce framerate by truncating frames (simulate by adjusting fr)
  // We'll modify the animation data to halve the framerate
  const data = JSON.parse(JSON.stringify(animationData)) as Record<string, unknown>;
  const originalFr = (data.fr as number) || 30;

  // Try progressively lower framerates: 15, 10, 8, 5
  const fpsAttempts = [15, 10, 8, 5];
  for (const targetFps of fpsAttempts) {
    if (targetFps >= originalFr) continue;
    const ratio = targetFps / originalFr;
    const adjusted = JSON.parse(JSON.stringify(data));
    adjusted.fr = targetFps;
    // Scale op proportionally to maintain duration
    adjusted.op = Math.round(((adjusted.op as number) || 60) * ratio);
    if (adjusted.ip) adjusted.ip = Math.round((adjusted.ip as number) * ratio);
    // Scale layer timing
    if (Array.isArray(adjusted.layers)) {
      for (const layer of adjusted.layers) {
        if (typeof layer.ip === "number") layer.ip = Math.round(layer.ip * ratio);
        if (typeof layer.op === "number") layer.op = Math.round(layer.op * ratio);
      }
    }
    onProgress(0);
    blob = await exportToGif({ animationData: adjusted, onProgress });
    if (blob.size <= maxSize) return blob;
  }

  // If still too large, return the smallest we got
  return blob;
}

export default function EditorPage({ id, initialName, initialData, remixedFrom, initialPrompt }: EditorPageProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const router = useRouter();
  const [currentId, setCurrentId] = useState<string | null>(id);
  const [duplicating, setDuplicating] = useState(false);
  const [jsonText, setJsonText] = useState(() => initialData ? JSON.stringify(initialData, null, 2) : "");
  const [animationData, setAnimationData] = useState<object | null>(initialData);
  const { pushState, undo, redo, canUndo, canRedo } = useAnimationHistory(initialData ?? {});
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loopConfig, setLoopConfig] = useState<LoopConfig>(() => {
    if (typeof window !== "undefined" && currentId) {
      try {
        const stored = localStorage.getItem(`lottie-loop-${currentId}`);
        if (stored) return JSON.parse(stored) as LoopConfig;
      } catch { /* ignore */ }
    }
    return { mode: "loop" };
  });
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [seekFrame, setSeekFrame] = useState<number | undefined>(undefined);
  const [rightPanel, setRightPanel] = useState<"chat" | "json" | "layers">("chat");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [gifExporting, setGifExporting] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [apngExporting, setApngExporting] = useState(false);
  const [apngProgress, setApngProgress] = useState(0);
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [mp4Exporting, setMp4Exporting] = useState(false);
  const [mp4Progress, setMp4Progress] = useState(0);
  const [presetExporting, setPresetExporting] = useState(false);
  const [presetProgress, setPresetProgress] = useState(0);
  const [presetExportingId, setPresetExportingId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"canvas" | "chat" | "layers">("chat");
  const [insertText, setInsertText] = useState("");
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [shareChat, setShareChat] = useState(false);
  const [shareChatSaving, setShareChatSaving] = useState(false);
  const [canvasBg, setCanvasBg] = useState<CanvasBackground>(() => {
    if (typeof window !== "undefined" && currentId) {
      return (localStorage.getItem(`lottie-bg-${currentId}`) as CanvasBackground) || "checkered";
    }
    return "checkered";
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isNewMode = currentId === null;

  const handleBgChange = useCallback((bg: CanvasBackground) => {
    setCanvasBg(bg);
    if (currentId) localStorage.setItem(`lottie-bg-${currentId}`, bg);
  }, [currentId]);

  // Artboard dimensions derived from current animation data
  const currentWidth = (animationData as Record<string, unknown>)?.w as number ?? 512;
  const currentHeight = (animationData as Record<string, unknown>)?.h as number ?? 512;

  const handleArtboardChange = useCallback((w: number, h: number) => {
    // Store as last-used dimensions globally
    localStorage.setItem("lottie-artboard-last", JSON.stringify({ w, h }));
    if (currentId) {
      localStorage.setItem(`lottie-artboard-${currentId}`, JSON.stringify({ w, h }));
    }

    if (!animationData) return;

    const cloned = JSON.parse(JSON.stringify(animationData));
    cloned.w = w;
    cloned.h = h;
    setAnimationData(cloned);
    setJsonText(JSON.stringify(cloned, null, 2));
    pushState(cloned);
  }, [currentId, animationData, pushState]);

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
    if (!currentId) return;
    try {
      const res = await fetch(`/api/animations/${currentId}`);
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
  }, [currentId, pushState]);

  useAnimationSocket(currentId, handleExternalUpdate);

  // Load share_chat setting from API on mount
  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    fetch(`/api/animations/${currentId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data && data.share_chat !== undefined) {
          setShareChat(!!data.share_chat);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentId]);

  // Callback for ChatPanel when a new animation is created (blank-canvas flow)
  const handleAnimationCreated = useCallback(async (newId: string, newData?: object) => {
    setCurrentId(newId);
    if (newData) {
      const text = JSON.stringify(newData, null, 2);
      setJsonText(text);
      setAnimationData(newData);
      pushState(newData);
    } else {
      // Fetch animation data if not provided inline
      try {
        const res = await fetch(`/api/animations/${newId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            setJsonText(JSON.stringify(result.data, null, 2));
            setAnimationData(result.data);
            pushState(result.data);
          }
          if (result.name) setName(result.name);
        }
      } catch {
        // ignore fetch errors
      }
    }
    window.history.replaceState(null, '', `/editor/${newId}`);
  }, [pushState]);

  // Capture and upload a thumbnail after animation is created or updated via chat
  const handleAnimationUpdated = useCallback((animId: string, data: object) => {
    // Fire-and-forget: non-blocking, failures are silent
    captureAndUploadThumbnail(animId, data);
  }, []);

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
    if (currentId) {
      localStorage.setItem(`lottie-loop-${currentId}`, JSON.stringify(loopConfig));
    }
  }, [currentId, loopConfig]);

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

  const handleExportDotLottie = async () => {
    if (!animationData) return;
    const { exportDotLottie } = await import("@/lib/dotlottieExporter");
    const blob = await exportDotLottie(animationData, name || "animation");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (name || "animation") + ".lottie";
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
      toast({ message: "GIF export failed. Please try again.", type: "error" });
    } finally {
      setGifExporting(false);
      setGifProgress(0);
    }
  };

  const handleExportApng = async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || apngExporting) return;
    setApngExporting(true);
    setApngProgress(0);
    try {
      const { exportToApng } = await import("@/lib/apngExporter");
      const blob = await exportToApng({
        animationData,
        onProgress: setApngProgress,
      });
      const url = URL.createObjectURL(blob);
      const sanitized = name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitized}.apng`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("APNG export failed:", err);
      toast({ message: "APNG export failed. Please try again.", type: "error" });
    } finally {
      setApngExporting(false);
      setApngProgress(0);
    }
  };

  const handleExportVideo = async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || videoExporting) return;
    setVideoExporting(true);
    setVideoProgress(0);
    try {
      const { exportToVideo, getVideoExtension } = await import("@/lib/videoExporter");
      const blob = await exportToVideo({
        animationData,
        onProgress: setVideoProgress,
      });
      const ext = getVideoExtension();
      const url = URL.createObjectURL(blob);
      const sanitized = name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitized}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Video export failed:", err);
      toast({ message: "Video export failed. Please try again.", type: "error" });
    } finally {
      setVideoExporting(false);
      setVideoProgress(0);
    }
  };

  const handleExportMp4 = async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || mp4Exporting) return;
    setMp4Exporting(true);
    setMp4Progress(0);
    try {
      const { exportToMp4, isMP4ExportSupported, formatFileSize } = await import("@/lib/mp4Exporter");
      if (!isMP4ExportSupported()) {
        toast({ message: "MP4 export requires Chrome 94+ or Edge 94+ (WebCodecs API).", type: "error" });
        return;
      }
      const blob = await exportToMp4({
        animationData,
        onProgress: setMp4Progress,
      });
      const url = URL.createObjectURL(blob);
      const sanitized = name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitized}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ message: `MP4 exported (${formatFileSize(blob.size)})`, type: "success" });
    } catch (err) {
      console.error("MP4 export failed:", err);
      const message = err instanceof Error ? err.message : "MP4 export failed. Please try again.";
      toast({ message, type: "error" });
    } finally {
      setMp4Exporting(false);
      setMp4Progress(0);
    }
  };

  const handleExportPreset = async (preset: ExportPreset) => {
    if (!animationData || presetExporting) return;
    setPresetExporting(true);
    setPresetProgress(0);
    setPresetExportingId(preset.id);
    try {
      // Rescale animation data to preset dimensions
      const { animationData: rescaledData } = rescaleForExport(animationData, {
        targetWidth: preset.width,
        targetHeight: preset.height,
        fit: "contain",
      });

      let blob: Blob;
      const onProgress = (p: number) => setPresetProgress(p);

      if (preset.format === "gif") {
        const { exportToGif } = await import("@/lib/gifExporter");

        if (preset.maxFileSize) {
          // Iterative export with quality/framerate reduction for size-limited presets
          blob = await exportWithSizeLimit(rescaledData, preset.maxFileSize, onProgress);
        } else {
          blob = await exportToGif({ animationData: rescaledData, onProgress });
        }
      } else if (preset.format === "mp4") {
        const { exportToMp4, isMP4ExportSupported } = await import("@/lib/mp4Exporter");
        if (!isMP4ExportSupported()) {
          toast({ message: "MP4 export requires Chrome 94+ or Edge 94+ (WebCodecs API).", type: "error" });
          return;
        }
        blob = await exportToMp4({ animationData: rescaledData, onProgress });
      } else if (preset.format === "apng") {
        const { exportToApng } = await import("@/lib/apngExporter");
        blob = await exportToApng({ animationData: rescaledData, onProgress });
      } else if (preset.format === "tgs") {
        const { exportToTgs } = await import("@/lib/tgsExporter");
        const result = await exportToTgs(rescaledData);
        if (result.warnings.length > 0) {
          toast({ message: result.warnings.join(". "), type: "info" });
        }
        blob = result.blob;
      } else {
        // webp fallback to apng
        const { exportToApng } = await import("@/lib/apngExporter");
        blob = await exportToApng({ animationData: rescaledData, onProgress });
      }

      const url = URL.createObjectURL(blob);
      const filename = getPresetFilename(name, preset);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Preset export failed:", err);
      toast({ message: `Export failed for ${preset.platform}. Please try again.`, type: "error" });
    } finally {
      setPresetExporting(false);
      setPresetProgress(0);
      setPresetExportingId(null);
    }
  };

  const handleSave = useCallback(async () => {
    if (!currentId) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch(`/api/animations/${currentId}`, {
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
  }, [currentId, jsonText, name]);

  const handleDuplicate = useCallback(async () => {
    if (!currentId || duplicating) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/animations/${currentId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Duplicate failed");
      const result = await res.json();
      const newId = result.id;
      if (newId) {
        router.push(`/editor/${newId}`);
      }
    } catch (err) {
      console.error("Duplicate failed:", err);
      toast({ message: "Failed to duplicate animation. Please try again.", type: "error" });
    } finally {
      setDuplicating(false);
    }
  }, [currentId, duplicating, router, toast]);

  const handleToggleShareChat = useCallback(async () => {
    if (!currentId || shareChatSaving) return;
    const newValue = !shareChat;
    setShareChat(newValue);
    setShareChatSaving(true);
    try {
      const res = await fetch(`/api/animations/${currentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_chat: newValue }),
      });
      if (!res.ok) {
        setShareChat(!newValue); // revert on failure
      }
    } catch {
      setShareChat(!newValue); // revert on failure
    } finally {
      setShareChatSaving(false);
    }
  }, [currentId, shareChat, shareChatSaving]);

  const speeds = [0.5, 1, 2];
  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onTogglePlay: () => setIsPlaying((p) => !p),
    onSave: handleSave,
    onSeekBackward: () => {
      setSeekFrame(Math.max(0, currentFrame - 1));
      setIsPlaying(false);
    },
    onSeekForward: () => {
      setSeekFrame(Math.min(totalFrames - 1, currentFrame + 1));
      setIsPlaying(false);
    },
    onSeekStart: () => {
      setSeekFrame(0);
      setIsPlaying(false);
    },
    onSeekEnd: () => {
      setSeekFrame(Math.max(0, totalFrames - 1));
      setIsPlaying(false);
    },
    onSpeedDown: () => {
      const idx = speeds.indexOf(speed);
      if (idx > 0) setSpeed(speeds[idx - 1]);
    },
    onSpeedUp: () => {
      const idx = speeds.indexOf(speed);
      if (idx < speeds.length - 1) setSpeed(speeds[idx + 1]);
    },
    onShowHelp: () => setShortcutsHelpOpen((v) => !v),
    onToggleFullscreen: () => setFullscreenOpen((v) => !v),
  });

  // Global Ctrl+K / Cmd+K for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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

  const handleSelectLayer = useCallback((layerName: string) => {
    setInsertText(layerName);
    setRightPanel("chat");
    setMobileView("chat");
    setTimeout(() => setInsertText(""), 0);
  }, []);

  const handleToggleVisibility = useCallback((layerIndex: number, hidden: boolean) => {
    if (!animationData) return;
    const cloned = JSON.parse(JSON.stringify(animationData));
    if (cloned.layers && cloned.layers[layerIndex] !== undefined) {
      cloned.layers[layerIndex].hd = hidden;
      setAnimationData(cloned);
      setJsonText(JSON.stringify(cloned, null, 2));
      pushState(cloned);
    }
  }, [animationData, pushState]);

  const handleChangeOpacity = useCallback((layerIndex: number, opacity: number) => {
    if (!animationData) return;
    const cloned = JSON.parse(JSON.stringify(animationData));
    if (cloned.layers && cloned.layers[layerIndex] !== undefined) {
      const layer = cloned.layers[layerIndex];
      if (!layer.ks) layer.ks = {};
      if (!layer.ks.o) layer.ks.o = { a: 0, k: 100 };
      if (layer.ks.o.a === 1 && Array.isArray(layer.ks.o.k)) {
        // Animated opacity: set all keyframe values
        for (const kf of layer.ks.o.k) {
          if (kf && typeof kf === 'object' && 's' in kf) {
            kf.s = [opacity];
          }
          if (kf && typeof kf === 'object' && 'e' in kf) {
            kf.e = [opacity];
          }
        }
      } else {
        // Static opacity
        layer.ks.o.a = 0;
        layer.ks.o.k = opacity;
      }
      setAnimationData(cloned);
      setJsonText(JSON.stringify(cloned, null, 2));
      pushState(cloned);
    }
  }, [animationData, pushState]);

  const handlePreviewOpacity = useCallback((layerIndex: number, opacity: number) => {
    // Preview-only handler: updates canvas without pushing undo state
    if (!animationData) return;
    const cloned = JSON.parse(JSON.stringify(animationData));
    if (cloned.layers && cloned.layers[layerIndex] !== undefined) {
      const layer = cloned.layers[layerIndex];
      if (!layer.ks) layer.ks = {};
      if (!layer.ks.o) layer.ks.o = { a: 0, k: 100 };
      if (layer.ks.o.a === 1 && Array.isArray(layer.ks.o.k)) {
        // Animated opacity: set all keyframe values
        for (const kf of layer.ks.o.k) {
          if (kf && typeof kf === 'object' && 's' in kf) {
            kf.s = [opacity];
          }
          if (kf && typeof kf === 'object' && 'e' in kf) {
            kf.e = [opacity];
          }
        }
      } else {
        // Static opacity
        layer.ks.o.a = 0;
        layer.ks.o.k = opacity;
      }
      // Update canvas preview without pushing to undo history
      setAnimationData(cloned);
      setJsonText(JSON.stringify(cloned, null, 2));
    }
  }, [animationData]);

  const handleReorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    if (!animationData) return;
    const cloned = JSON.parse(JSON.stringify(animationData));
    if (cloned.layers && cloned.layers[fromIndex] !== undefined && cloned.layers[toIndex] !== undefined) {
      // Remove layer from fromIndex
      const [movedLayer] = cloned.layers.splice(fromIndex, 1);
      // Insert at toIndex
      cloned.layers.splice(toIndex, 0, movedLayer);
      setAnimationData(cloned);
      setJsonText(JSON.stringify(cloned, null, 2));
      pushState(cloned);
    }
  }, [animationData, pushState]);

  const handleCommand = useCallback((command: Command) => {
    switch (command.type) {
      case "play":
        setIsPlaying(true);
        break;
      case "pause":
        setIsPlaying(false);
        break;
      case "speed":
        setSpeed(command.speed);
        break;
      case "loop":
        setLoopConfig({ mode: "loop" });
        break;
      case "once":
        setLoopConfig({ mode: "once" });
        break;
      case "export_gif":
        handleExportGif({ preventDefault: () => {} } as MouseEvent);
        break;
      case "export_apng":
        handleExportApng({ preventDefault: () => {} } as MouseEvent);
        break;
      case "export_video":
        handleExportVideo({ preventDefault: () => {} } as MouseEvent);
        break;
      case "export_json":
        handleExport();
        break;
      case "export_dotlottie":
        handleExportDotLottie();
        break;
      case "undo":
        handleUndo();
        break;
      case "redo":
        handleRedo();
        break;
      case "resize":
        handleArtboardChange(command.width, command.height);
        break;
      case "background":
        handleBgChange(command.color as CanvasBackground);
        break;
      case "fullscreen":
        setFullscreenOpen(true);
        break;
      case "optimize":
        if (animationData) {
          const { optimized, stats } = optimizeLottie(animationData);
          setAnimationData(optimized as object);
          setJsonText(JSON.stringify(optimized, null, 2));
          pushState(optimized as object);
          const pct = stats.originalSize > 0
            ? Math.round((1 - stats.optimizedSize / stats.originalSize) * 100)
            : 0;
          const parts: string[] = [];
          if (stats.layersRemoved > 0) parts.push(`removed ${stats.layersRemoved} hidden layer${stats.layersRemoved > 1 ? "s" : ""}`);
          if (stats.groupsSimplified > 0) parts.push(`simplified ${stats.groupsSimplified} group${stats.groupsSimplified > 1 ? "s" : ""}`);
          if (stats.keyframesRemoved > 0) parts.push(`removed ${stats.keyframesRemoved} redundant keyframe${stats.keyframesRemoved > 1 ? "s" : ""}`);
          const sizeStr = `${(stats.originalSize / 1024).toFixed(1)} KB → ${(stats.optimizedSize / 1024).toFixed(1)} KB`;
          const summary = pct > 0
            ? `✨ Optimized! ${sizeStr} (${pct}% smaller)${parts.length ? ". " + parts.join(", ") : ""}`
            : `✨ Already optimized — no changes needed (${(stats.optimizedSize / 1024).toFixed(1)} KB)`;
          setInsertText(summary);
        }
        break;
      case "duration":
        if (animationData) {
          const rescaled = rescaleDuration(animationData, command.durationMs);
          setAnimationData(rescaled as object);
          setJsonText(JSON.stringify(rescaled, null, 2));
          pushState(rescaled as object);
          const secs = (command.durationMs / 1000).toFixed(1);
          setInsertText(`⏱️ Duration set to ${secs}s`);
        }
        break;
      case "goto": {
        const fr = (animationData as Record<string, unknown>)?.fr as number ?? 30;
        const ip = (animationData as Record<string, unknown>)?.ip as number ?? 0;
        const op = (animationData as Record<string, unknown>)?.op as number ?? totalFrames;
        const animTotalFrames = op - ip;
        let targetFrame: number;
        switch (command.target.unit) {
          case "frame":
            targetFrame = command.target.value;
            break;
          case "seconds":
            targetFrame = Math.round(command.target.value * fr);
            break;
          case "ms":
            targetFrame = Math.round((command.target.value / 1000) * fr);
            break;
          case "percent":
            targetFrame = Math.round((command.target.value / 100) * animTotalFrames);
            break;
        }
        targetFrame = Math.max(0, Math.min(targetFrame, animTotalFrames - 1));
        setSeekFrame(targetFrame);
        setIsPlaying(false);
        const timeAtFrame = (targetFrame / fr).toFixed(2);
        setInsertText(`⏭️ Seeked to frame ${targetFrame} (${timeAtFrame}s)`);
        break;
      }
      case "marker_add":
        if (animationData) {
          const cloned = JSON.parse(JSON.stringify(animationData)) as Record<string, unknown>;
          if (!Array.isArray(cloned.markers)) cloned.markers = [];
          const markers = cloned.markers as Array<{ cm: string; tm: number; dr: number }>;
          const existingIdx = markers.findIndex((m) => m.cm === command.name);
          const newMarker = { cm: command.name, tm: command.startFrame, dr: command.endFrame - command.startFrame };
          if (existingIdx >= 0) {
            markers[existingIdx] = newMarker;
          } else {
            markers.push(newMarker);
          }
          setAnimationData(cloned as object);
          setJsonText(JSON.stringify(cloned, null, 2));
          pushState(cloned as object);
        }
        break;
      case "marker_remove":
        if (animationData) {
          const cloned = JSON.parse(JSON.stringify(animationData)) as Record<string, unknown>;
          if (Array.isArray(cloned.markers)) {
            cloned.markers = (cloned.markers as Array<{ cm: string; tm: number; dr: number }>).filter((m) => m.cm !== command.name);
            if ((cloned.markers as unknown[]).length === 0) delete cloned.markers;
            setAnimationData(cloned as object);
            setJsonText(JSON.stringify(cloned, null, 2));
            pushState(cloned as object);
          }
        }
        break;
      case "marker_list":
        // Feedback handled in ChatPanel
        break;
      case "marker_clear":
        if (animationData) {
          const cloned = JSON.parse(JSON.stringify(animationData)) as Record<string, unknown>;
          delete cloned.markers;
          setAnimationData(cloned as object);
          setJsonText(JSON.stringify(cloned, null, 2));
          pushState(cloned as object);
        }
        break;
      case "compose":
        // Handled server-side via ChatPanel streamResponse — no-op here
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleUndo, handleRedo, handleArtboardChange, handleBgChange, animationData, pushState]);

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <Link
          href="/"
          aria-label="Go back to gallery"
          className="px-2 md:px-3 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors shrink-0"
        >
          &larr;
          <span className="hidden md:inline"> {t('editor.back')}</span>
        </Link>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Animation name"
          className="bg-transparent border-b border-zinc-700 text-zinc-100 text-base md:text-lg font-semibold px-1 py-0.5 focus:outline-none focus:border-zinc-400 transition-colors flex-1 min-w-0"
        />
        {remixedFrom && (
          <Link
            href={`/share/${remixedFrom.id}`}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 hover:bg-purple-500/20 transition-colors shrink-0"
            title={t('editor.remixedFrom', { name: remixedFrom.name })}
          >
            <span aria-hidden="true">✨</span>
            <span className="max-w-[150px] truncate">{t('editor.remixedFrom', { name: remixedFrom.name })}</span>
          </Link>
        )}
        {/* Desktop export dropdown */}
        <div data-tour="export" className="shrink-0">
        <ExportDropdown
          animationData={animationData}
          isNewMode={isNewMode}
          currentId={currentId}
          gifExporting={gifExporting}
          gifProgress={gifProgress}
          apngExporting={apngExporting}
          apngProgress={apngProgress}
          videoExporting={videoExporting}
          videoProgress={videoProgress}
          mp4Exporting={mp4Exporting}
          mp4Progress={mp4Progress}
          presetExporting={presetExporting}
          presetProgress={presetProgress}
          presetExportingId={presetExportingId}
          onExportJson={handleExport}
          onExportGif={handleExportGif}
          onExportApng={handleExportApng}
          onExportDotLottie={handleExportDotLottie}
          onExportVideo={handleExportVideo}
          onExportMp4={handleExportMp4}
          onExportPreset={handleExportPreset}
          onDuplicate={handleDuplicate}
          isDuplicating={duplicating}
        />
        </div>
        {!isNewMode && animationData && (
          <QualityPanel
            animationData={animationData}
            onSuggestionClick={(suggestion) => {
              setInsertText(suggestion);
              setRightPanel("chat");
              setMobileView("chat");
              setTimeout(() => setInsertText(""), 0);
            }}
          />
        )}
        <ThemeIndicator onClick={() => setThemePanelOpen((v) => !v)} />
        <button
          onClick={() => setEmbedOpen(true)}
          disabled={isNewMode}
          aria-label="Open embed dialog"
          className="hidden md:inline-flex px-4 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('editor.embed')}
        </button>
        <button
          onClick={handleToggleShareChat}
          disabled={isNewMode || shareChatSaving}
          title="Include chat history in share page"
          aria-label={shareChat ? "Chat history is shared" : "Share chat history"}
          aria-pressed={shareChat}
          className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            shareChat
              ? "border-emerald-600 text-emerald-400 hover:border-emerald-500"
              : "border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {shareChat ? "Chat shared" : "Share chat"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || animationData === null || isNewMode}
          aria-label="Save animation"
          className="px-3 md:px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {saving ? "..." : t('common.save')}
        </button>
        {saveStatus === "saved" && (
          <span className="text-emerald-400 text-sm shrink-0">✓</span>
        )}
        {saveStatus === "error" && (
          <span className="text-red-400 text-sm shrink-0">{t('editor.saveError')}</span>
        )}
        {/* Mobile overflow menu */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="true"
            className="px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
          >
            ⋯
          </button>
          {mobileMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
              <button
                onClick={() => { handleExport(); setMobileMenuOpen(false); }}
                disabled={animationData === null || isNewMode}
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
                onClick={(e) => { handleExportApng(e as unknown as MouseEvent); setMobileMenuOpen(false); }}
                disabled={animationData === null || apngExporting}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {apngExporting ? `Export APNG (${Math.round(apngProgress * 100)}%)` : "Export APNG"}
              </button>
              <button
                onClick={() => { handleExportDotLottie(); setMobileMenuOpen(false); }}
                disabled={animationData === null}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export .lottie
              </button>
              <button
                onClick={(e) => { handleExportVideo(e as unknown as MouseEvent); setMobileMenuOpen(false); }}
                disabled={animationData === null || videoExporting}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {videoExporting ? `Export Video (${Math.round(videoProgress * 100)}%)` : "Export Video"}
              </button>
              <button
                onClick={() => { setEmbedOpen(true); setMobileMenuOpen(false); }}
                disabled={isNewMode}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('editor.embed')}
              </button>
              <button
                onClick={() => { handleToggleShareChat(); setMobileMenuOpen(false); }}
                disabled={isNewMode || shareChatSaving}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shareChat ? "✓ Chat history shared" : "Share chat history"}
              </button>
              <button
                onClick={() => {
                  if (!currentId) return;
                  navigator.clipboard.writeText(`${window.location.origin}/share/${currentId}`);
                  setShareStatus("copied");
                  setTimeout(() => setShareStatus("idle"), 2000);
                  setMobileMenuOpen(false);
                }}
                disabled={isNewMode}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shareStatus === "copied" ? "✓ Link Copied" : "Copy Share Link"}
              </button>
              <div className="border-t border-zinc-700 my-1" />
              <button
                onClick={() => { handleDuplicate(); setMobileMenuOpen(false); }}
                disabled={isNewMode || duplicating}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {duplicating ? "Duplicating..." : t('common.duplicate')}
              </button>
            </div>
          )}
        </div>
        <LanguageSwitcher />
        <UserMenu />
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
          {t('editor.canvas')}
        </button>
        <button
          onClick={() => { setMobileView("chat"); setRightPanel("chat"); }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            mobileView === "chat"
              ? "text-zinc-100 border-b-2 border-zinc-100"
              : "text-zinc-400"
          }`}
        >
          {t('editor.chat')}
        </button>
        <button
          onClick={() => { setMobileView("layers"); setRightPanel("layers"); }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            mobileView === "layers"
              ? "text-zinc-100 border-b-2 border-zinc-100"
              : "text-zinc-400"
          }`}
        >
          {t('editor.layers')}
        </button>
      </div>

      {/* Main content */}
      <ErrorBoundary fallbackMessage={t('common.error')}>
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Preview panel - hidden on mobile when chat is active */}
        <div className={`flex-col md:w-1/2 md:min-h-0 md:border-r border-zinc-800 ${
          mobileView === "canvas" ? "flex flex-1" : "hidden md:flex"
        }`}>
          <div className="flex-1 p-4 min-h-0" data-tour="canvas">
            <ErrorBoundary
              key={currentId ?? "new"}
              fallbackMessage={t('common.error')}
              onReset={() => setAnimationData(animationData)}
            >
              <LottiePreview
                animationData={animationData}
                isPlaying={isPlaying}
                speed={speed}
                loopConfig={loopConfig}
                onFrameChange={handleFrameChange}
                seekToFrame={seekFrame}
                background={canvasBg}
                placeholder={isNewMode && animationData === null}
                ariaLabel={name || "Animation preview"}
              />
            </ErrorBoundary>
            {isNewMode && animationData === null && (
              <div className="mt-4">
                <ImportLottie onImported={handleAnimationCreated} />
              </div>
            )}
          </div>
          <KeyframeTimeline
            animationData={animationData}
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            onSeek={handleSeek}
            markers={animationData ? ((animationData as Record<string, unknown>).markers as Array<{ cm: string; tm: number; dr: number }>) ?? undefined : undefined}
            onPlaySegment={(start) => {
              setSeekFrame(start);
              setIsPlaying(true);
            }}
          />
          <div className="flex items-center border-t border-zinc-800" data-tour="controls">
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
            <div className="px-2 py-2 bg-zinc-900">
              <ArtboardPicker width={currentWidth} height={currentHeight} onChange={handleArtboardChange} />
            </div>
            <div className="px-2 py-2 bg-zinc-900">
              <BackgroundPicker value={canvasBg} onChange={handleBgChange} />
            </div>
            <div className="px-2 py-2 bg-zinc-900">
              <ColorPalette
                animationData={animationData}
                onChange={(updated) => {
                  setAnimationData(updated as object);
                  setJsonText(JSON.stringify(updated, null, 2));
                  pushState(updated as object);
                }}
              />
            </div>
            <div className="px-2 py-2 bg-zinc-900">
              <TimingEditor
                animationData={animationData}
                onChange={(updated) => {
                  setAnimationData(updated as object);
                  setJsonText(JSON.stringify(updated, null, 2));
                  pushState(updated as object);
                }}
              />
            </div>
            <div className="px-2 py-2 bg-zinc-900">
              <EasingEditor
                animationData={animationData}
                onChange={(updated) => {
                  setAnimationData(updated as object);
                  setJsonText(JSON.stringify(updated, null, 2));
                  pushState(updated as object);
                }}
              />
            </div>
            <div className="px-2 py-2 bg-zinc-900">
              <button
                onClick={() => setFullscreenOpen(true)}
                disabled={!animationData}
                title={t('editor.fullscreen')}
                aria-label="Toggle fullscreen preview"
                className="flex items-center justify-center w-8 h-8 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
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
          mobileView === "canvas" ? "hidden md:flex" : "flex"
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
              {t('editor.chat')}
            </button>
            <button
              onClick={() => setRightPanel("json")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                rightPanel === "json"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t('editor.json')}
            </button>
            <button
              onClick={() => setRightPanel("layers")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                rightPanel === "layers"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t('editor.layers')}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setShortcutsHelpOpen(true)}
              title={t('editor.shortcuts')}
              aria-label="Show keyboard shortcuts"
              className="px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-zinc-400 hover:text-zinc-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
              </svg>
            </button>
            <button
              onClick={() => setVersionPanelOpen((v) => !v)}
              disabled={isNewMode}
              title={t('editor.versions')}
              aria-label="Toggle version history"
              aria-expanded={versionPanelOpen}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                versionPanelOpen
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0" data-tour="chat-input">
            {rightPanel === "chat" ? (
              <ErrorBoundary fallbackMessage={t('common.error')}>
                <ChatPanel animationId={currentId ?? undefined} insertText={insertText} onAnimationCreated={handleAnimationCreated} onAnimationUpdated={handleAnimationUpdated} onCommand={handleCommand} initialPrompt={initialPrompt} />
              </ErrorBoundary>
            ) : rightPanel === "layers" ? (
              <LayerPanel
                animationData={animationData}
                onSelectLayer={handleSelectLayer}
                onToggleVisibility={handleToggleVisibility}
                onChangeOpacity={handleChangeOpacity}
                onPreviewOpacity={handlePreviewOpacity}
                onReorderLayers={handleReorderLayers}
              />
            ) : (
              <JsonEditor value={jsonText} onChange={handleJsonChange} />
            )}
          </div>
        </div>
      </div>
      </ErrorBoundary>
      {currentId && (
        <VersionHistory
          animationId={currentId}
          open={versionPanelOpen}
          onClose={() => setVersionPanelOpen(false)}
        />
      )}
      <ShortcutsHelp
        open={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCommand={handleCommand}
        onInsertText={(text) => {
          setInsertText(text);
          setRightPanel("chat");
          setMobileView("chat");
          setTimeout(() => setInsertText(""), 0);
        }}
        onNavigate={(path) => router.push(path)}
        onSave={handleSave}
        onToggleFullscreen={() => setFullscreenOpen((v) => !v)}
        onToggleJson={() => setRightPanel("json")}
        onToggleLayers={() => setRightPanel("layers")}
        onShowShortcuts={() => setShortcutsHelpOpen(true)}
        onExportJson={handleExport}
        onExportGif={() => handleExportGif({ preventDefault: () => {} } as MouseEvent)}
        onExportApng={() => handleExportApng({ preventDefault: () => {} } as MouseEvent)}
        onExportVideo={() => handleExportVideo({ preventDefault: () => {} } as MouseEvent)}
        onExportDotLottie={handleExportDotLottie}
      />
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
      {currentId && (
        <EmbedDialog
          animationId={currentId}
          open={embedOpen}
          onClose={() => setEmbedOpen(false)}
        />
      )}
      <ThemePanel open={themePanelOpen} onClose={() => setThemePanelOpen(false)} />
      <OnboardingTour />
    </div>
  );
}
