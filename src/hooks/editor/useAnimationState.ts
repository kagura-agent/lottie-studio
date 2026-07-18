import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/contexts/ToastContext";
import { useAnimationHistory } from "@/hooks/useAnimationHistory";
import { useBeforeAfter } from "@/hooks/useBeforeAfter";
import { useAnimationSocket } from "@/hooks/useAnimationSocket";
import { useProgressivePreview } from "@/hooks/chat/useProgressivePreview";
import { saveAnimation } from "@/lib/offlineStorage";
import type { CanvasBackground } from "@/components/BackgroundPicker";

export interface AnimationStateReturn {
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  animationData: object | null;
  setAnimationData: (data: object | null) => void;
  jsonText: string;
  setJsonText: (text: string) => void;
  name: string;
  setName: (name: string) => void;
  saving: boolean;
  saveStatus: "idle" | "saved" | "error";
  duplicating: boolean;
  shareChatSaving: boolean;
  shareStatus: "idle" | "copied";
  setShareStatus: (status: "idle" | "copied") => void;
  insertText: string;
  setInsertText: (text: string) => void;
  selectedLayerIndex: number | null;
  setSelectedLayerIndex: (index: number | null) => void;
  canvasBg: CanvasBackground;
  isNewMode: boolean;
  currentWidth: number;
  currentHeight: number;
  progressivePreviewData: object | null;
  isPreviewActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  beforeAfter: ReturnType<typeof useBeforeAfter>;
  pushState: (data: object) => void;
  handleSave: () => Promise<void>;
  handleDuplicate: () => Promise<void>;
  handleToggleShareChat: () => Promise<void>;
  handleBgChange: (bg: CanvasBackground) => void;
  handleArtboardChange: (w: number, h: number) => void;
  handleExternalUpdate: () => Promise<void>;
  handleAnimationCreated: (newId: string, newData?: object) => Promise<void>;
  handleAnimationUpdated: (animId: string, data: object) => void;
  handleProgressivePreview: (data: object | null) => void;
  handleJsonChange: (value: string) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleSelectLayer: (layerName: string, layerIndex: number) => void;
  handleToggleVisibility: (layerIndex: number, hidden: boolean) => void;
  handleChangeOpacity: (layerIndex: number, opacity: number) => void;
  handlePreviewOpacity: (layerIndex: number, opacity: number) => void;
  handleReorderLayers: (fromIndex: number, toIndex: number) => void;
}

