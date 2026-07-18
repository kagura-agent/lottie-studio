import { useState, useCallback } from "react";
import type { LoopConfig } from "@/types/loopConfig";

export interface PlaybackControls {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean | ((prev: boolean) => boolean)) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  loopConfig: LoopConfig;
  setLoopConfig: (config: LoopConfig | ((prev: LoopConfig) => LoopConfig)) => void;
  currentFrame: number;
  totalFrames: number;
  seekFrame: number | undefined;
  setSeekFrame: (frame: number | undefined) => void;
  handleFrameChange: (frame: number, total: number) => void;
  handleSeek: (frame: number) => void;
  handleRestart: () => void;
}

export function usePlaybackControls(currentId: string | null): PlaybackControls {
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
    setTimeout(() => setSeekFrame(undefined), 50);
  }, []);

  return {
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    loopConfig,
    setLoopConfig,
    currentFrame,
    totalFrames,
    seekFrame,
    setSeekFrame,
    handleFrameChange,
    handleSeek,
    handleRestart,
  };
}
