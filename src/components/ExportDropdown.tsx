"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from 'next-intl';

interface ExportDropdownProps {
  animationData: object | null;
  isNewMode: boolean;
  currentId: string | null;
  gifExporting: boolean;
  gifProgress: number;
  videoExporting: boolean;
  videoProgress: number;
  onExportJson: () => void;
  onExportGif: (e: React.MouseEvent) => void;
  onExportDotLottie: () => void;
  onExportVideo: (e: React.MouseEvent) => void;
  onDuplicate: () => void;
  isDuplicating: boolean;
}

export default function ExportDropdown({
  animationData,
  isNewMode,
  currentId,
  gifExporting,
  gifProgress,
  videoExporting,
  videoProgress,
  onExportJson,
  onExportGif,
  onExportDotLottie,
  onExportVideo,
  onDuplicate,
  isDuplicating,
}: ExportDropdownProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState<"share" | "embed" | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopyShareLink = () => {
    if (!currentId) return;
    navigator.clipboard.writeText(`${window.location.origin}/share/${currentId}`);
    setCopiedItem("share");
    setTimeout(() => setCopiedItem(null), 2000);
    setOpen(false);
  };

  const handleCopyEmbedCode = () => {
    if (!currentId) return;
    const code = `<script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script><lottie-player src="${window.location.origin}/api/animations/${currentId}/json" background="transparent" speed="1" style="width:400px;height:400px" loop autoplay></lottie-player>`;
    navigator.clipboard.writeText(code);
    setCopiedItem("embed");
    setTimeout(() => setCopiedItem(null), 2000);
    setOpen(false);
  };

  const noData = animationData === null;

  return (
    <div className="relative hidden md:inline-flex" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors"
      >
        {t('common.export')}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[200px] py-1">
          {/* Download JSON */}
          <button
            onClick={() => { onExportJson(); setOpen(false); }}
            disabled={noData || isNewMode}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('exportDropdown.exportJson')}
          </button>

          {/* Download GIF */}
          <button
            onClick={(e) => { onExportGif(e); setOpen(false); }}
            disabled={noData || gifExporting}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {gifExporting ? t('exportDropdown.gifProgress', { progress: Math.round(gifProgress * 100) }) : t('exportDropdown.exportGif')}
          </button>

          {/* Download .lottie */}
          <button
            onClick={() => { onExportDotLottie(); setOpen(false); }}
            disabled={noData}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('exportDropdown.exportDotLottie')}
          </button>

          {/* Download Video */}
          <button
            onClick={(e) => { onExportVideo(e); setOpen(false); }}
            disabled={noData || videoExporting}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {videoExporting ? t('exportDropdown.videoProgress', { progress: Math.round(videoProgress * 100) }) : t('exportDropdown.exportVideo')}
          </button>

          {/* Separator */}
          <div className="border-t border-zinc-700 my-1" />

          {/* Copy Share Link */}
          <button
            onClick={handleCopyShareLink}
            disabled={isNewMode}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            {copiedItem === "share" ? t('common.copied') : "Copy Share Link"}
          </button>

          {/* Copy Embed Code */}
          <button
            onClick={handleCopyEmbedCode}
            disabled={isNewMode}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            {copiedItem === "embed" ? t('common.copied') : "Copy Embed Code"}
          </button>

          {/* Separator */}
          <div className="border-t border-zinc-700 my-1" />

          {/* Duplicate */}
          <button
            onClick={() => { onDuplicate(); setOpen(false); }}
            disabled={isNewMode || isDuplicating}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 17.1c0 1.326-1.074 2.4-2.4 2.4H5.4A2.4 2.4 0 013 17.1V8.7a2.4 2.4 0 012.4-2.4h1.2m4.8-2.4h5.4A2.4 2.4 0 0119.2 6.3v8.4a2.4 2.4 0 01-2.4 2.4h-8.4a2.4 2.4 0 01-2.4-2.4V6.3a2.4 2.4 0 012.4-2.4z" />
            </svg>
            {isDuplicating ? t('exportDropdown.duplicating') : t('exportDropdown.duplicate')}
          </button>
        </div>
      )}
    </div>
  );
}
