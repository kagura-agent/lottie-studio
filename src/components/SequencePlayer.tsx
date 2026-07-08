"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";

interface SequenceItem {
  animation_id: string;
  animation_name: string | null;
  position: number;
  transition_type: string;
  transition_duration_ms: number;
}

interface SequenceData {
  id: string;
  name: string;
  items: SequenceItem[];
}

interface SequencePlayerProps {
  sequenceId: string;
}

export default function SequencePlayer({ sequenceId }: SequencePlayerProps) {
  const t = useTranslations("sequencePlayer");
  const [sequenceData, setSequenceData] = useState<SequenceData | null>(null);
  const [animationDataMap, setAnimationDataMap] = useState<Record<string, object>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);
  const animARef = useRef<AnimationItem | null>(null);
  const animBRef = useRef<AnimationItem | null>(null);
  const activeSlot = useRef<"A" | "B">("A");
  const currentSceneRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isLoopingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    currentSceneRef.current = currentScene;
    isPlayingRef.current = isPlaying;
    isLoopingRef.current = isLooping;
  }, [currentScene, isPlaying, isLooping]);

  // Fetch sequence data and all animation JSONs
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const seqRes = await fetch(`/api/sequences/${sequenceId}`);
        if (!seqRes.ok) {
          setError("Failed to load sequence");
          setLoading(false);
          return;
        }
        const seq: SequenceData = await seqRes.json();
        if (cancelled) return;

        if (seq.items.length === 0) {
          setSequenceData(seq);
          setLoading(false);
          return;
        }

        // Fetch all animation data in parallel
        const dataMap: Record<string, object> = {};
        await Promise.all(
          seq.items.map(async (item) => {
            if (dataMap[item.animation_id]) return;
            const res = await fetch(`/api/animations/${item.animation_id}`);
            if (res.ok) {
              const anim = await res.json();
              if (anim.data) dataMap[item.animation_id] = anim.data;
            }
          })
        );

        if (cancelled) return;
        setSequenceData(seq);
        setAnimationDataMap(dataMap);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Failed to load sequence");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sequenceId]);

  const destroyAnim = useCallback((slot: "A" | "B") => {
    const ref = slot === "A" ? animARef : animBRef;
    if (ref.current) {
      ref.current.destroy();
      ref.current = null;
    }
  }, []);

  const loadScene = useCallback(async (sceneIndex: number, slot: "A" | "B"): Promise<AnimationItem | null> => {
    if (!sequenceData) return null;
    const item = sequenceData.items[sceneIndex];
    if (!item) return null;

    const data = animationDataMap[item.animation_id];
    if (!data) return null;

    const container = slot === "A" ? containerARef.current : containerBRef.current;
    if (!container) return null;

    destroyAnim(slot);

    const ref = slot === "A" ? animARef : animBRef;
    try {
      ref.current = await loadAnimation({
        container,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: data,
      });
      return ref.current;
    } catch {
      return null;
    }
  }, [sequenceData, animationDataMap, destroyAnim]);

  const applyTransition = useCallback((
    type: string,
    durationMs: number,
    fromSlot: "A" | "B",
    toSlot: "A" | "B"
  ) => {
    const fromEl = (fromSlot === "A" ? containerARef : containerBRef).current;
    const toEl = (toSlot === "A" ? containerARef : containerBRef).current;
    if (!fromEl || !toEl) return Promise.resolve();

    if (type === "cut") {
      fromEl.style.opacity = "0";
      fromEl.style.transform = "";
      toEl.style.opacity = "1";
      toEl.style.transform = "";
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const dur = `${durationMs}ms`;

      if (type === "fade") {
        toEl.style.opacity = "0";
        toEl.style.transition = `opacity ${dur} ease-in-out`;
        fromEl.style.transition = `opacity ${dur} ease-in-out`;
        // Force reflow
        void toEl.offsetHeight;
        toEl.style.opacity = "1";
        fromEl.style.opacity = "0";
      } else if (type === "slide-left") {
        toEl.style.transform = "translateX(100%)";
        toEl.style.opacity = "1";
        toEl.style.transition = `transform ${dur} ease-in-out`;
        fromEl.style.transition = `transform ${dur} ease-in-out`;
        void toEl.offsetHeight;
        toEl.style.transform = "translateX(0)";
        fromEl.style.transform = "translateX(-100%)";
      } else if (type === "slide-right") {
        toEl.style.transform = "translateX(-100%)";
        toEl.style.opacity = "1";
        toEl.style.transition = `transform ${dur} ease-in-out`;
        fromEl.style.transition = `transform ${dur} ease-in-out`;
        void toEl.offsetHeight;
        toEl.style.transform = "translateX(0)";
        fromEl.style.transform = "translateX(100%)";
      } else {
        // Fallback: cut
        fromEl.style.opacity = "0";
        toEl.style.opacity = "1";
        resolve();
        return;
      }

      setTimeout(() => {
        fromEl.style.transition = "";
        toEl.style.transition = "";
        fromEl.style.transform = "";
        resolve();
      }, durationMs);
    });
  }, []);

  const advanceScene = useCallback(async () => {
    if (!sequenceData || transitioning) return;

    const nextIndex = currentSceneRef.current + 1;

    if (nextIndex >= sequenceData.items.length) {
      if (isLoopingRef.current) {
        // Loop back to start
        setTransitioning(true);
        const nextSlot = activeSlot.current === "A" ? "B" : "A";
        const anim = await loadScene(0, nextSlot);

        const item = sequenceData.items[0];
        await applyTransition(
          item.transition_type,
          item.transition_duration_ms,
          activeSlot.current,
          nextSlot
        );

        destroyAnim(activeSlot.current);
        activeSlot.current = nextSlot;
        setCurrentScene(0);
        setTransitioning(false);
        if (anim && isPlayingRef.current) anim.play();
      } else {
        setIsPlaying(false);
      }
      return;
    }

    setTransitioning(true);
    const nextSlot = activeSlot.current === "A" ? "B" : "A";
    const anim = await loadScene(nextIndex, nextSlot);

    const nextItem = sequenceData.items[nextIndex];
    await applyTransition(
      nextItem.transition_type,
      nextItem.transition_duration_ms,
      activeSlot.current,
      nextSlot
    );

    destroyAnim(activeSlot.current);
    activeSlot.current = nextSlot;
    setCurrentScene(nextIndex);
    setTransitioning(false);
    if (anim && isPlayingRef.current) anim.play();
  }, [sequenceData, transitioning, loadScene, applyTransition, destroyAnim]);

  // Listen for animation complete to advance scenes
  useEffect(() => {
    const currentAnim = activeSlot.current === "A" ? animARef.current : animBRef.current;
    if (!currentAnim) return;

    const handler = () => {
      if (isPlayingRef.current) advanceScene();
    };
    currentAnim.addEventListener("complete", handler);
    return () => { currentAnim.removeEventListener("complete", handler); };
  }, [currentScene, isPlaying, advanceScene]);

  // Start playback: load first scene
  const handlePlay = useCallback(async () => {
    if (!sequenceData || sequenceData.items.length === 0) return;

    const currentAnim = activeSlot.current === "A" ? animARef.current : animBRef.current;
    if (currentAnim) {
      currentAnim.play();
      setIsPlaying(true);
      return;
    }

    // Load first scene
    const anim = await loadScene(currentScene, activeSlot.current);
    const container = activeSlot.current === "A" ? containerARef.current : containerBRef.current;
    if (container) {
      container.style.opacity = "1";
      container.style.transform = "";
    }
    if (anim) {
      anim.play();
      setIsPlaying(true);
    }
  }, [sequenceData, currentScene, loadScene]);

  const handlePause = useCallback(() => {
    const currentAnim = activeSlot.current === "A" ? animARef.current : animBRef.current;
    if (currentAnim) currentAnim.pause();
    setIsPlaying(false);
  }, []);

  const handleRestart = useCallback(async () => {
    destroyAnim("A");
    destroyAnim("B");
    activeSlot.current = "A";
    setCurrentScene(0);
    setIsPlaying(false);
    setTransitioning(false);

    if (containerARef.current) {
      containerARef.current.style.opacity = "1";
      containerARef.current.style.transform = "";
    }
    if (containerBRef.current) {
      containerBRef.current.style.opacity = "0";
      containerBRef.current.style.transform = "";
    }

    // Auto-play from start
    if (sequenceData && sequenceData.items.length > 0) {
      const anim = await loadScene(0, "A");
      if (anim) {
        anim.play();
        setIsPlaying(true);
      }
    }
  }, [sequenceData, loadScene, destroyAnim]);

  const handleNextScene = useCallback(() => {
    if (!sequenceData) return;
    if (currentSceneRef.current < sequenceData.items.length - 1) {
      advanceScene();
    }
  }, [sequenceData, advanceScene]);

  const handlePrevScene = useCallback(async () => {
    if (!sequenceData || currentScene <= 0) return;

    const prevIndex = currentScene - 1;
    destroyAnim(activeSlot.current);

    const anim = await loadScene(prevIndex, activeSlot.current);
    const container = activeSlot.current === "A" ? containerARef.current : containerBRef.current;
    if (container) {
      container.style.opacity = "1";
      container.style.transform = "";
    }
    setCurrentScene(prevIndex);
    if (anim && isPlaying) anim.play();
  }, [sequenceData, currentScene, isPlaying, loadScene, destroyAnim]);

  const goToScene = useCallback(async (index: number) => {
    if (!sequenceData || index < 0 || index >= sequenceData.items.length) return;
    if (index === currentScene) return;

    destroyAnim(activeSlot.current);
    const anim = await loadScene(index, activeSlot.current);
    const container = activeSlot.current === "A" ? containerARef.current : containerBRef.current;
    if (container) {
      container.style.opacity = "1";
      container.style.transform = "";
    }
    setCurrentScene(index);
    if (anim && isPlaying) anim.play();
  }, [sequenceData, currentScene, isPlaying, loadScene, destroyAnim]);

  // Cleanup on unmount
  useEffect(() => {
    const animA = animARef.current;
    const animB = animBRef.current;
    return () => {
      animA?.destroy();
      animB?.destroy();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-zinc-400 text-sm">
        <svg className="w-4 h-4 animate-spin mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {t("loading")}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm">{error}</div>;
  }

  if (!sequenceData || sequenceData.items.length === 0) {
    return <div className="p-4 text-zinc-400 text-sm">{t("noAnimations")}</div>;
  }

  return (
    <div className="w-full max-w-sm mx-auto my-2">
      {/* Player canvas */}
      <div className="relative w-full aspect-square rounded-lg bg-zinc-800/50 border border-zinc-600/30 overflow-hidden">
        <div
          ref={containerARef}
          className="absolute inset-0"
          style={{ opacity: 1 }}
          data-testid="sequence-slot-a"
        />
        <div
          ref={containerBRef}
          className="absolute inset-0"
          style={{ opacity: 0 }}
          data-testid="sequence-slot-b"
        />
      </div>

      {/* Progress indicator */}
      <div className="mt-2 text-center text-xs text-zinc-400">
        {t("scene", { current: currentScene + 1, total: sequenceData.items.length })}
        {isPlaying && <span className="ml-2 text-green-400">{t("playing")}</span>}
        {!isPlaying && currentScene > 0 && <span className="ml-2 text-zinc-500">{t("paused")}</span>}
      </div>

      {/* Controls bar */}
      <div className="mt-2 flex items-center justify-center gap-1">
        <button
          onClick={handleRestart}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          aria-label={t("restart")}
          title={t("restart")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M3.6 3.6A6 6 0 0 1 14 8a.75.75 0 0 0 1.5 0 7.5 7.5 0 1 0-2.608 5.693.75.75 0 1 0-.884-1.21A6 6 0 1 1 3.6 3.6Z" />
            <path d="M7.25 1.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Z" />
            <path d="M4 4.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 4 4.25Z" />
          </svg>
        </button>
        <button
          onClick={handlePrevScene}
          disabled={currentScene <= 0}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t("prevScene")}
          title={t("prevScene")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M12.78 3.22a.75.75 0 0 1 0 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" />
            <path d="M6.78 3.22a.75.75 0 0 1 0 1.06L3.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L1.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" />
          </svg>
        </button>
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          aria-label={isPlaying ? t("pause") : t("play")}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2ZM9.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M3 3.732a1.5 1.5 0 0 1 2.305-1.265l6.706 4.267a1.5 1.5 0 0 1 0 2.531l-6.706 4.268A1.5 1.5 0 0 1 3 12.267V3.732Z" />
            </svg>
          )}
        </button>
        <button
          onClick={handleNextScene}
          disabled={!sequenceData || currentScene >= sequenceData.items.length - 1}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t("nextScene")}
          title={t("nextScene")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M3.22 12.78a.75.75 0 0 1 0-1.06L6.94 8 3.22 4.28a.75.75 0 0 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z" />
            <path d="M9.22 12.78a.75.75 0 0 1 0-1.06L12.94 8 9.22 4.28a.75.75 0 0 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z" />
          </svg>
        </button>
        <button
          onClick={() => setIsLooping((prev) => !prev)}
          className={`p-1.5 rounded transition-colors ${
            isLooping ? "text-indigo-400 bg-indigo-500/20" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
          }`}
          aria-label={t("loop")}
          title={t("loop")}
          aria-pressed={isLooping}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.456a.75.75 0 0 1-1.5 0V9.342a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.84a4.5 4.5 0 0 0 7.08-.68.75.75 0 0 1 1.274.724Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Scene list */}
      <div className="mt-2 flex gap-1 overflow-x-auto px-1 py-1" role="tablist" aria-label="Scenes">
        {sequenceData.items.map((item, index) => (
          <button
            key={item.animation_id + "-" + index}
            onClick={() => goToScene(index)}
            role="tab"
            aria-selected={index === currentScene}
            className={`shrink-0 px-2 py-1 rounded text-xs transition-colors ${
              index === currentScene
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {item.animation_name || `Scene ${index + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}
