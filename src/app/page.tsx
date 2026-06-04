"use client";

import { useState, useCallback, DragEvent } from "react";
import { DEFAULT_ANIMATION } from "@/data/sakura-hello";
import LottiePreview from "@/components/LottiePreview";
import JsonEditor from "@/components/JsonEditor";
import Controls from "@/components/Controls";

function tryParse(text: string): object | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch {
    return null;
  }
}

const initialJson = JSON.stringify(DEFAULT_ANIMATION, null, 2);

export default function Home() {
  const [jsonText, setJsonText] = useState(initialJson);
  const [animationData, setAnimationData] = useState<object | null>(
    DEFAULT_ANIMATION
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [seekFrame, setSeekFrame] = useState<number | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  const handleJsonChange = useCallback((value: string) => {
    setJsonText(value);
    setAnimationData(tryParse(value));
    setSeekFrame(undefined);
  }, []);

  const handleFrameChange = useCallback(
    (current: number, total: number) => {
      setCurrentFrame(current);
      setTotalFrames(total);
    },
    []
  );

  const handleSeek = useCallback((frame: number) => {
    setSeekFrame(frame);
    setIsPlaying(false);
    setCurrentFrame(frame);
  }, []);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setJsonText(text);
        setAnimationData(tryParse(text));
        setSeekFrame(undefined);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex flex-1 h-screen">
      <div
        className="relative w-1/2 border-r border-zinc-800"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <JsonEditor value={jsonText} onChange={handleJsonChange} />
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 border-2 border-dashed border-zinc-500 rounded-lg z-10">
            <span className="text-zinc-300 text-lg">Drop .json file here</span>
          </div>
        )}
      </div>

      <div className="flex flex-col w-1/2">
        <LottiePreview
          animationData={animationData}
          isPlaying={isPlaying}
          speed={speed}
          loop={loop}
          onFrameChange={handleFrameChange}
          seekToFrame={seekFrame}
        />
        <Controls
          isPlaying={isPlaying}
          onTogglePlay={() => {
            setIsPlaying((p) => !p);
            setSeekFrame(undefined);
          }}
          speed={speed}
          onSpeedChange={setSpeed}
          loop={loop}
          onToggleLoop={() => setLoop((l) => !l)}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