export function useAnimationState(
  id: string | null,
  initialName: string,
  initialData: object | null,
  shareChat: boolean,
  setShareChat: (val: boolean | ((prev: boolean) => boolean)) => void,
  router: { push: (path: string) => void },
): AnimationStateReturn {
  const { toast } = useToast();
  const [currentId, setCurrentId] = useState<string | null>(id);
  const [duplicating, setDuplicating] = useState(false);
  const [jsonText, setJsonText] = useState(() => initialData ? JSON.stringify(initialData, null, 2) : "");
  const [animationData, setAnimationData] = useState<object | null>(initialData);
  const { previewData: progressivePreviewData, isPreviewActive, updatePreview: updateProgressivePreview, clearPreview: clearProgressivePreview } = useProgressivePreview();
  const { pushState, undo, redo, canUndo, canRedo } = useAnimationHistory(initialData ?? {});
  const beforeAfter = useBeforeAfter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [shareChatSaving, setShareChatSaving] = useState(false);
  const [insertText, setInsertText] = useState("");
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);
  const [canvasBg, setCanvasBg] = useState<CanvasBackground>(() => {
    if (typeof window !== "undefined" && currentId) {
      return (localStorage.getItem(`lottie-bg-${currentId}`) as CanvasBackground) || "checkered";
    }
    return "checkered";
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNewMode = currentId === null;
  const currentWidth = (animationData as Record<string, unknown>)?.w as number ?? 512;
  const currentHeight = (animationData as Record<string, unknown>)?.h as number ?? 512;

  const handleBgChange = useCallback((bg: CanvasBackground) => {
    setCanvasBg(bg);
    if (currentId) localStorage.setItem(`lottie-bg-${currentId}`, bg);
  }, [currentId]);

  const handleArtboardChange = useCallback((w: number, h: number) => {
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
    } catch { /* ignore */ }
  }, [currentId, pushState]);

  useAnimationSocket(currentId, handleExternalUpdate);

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
  }, [currentId, setShareChat]);

  useEffect(() => {
    if (!currentId || !shareChat) return;
    fetch(`/api/animations/${currentId}/view`, { method: "POST" }).catch(() => {});
  }, [currentId, shareChat]);

  const handleAnimationCreated = useCallback(async (newId: string, newData?: object) => {
    setCurrentId(newId);
    if (newData) {
      if (animationData) {
        beforeAfter.setBeforeState(animationData);
        beforeAfter.setAfterState(newData);
      }
      const text = JSON.stringify(newData, null, 2);
      setJsonText(text);
      setAnimationData(newData);
      pushState(newData);
      saveAnimation(newId, name, newData, { synced: true }).catch(() => {});
    } else {
      try {
        const res = await fetch(`/api/animations/${newId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.data) {
            if (animationData) {
              beforeAfter.setBeforeState(animationData);
              beforeAfter.setAfterState(result.data);
            }
            setJsonText(JSON.stringify(result.data, null, 2));
            setAnimationData(result.data);
            pushState(result.data);
            saveAnimation(newId, result.name || name, result.data, { synced: true }).catch(() => {});
          }
          if (result.name) setName(result.name);
        }
      } catch { /* ignore */ }
    }
    window.history.replaceState(null, '', `/editor/${newId}`);
  }, [pushState, name, animationData, beforeAfter]);

  const handleAnimationUpdated = useCallback((animId: string, data: object) => {
    clearProgressivePreview();
    import("@/lib/captureThumbnail").then(({ captureAndUploadThumbnail }) => {
      captureAndUploadThumbnail(animId, data);
    });
    saveAnimation(animId, name, data, { synced: true }).catch(() => {});
  }, [name, clearProgressivePreview]);

  const handleProgressivePreview = useCallback((data: object | null) => {
    if (data) {
      updateProgressivePreview(data as import("@/lib/partial-lottie").PartialLottie);
    } else {
      clearProgressivePreview();
    }
  }, [updateProgressivePreview, clearProgressivePreview]);

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
      const res = await fetch(`/api/animations/${currentId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Duplicate failed");
      const result = await res.json();
      const newId = result.id;
      if (newId) {
        router.push(`/editor/${newId}`);
        toast({ message: "Animation duplicated!", type: "success" });
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
        setShareChat(!newValue);
      }
    } catch {
      setShareChat(!newValue);
    } finally {
      setShareChatSaving(false);
    }
  }, [currentId, shareChat, shareChatSaving, setShareChat]);

  const handleSelectLayer = useCallback((layerName: string, layerIndex: number) => {
    setInsertText(layerName);
    setSelectedLayerIndex(layerIndex);
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
        for (const kf of layer.ks.o.k) {
          if (kf && typeof kf === 'object' && 's' in kf) kf.s = [opacity];
          if (kf && typeof kf === 'object' && 'e' in kf) kf.e = [opacity];
        }
      } else {
        layer.ks.o.a = 0;
        layer.ks.o.k = opacity;
      }
      setAnimationData(cloned);
      setJsonText(JSON.stringify(cloned, null, 2));
      pushState(cloned);
    }
  }, [animationData, pushState]);

  const handlePreviewOpacity = useCallback((layerIndex: number, opacity: number) => {
    if (!animationData) return;
    const cloned = JSON.parse(JSON.stringify(animationData));
    if (cloned.layers && cloned.layers[layerIndex] !== undefined) {
      const layer = cloned.layers[layerIndex];
      if (!layer.ks) layer.ks = {};
      if (!layer.ks.o) layer.ks.o = { a: 0, k: 100 };
      if (layer.ks.o.a === 1 && Array.isArray(layer.ks.o.k)) {
        for (const kf of layer.ks.o.k) {
          if (kf && typeof kf === 'object' && 's' in kf) kf.s = [opacity];
          if (kf && typeof kf === 'object' && 'e' in kf) kf.e = [opacity];
        }
      } else {
        layer.ks.o.a = 0;
        layer.ks.o.k = opacity;
      }
      setAnimationData(cloned);
      setJsonText(JSON.stringify(cloned, null, 2));
    }
  }, [animationData]);

  const handleReorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    if (!animationData) return;
    const cloned = JSON.parse(JSON.stringify(animationData));
    if (cloned.layers && cloned.layers[fromIndex] !== undefined && cloned.layers[toIndex] !== undefined) {
      const [movedLayer] = cloned.layers.splice(fromIndex, 1);
      cloned.layers.splice(toIndex, 0, movedLayer);
      setAnimationData(cloned);
      setJsonText(JSON.stringify(cloned, null, 2));
      pushState(cloned);
    }
  }, [animationData, pushState]);

  return {
    currentId,
    setCurrentId,
    animationData,
    setAnimationData,
    jsonText,
    setJsonText,
    name,
    setName,
    saving,
    saveStatus,
    duplicating,
    shareChatSaving,
    shareStatus,
    setShareStatus,
    insertText,
    setInsertText,
    selectedLayerIndex,
    setSelectedLayerIndex,
    canvasBg,
    isNewMode,
    currentWidth,
    currentHeight,
    progressivePreviewData,
    isPreviewActive,
    canUndo,
    canRedo,
    beforeAfter,
    pushState,
    handleSave,
    handleDuplicate,
    handleToggleShareChat,
    handleBgChange,
    handleArtboardChange,
    handleExternalUpdate,
    handleAnimationCreated,
    handleAnimationUpdated,
    handleProgressivePreview,
    handleJsonChange,
    handleUndo,
    handleRedo,
    handleSelectLayer,
    handleToggleVisibility,
    handleChangeOpacity,
    handlePreviewOpacity,
    handleReorderLayers,
  };
}
