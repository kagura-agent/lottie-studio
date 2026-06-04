"use client";

interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  loop: boolean;
  onToggleLoop: () => void;
  currentFrame: number;
  totalFrames: number;
  onSeek: (frame: number) => void;
}

export default function Controls({
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
  loop,
  onToggleLoop,
  currentFrame,
  totalFrames,
  onSeek,
}: ControlsProps) {
  const speeds = [0.5, 1, 2];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-t border-zinc-800">
      <button
        onClick={onTogglePlay}
        className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="flex gap-1">
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              speed === s
                ? "bg-zinc-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <button
        onClick={onToggleLoop}
        className={`px-3 py-1.5 rounded text-sm transition-colors ${
          loop
            ? "bg-zinc-600 text-white"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
        }`}
      >
        Loop
      </button>

      <input
        type="range"
        min={0}
        max={Math.max(totalFrames - 1, 0)}
        value={currentFrame}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 accent-zinc-400"
      />

      <span className="text-xs text-zinc-400 font-mono whitespace-nowrap">
        {currentFrame} / {totalFrames}
      </span>
    </div>
  );
}
