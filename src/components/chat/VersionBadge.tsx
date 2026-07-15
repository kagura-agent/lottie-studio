"use client";

interface VersionBadgeProps {
  versionNum: number;
  animationId: string;
  onRestore?: (versionNum: number) => void;
}

export default function VersionBadge({ versionNum, onRestore }: VersionBadgeProps) {
  return (
    <button
      onClick={() => onRestore?.(versionNum)}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-600/50 text-zinc-400 hover:bg-indigo-600/40 hover:text-indigo-200 transition-colors cursor-pointer ml-1.5"
      title={`Restore version ${versionNum}`}
    >
      v{versionNum}
    </button>
  );
}
