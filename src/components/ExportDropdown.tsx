"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from 'next-intl';
import CodeSnippets from "./CodeSnippets";
import { SOCIAL_PRESETS, WEB_PRESETS, ExportPreset } from "@/lib/exportPresets";

interface ExportDropdownProps {
  animationData: object | null;
  isNewMode: boolean;
  currentId: string | null;
  gifExporting: boolean;
  gifProgress: number;
  apngExporting: boolean;
  apngProgress: number;
  videoExporting: boolean;
  videoProgress: number;
  presetExporting: boolean;
  presetProgress: number;
  presetExportingId: string | null;
  onExportJson: () => void;
  onExportGif: (e: React.MouseEvent) => void;
  onExportApng: (e: React.MouseEvent) => void;
  onExportDotLottie: () => void;
  onExportVideo: (e: React.MouseEvent) => void;
  onExportPreset: (preset: ExportPreset) => void;
  onDuplicate: () => void;
  isDuplicating: boolean;
}

export default function ExportDropdown({
  animationData,
  isNewMode,
  currentId,
  gifExporting,
  gifProgress,
  apngExporting,
  apngProgress,
  videoExporting,
  videoProgress,
  presetExporting,
  presetProgress,
  presetExportingId,
  onExportJson,
  onExportGif,
  onExportApng,
  onExportDotLottie,
  onExportVideo,
  onExportPreset,
  onDuplicate,
  isDuplicating,
}: ExportDropdownProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState<"share" | "embed" | null>(null);
  const [codeSnippetsOpen, setCodeSnippetsOpen] = useState(false);
  const [socialExpanded, setSocialExpanded] = useState(false);
  const [webExpanded, setWebExpanded] = useState(false);
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

  const renderPresetButton = (preset: ExportPreset) => {
    const isThisExporting = presetExporting && presetExportingId === preset.id;
    return (
      <button
        key={preset.id}
        onClick={() => { onExportPreset(preset); setOpen(false); }}
        disabled={noData || presetExporting}
        className="w-full px-6 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <span className="text-xs">{preset.icon}</span>
        {isThisExporting
          ? t('exportPresets.exporting', { progress: Math.round(presetProgress * 100) })
          : t(preset.nameKey)}
        <span className="ml-auto text-xs text-zinc-500">
          {preset.width}×{preset.height}
        </span>
      </button>
    );
  };

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
        <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[260px] py-1 max-h-[70vh] overflow-y-auto">
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

          {/* Download APNG */}
          <button
            onClick={(e) => { onExportApng(e); setOpen(false); }}
            disabled={noData || apngExporting}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {apngExporting ? t('exportDropdown.apngProgress', { progress: Math.round(apngProgress * 100) }) : t('exportDropdown.exportApng')}
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

          {/* Social Presets Section */}
          <button
            onClick={() => setSocialExpanded((v) => !v)}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2 font-medium"
          >
            <span>📱</span>
            {t('exportPresets.socialPresets')}
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`ml-auto transition-transform ${socialExpanded ? "rotate-180" : ""}`}
            >
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>
          {socialExpanded && (
            <div>
              {SOCIAL_PRESETS.map(renderPresetButton)}
            </div>
          )}

          {/* Web Presets Section */}
          <button
            onClick={() => setWebExpanded((v) => !v)}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2 font-medium"
          >
            <span>🖥️</span>
            {t('exportPresets.webPresets')}
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`ml-auto transition-transform ${webExpanded ? "rotate-180" : ""}`}
            >
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>
          {webExpanded && (
            <div>
              {WEB_PRESETS.map(renderPresetButton)}
            </div>
          )}

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

          {/* Code Snippets */}
          <button
            onClick={() => { setCodeSnippetsOpen(true); setOpen(false); }}
            disabled={isNewMode}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            {t('exportDropdown.codeSnippets')}
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
      {currentId && (
        <CodeSnippets
          animationId={currentId}
          animationData={animationData ?? undefined}
          open={codeSnippetsOpen}
          onClose={() => setCodeSnippetsOpen(false)}
        />
      )}
    </div>
  );
}
