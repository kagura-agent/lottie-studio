"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";
import type { CanvasBackground } from "./BackgroundPicker";
import type { LoopConfig } from "@/types/loopConfig";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface LottiePreviewProps {
  animationData: object | null;
  isPlaying: boolean;
  speed: number;
  loopConfig: LoopConfig;
  onFrameChange?: (currentFrame: number, totalFrames: number) => void;
  seekToFrame?: number;
  background?: CanvasBackground;
  placeholder?: boolean;
  ariaLabel?: string;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;
const BUTTON_ZOOM_STEP = 0.25;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function getBackgroundStyle(bg: CanvasBackground = "checkered"): { className: string; style?: React.CSSProperties } {
  if (bg === "white") return { className: "bg-white" };
  if (bg === "black") return { className: "bg-black" };
  if (bg.startsWith("#")) return { className: "", style: { backgroundColor: bg } };
  // checkered (default)
  return {
    className: "bg-zinc-900",
    style: {
      backgroundImage:
        "linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
    },
  };
}

export default function LottiePreview({
  animationData,
  isPlaying,
  speed,
  loopConfig,
  onFrameChange,
  seekToFrame,
  background = "checkered",
  placeholder = false,
  ariaLabel = "Animated illustration",
}: LottiePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const frameCallbackRef = useRef(onFrameChange);
  const loopConfigRef = useRef(loopConfig);
  const directionRef = useRef<1 | -1>(1);
  const loopCountRef = useRef(0);

  const prefersReducedMotion = useReducedMotion();

  // Sync refs via effect to avoid updating during render
  useEffect(() => {
    frameCallbackRef.current = onFrameChange;
    loopConfigRef.current = loopConfig;
  });

  // Zoom & pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [useTransition, setUseTransition] = useState(false);

  const areaRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  // Refs for latest state in event handlers
  const scaleRef = useRef(scale);
  const translateRef = useRef(translate);
  useEffect(() => {
    scaleRef.current = scale;
    translateRef.current = translate;
  });

  // Pinch tracking
  const lastPinchDistRef = useRef<number | null>(null);

  const resetView = useCallback(() => {
    setUseTransition(true);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const zoomTo = useCallback((newScale: number, animated = true) => {
    setUseTransition(animated);
    setScale(clampZoom(newScale));
  }, []);

  // --- Wheel zoom (Ctrl/Cmd + scroll) ---
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom when ctrl/meta is held (standard pinch-to-zoom also fires with ctrlKey=true)
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const rect = area.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const oldScale = scaleRef.current;
      const delta = -e.deltaY * ZOOM_STEP * 0.01;
      const newScale = clampZoom(oldScale * (1 + delta));
      const ratio = newScale / oldScale;

      const oldTx = translateRef.current.x;
      const oldTy = translateRef.current.y;

      // Zoom toward cursor: adjust translate so the point under cursor stays fixed
      const newTx = cursorX - ratio * (cursorX - oldTx);
      const newTy = cursorY - ratio * (cursorY - oldTy);

      setUseTransition(false);
      setScale(newScale);
      setTranslate({ x: newTx, y: newTy });
    };

    area.addEventListener("wheel", handleWheel, { passive: false });
    return () => area.removeEventListener("wheel", handleWheel);
  }, []);

  // --- Touch pinch zoom ---
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    const getTouchDist = (touches: TouchList) => {
      if (touches.length < 2) return null;
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: TouchList, rect: DOMRect) => {
      const cx = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
      const cy = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
      return { x: cx, y: cy };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastPinchDistRef.current = getTouchDist(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = getTouchDist(e.touches);
        const lastDist = lastPinchDistRef.current;
        if (dist !== null && lastDist !== null) {
          e.preventDefault();
          const rect = area.getBoundingClientRect();
          const center = getTouchCenter(e.touches, rect);

          const oldScale = scaleRef.current;
          const ratio = dist / lastDist;
          const newScale = clampZoom(oldScale * ratio);
          const actualRatio = newScale / oldScale;

          const oldTx = translateRef.current.x;
          const oldTy = translateRef.current.y;
          const newTx = center.x - actualRatio * (center.x - oldTx);
          const newTy = center.y - actualRatio * (center.y - oldTy);

          setUseTransition(false);
          setScale(newScale);
          setTranslate({ x: newTx, y: newTy });
        }
        lastPinchDistRef.current = dist;
      }
    };

    const handleTouchEnd = () => {
      lastPinchDistRef.current = null;
    };

    area.addEventListener("touchstart", handleTouchStart, { passive: true });
    area.addEventListener("touchmove", handleTouchMove, { passive: false });
    area.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      area.removeEventListener("touchstart", handleTouchStart);
      area.removeEventListener("touchmove", handleTouchMove);
      area.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // --- Drag to pan ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only left button, and only when zoomed
    if (e.button !== 0) return;
    if (scaleRef.current <= 1 && translateRef.current.x === 0 && translateRef.current.y === 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: translateRef.current.x,
      ty: translateRef.current.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setUseTransition(false);
    setTranslate({
      x: dragStartRef.current.tx + dx,
      y: dragStartRef.current.ty + dy,
    });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isHovered) return;
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setUseTransition(true);
        setScale((s) => clampZoom(s + BUTTON_ZOOM_STEP));
      } else if (e.key === "-") {
        e.preventDefault();
        setUseTransition(true);
        setScale((s) => clampZoom(s - BUTTON_ZOOM_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setUseTransition(true);
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHovered]);

  // --- Double-click to reset ---
  const handleDoubleClick = useCallback(() => {
    resetView();
  }, [resetView]);

  // --- Lottie animation lifecycle (unchanged) ---
  const destroyAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !animationData) {
      destroyAnim();
      return;
    }

    destroyAnim();
    directionRef.current = 1;
    loopCountRef.current = 0;

    let cancelled = false;

    const needsLoop = loopConfig.mode === "loop" || loopConfig.mode === "bounce";

    const init = async () => {
      try {
        const anim = await loadAnimation({
          container: containerRef.current!,
          renderer: "svg",
          loop: needsLoop,
          autoplay: isPlaying && !prefersReducedMotion,
          animationData,
        });

        if (cancelled) {
          anim.destroy();
          return;
        }

        anim.setSpeed(speed);
        anim.setDirection(1);

        anim.addEventListener("enterFrame", () => {
          frameCallbackRef.current?.(
            Math.floor(anim.currentFrame),
            Math.floor(anim.totalFrames)
          );
        });

        anim.addEventListener("loopComplete", () => {
          const cfg = loopConfigRef.current;
          if (cfg.mode === "bounce") {
            directionRef.current = directionRef.current === 1 ? -1 : 1;
            anim.setDirection(directionRef.current);
          }
        });

        anim.addEventListener("complete", () => {
          const cfg = loopConfigRef.current;
          if (cfg.mode === "count") {
            loopCountRef.current++;
            const target = cfg.count ?? 3;
            if (loopCountRef.current < target) {
              anim.goToAndPlay(0, true);
            }
          }
        });

        animRef.current = anim;
      } catch {
        // invalid animation data
      }
    };

    init();

    return () => {
      cancelled = true;
      destroyAnim();
    };
    // Re-create animation when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData]);

  useEffect(() => {
    if (!animRef.current) return;
    if (prefersReducedMotion) {
      animRef.current.goToAndStop(0, true);
      return;
    }
    if (isPlaying) {
      animRef.current.play();
    } else {
      animRef.current.pause();
    }
  }, [isPlaying, prefersReducedMotion]);

  useEffect(() => {
    if (animRef.current) {
      animRef.current.setSpeed(speed);
    }
  }, [speed]);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;

    directionRef.current = 1;
    loopCountRef.current = 0;
    anim.setDirection(1);

    if (loopConfig.mode === "loop") {
      anim.loop = true;
    } else if (loopConfig.mode === "once") {
      anim.loop = false;
    } else if (loopConfig.mode === "bounce") {
      anim.loop = true;
    } else if (loopConfig.mode === "count") {
      anim.loop = false;
      loopCountRef.current = 0;
    }

    if (isPlaying) {
      anim.goToAndPlay(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopConfig]);

  useEffect(() => {
    if (animRef.current && seekToFrame !== undefined) {
      animRef.current.goToAndStop(seekToFrame, true);
    }
  }, [seekToFrame]);

  // Auto-pause and show first frame when reduced motion is preferred
  useEffect(() => {
    if (prefersReducedMotion && animRef.current) {
      animRef.current.goToAndStop(0, true);
    }
  }, [prefersReducedMotion]);

  const bgProps = getBackgroundStyle(background);

  const isZoomed = scale !== 1 || translate.x !== 0 || translate.y !== 0;
  const cursorStyle = isDragging ? "cursor-grabbing" : isZoomed ? "cursor-grab" : "";
  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      ref={areaRef}
      role="img"
      aria-label={ariaLabel}
      className={`preview-area relative flex items-center justify-center flex-1 rounded-lg overflow-hidden touch-manipulation ${bgProps.className} ${cursorStyle}`}
      style={bgProps.style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {animationData ? (
        <div
          className="w-full h-full max-w-[500px] max-h-[500px]"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            transition: useTransition ? "transform 0.2s ease-out" : "none",
            willChange: "transform",
          }}
        >
          <div ref={containerRef} className="w-full h-full" />
        </div>
      ) : placeholder ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <svg
            className="w-16 h-16 text-zinc-600 animate-pulse"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <p className="text-zinc-500 text-sm font-medium">Describe your animation to begin</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/50 rounded-lg">
          <span className="text-red-400 text-sm font-mono">Invalid JSON</span>
        </div>
      )}

      {animationData && prefersReducedMotion && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-zinc-800/80 backdrop-blur-sm px-2 py-1 shadow border border-zinc-700/50">
          <span className="text-zinc-400 text-xs">Motion paused</span>
        </div>
      )}

      {/* Floating zoom controls */}
      {animationData && (
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-zinc-800/80 backdrop-blur-sm px-1.5 py-1 shadow-lg border border-zinc-700/50"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Zoom out (−)"
            aria-label="Zoom out"
            className="flex items-center justify-center w-6 h-6 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={scale <= MIN_ZOOM}
            onClick={() => zoomTo(scale - BUTTON_ZOOM_STEP)}
          >
            −
          </button>
          <span
            className="text-zinc-400 text-xs font-mono min-w-[3rem] text-center select-none"
            title="Current zoom level"
          >
            {zoomPercent}%
          </span>
          <button
            type="button"
            title="Zoom in (+)"
            aria-label="Zoom in"
            className="flex items-center justify-center w-6 h-6 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={scale >= MAX_ZOOM}
            onClick={() => zoomTo(scale + BUTTON_ZOOM_STEP)}
          >
            +
          </button>
          <div className="w-px h-4 bg-zinc-600 mx-0.5" />
          <button
            type="button"
            title="Fit to view (0)"
            aria-label="Reset zoom to fit view"
            className="flex items-center justify-center h-6 px-1.5 rounded text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors text-[10px] font-medium uppercase tracking-wide"
            onClick={resetView}
          >
            Fit
          </button>
        </div>
      )}
    </div>
  );
}
