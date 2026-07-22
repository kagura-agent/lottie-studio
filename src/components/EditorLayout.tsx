"use client";

import { useState, useCallback, useEffect, useRef, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { Command } from "@/lib/commands";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import LottiePreview from "./LottiePreview";
const JsonEditor = dynamic(() => import("./JsonEditor"), { ssr: false });
import ChatPanel from "./ChatPanel";
import LayerPanel from "./LayerPanel";
import Controls from "./Controls";
import BackgroundPicker from "./BackgroundPicker";
import ArtboardPicker from "./ArtboardPicker";
import ExportDropdown from "./ExportDropdown";
const ColorPalette = dynamic(() => import("./ColorPalette"), { ssr: false });
const TimingEditor = dynamic(() => import("./TimingEditor"), { ssr: false });
const EasingEditor = dynamic(() => import("./EasingEditor"), { ssr: false });
import BeforeAfterComparison from "./BeforeAfterComparison";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import LanguageSwitcher from "./LanguageSwitcher";
import UserMenu from "./auth/UserMenu";
import ErrorBoundary from "./ErrorBoundary";
const VersionHistory = dynamic(() => import("./VersionHistory"), { ssr: false });
const ShortcutsHelp = dynamic(() => import("./ShortcutsHelp"), { ssr: false });
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });
const FullscreenPreview = dynamic(() => import("./FullscreenPreview"), { ssr: false });
const EmbedDialog = dynamic(() => import("./EmbedDialog"), { ssr: false });
const ExportPresetDialog = dynamic(() => import("./ExportPresetDialog"), { ssr: false });
const KeyframeTimeline = dynamic(() => import("./KeyframeTimeline"), { ssr: false });
const QualityPanel = dynamic(() => import("./QualityPanel"), { ssr: false });
const ImportLottie = dynamic(() => import("./ImportLottie"), { ssr: false });
const ThemePanel = dynamic(() => import("./ThemePanel"), { ssr: false });
import { ThemeIndicator } from "./ThemePanel";
const OnboardingTour = dynamic(() => import("./OnboardingTour"), { ssr: false });
import OfflineIndicator from "./OfflineIndicator";
const SubmitTemplateModal = dynamic(() => import("./SubmitTemplateModal"), { ssr: false });
import MobileTabBar from "./MobileTabBar";
import BottomSheet from "./BottomSheet";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { optimizeLottie } from "@/lib/optimizer";
import { reverseAnimation } from "@/lib/reverse";
import { rescaleDuration } from "@/lib/rescaleDuration";

import { useExportState } from "@/hooks/editor/useExportState";
import { usePlaybackControls } from "@/hooks/editor/usePlaybackControls";
import { usePanelState } from "@/hooks/editor/usePanelState";
import { useVersionHistory } from "@/hooks/editor/useVersionHistory";
import { useAnimationState } from "@/hooks/editor/useAnimationState";

interface EditorPageProps {
  id: string | null;
  initialName: string;
  initialData: object | null;
  remixedFrom?: { id: string; name: string };
  initialPrompt?: string;
}

export default function EditorPage({ id, initialName, initialData, remixedFrom, initialPrompt }: EditorPageProps) {
  const t = useTranslations();
  const router = useRouter();
  const isMobile = useIsMobile();

  const menuRef = useRef<HTMLDivElement>(null);
  const panels = usePanelState(menuRef);
  const version = useVersionHistory();
  const anim = useAnimationState(id, initialName, initialData, panels.shareChat, panels.setShareChat, router);
  const playback = usePlaybackControls(anim.currentId);
  const exportState = useExportState(anim.animationData, anim.name);

  // Persist loop config to localStorage
  useEffect(() => {
    if (anim.currentId) {
      localStorage.setItem(`lottie-loop-${anim.currentId}`, JSON.stringify(playback.loopConfig));
    }
  }, [anim.currentId, playback.loopConfig]);

  // Wrap handleSelectLayer to also switch panels
  const handleSelectLayer = useCallback((layerName: string, layerIndex: number) => {
    anim.handleSelectLayer(layerName, layerIndex);
    panels.setRightPanel("chat");
    panels.setMobileView("chat");
  }, [anim, panels]);

  const speeds = [0.5, 1, 2];
  useKeyboardShortcuts({
    onUndo: anim.handleUndo,
    onRedo: anim.handleRedo,
    onTogglePlay: () => playback.setIsPlaying((p) => !p),
    onSave: anim.handleSave,
    onSeekBackward: () => {
      playback.setSeekFrame(Math.max(0, playback.currentFrame - 1));
      playback.setIsPlaying(false);
    },
    onSeekForward: () => {
      playback.setSeekFrame(Math.min(playback.totalFrames - 1, playback.currentFrame + 1));
      playback.setIsPlaying(false);
    },
    onSeekStart: () => {
      playback.setSeekFrame(0);
      playback.setIsPlaying(false);
    },
    onSeekEnd: () => {
      playback.setSeekFrame(Math.max(0, playback.totalFrames - 1));
      playback.setIsPlaying(false);
    },
    onSpeedDown: () => {
      const idx = speeds.indexOf(playback.speed);
      if (idx > 0) playback.setSpeed(speeds[idx - 1]);
    },
    onSpeedUp: () => {
      const idx = speeds.indexOf(playback.speed);
      if (idx < speeds.length - 1) playback.setSpeed(speeds[idx + 1]);
    },
    onShowHelp: () => panels.setShortcutsHelpOpen((v) => !v),
    onToggleFullscreen: () => panels.setFullscreenOpen((v) => !v),
    onToggleVersionHistory: () => {
      if (!anim.isNewMode) {
        panels.setVersionPanelOpen((v) => {
          if (v) version.handleExitVersionPreview();
          return !v;
        });
      }
    },
  });

  const handleCommand = useCallback((command: Command) => {
    switch (command.type) {
      case "play":
        playback.setIsPlaying(true);
        break;
      case "pause":
        playback.setIsPlaying(false);
        break;
      case "speed":
        playback.setSpeed(command.speed);
        break;
      case "loop":
        playback.setLoopConfig({ mode: "loop" });
        break;
      case "once":
        playback.setLoopConfig({ mode: "once" });
        break;
      case "export_gif":
        exportState.handleExportGif({ preventDefault: () => {} } as MouseEvent);
        break;
      case "export_apng":
        exportState.handleExportApng({ preventDefault: () => {} } as MouseEvent);
        break;
      case "export_video":
        exportState.handleExportVideo({ preventDefault: () => {} } as MouseEvent);
        break;
      case "export_json":
        exportState.handleExport();
        break;
      case "export_dotlottie":
        exportState.handleExportDotLottie();
        break;
      case "undo":
        anim.handleUndo();
        break;
      case "redo":
        anim.handleRedo();
        break;
      case "resize":
        anim.handleArtboardChange(command.width, command.height);
        break;
      case "background":
        anim.handleBgChange(command.color as import("./BackgroundPicker").CanvasBackground);
        break;
      case "fullscreen":
        panels.setFullscreenOpen(true);
        break;
      case "optimize":
        if (anim.animationData) {
          const { optimized, stats } = optimizeLottie(anim.animationData);
          anim.setAnimationData(optimized as object);
          anim.setJsonText(JSON.stringify(optimized, null, 2));
          anim.pushState(optimized as object);
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
          anim.setInsertText(summary);
        }
        break;
      case "reverse":
        if (anim.animationData) {
          const reversed = reverseAnimation(anim.animationData);
          anim.setAnimationData(reversed as object);
          anim.setJsonText(JSON.stringify(reversed, null, 2));
          anim.pushState(reversed as object);
          anim.setInsertText("🔄 Reversed the animation playback direction.");
        }
        break;
      case "duration":
        if (anim.animationData) {
          const rescaled = rescaleDuration(anim.animationData, command.durationMs);
          anim.setAnimationData(rescaled as object);
          anim.setJsonText(JSON.stringify(rescaled, null, 2));
          anim.pushState(rescaled as object);
          const secs = (command.durationMs / 1000).toFixed(1);
          anim.setInsertText(`⏱️ Duration set to ${secs}s`);
        }
        break;
      case "goto": {
        const fr = (anim.animationData as Record<string, unknown>)?.fr as number ?? 30;
        const ip = (anim.animationData as Record<string, unknown>)?.ip as number ?? 0;
        const op = (anim.animationData as Record<string, unknown>)?.op as number ?? playback.totalFrames;
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
        playback.setSeekFrame(targetFrame);
        playback.setIsPlaying(false);
        const timeAtFrame = (targetFrame / fr).toFixed(2);
        anim.setInsertText(`⏭️ Seeked to frame ${targetFrame} (${timeAtFrame}s)`);
        break;
      }
      case "marker_add":
        if (anim.animationData) {
          const cloned = JSON.parse(JSON.stringify(anim.animationData)) as Record<string, unknown>;
          if (!Array.isArray(cloned.markers)) cloned.markers = [];
          const markers = cloned.markers as Array<{ cm: string; tm: number; dr: number }>;
          const existingIdx = markers.findIndex((m) => m.cm === command.name);
          const newMarker = { cm: command.name, tm: command.startFrame, dr: command.endFrame - command.startFrame };
          if (existingIdx >= 0) {
            markers[existingIdx] = newMarker;
          } else {
            markers.push(newMarker);
          }
          anim.setAnimationData(cloned as object);
          anim.setJsonText(JSON.stringify(cloned, null, 2));
          anim.pushState(cloned as object);
        }
        break;
      case "marker_remove":
        if (anim.animationData) {
          const cloned = JSON.parse(JSON.stringify(anim.animationData)) as Record<string, unknown>;
          if (Array.isArray(cloned.markers)) {
            cloned.markers = (cloned.markers as Array<{ cm: string; tm: number; dr: number }>).filter((m) => m.cm !== command.name);
            if ((cloned.markers as unknown[]).length === 0) delete cloned.markers;
            anim.setAnimationData(cloned as object);
            anim.setJsonText(JSON.stringify(cloned, null, 2));
            anim.pushState(cloned as object);
          }
        }
        break;
      case "marker_list":
        break;
      case "marker_clear":
        if (anim.animationData) {
          const cloned = JSON.parse(JSON.stringify(anim.animationData)) as Record<string, unknown>;
          delete cloned.markers;
          anim.setAnimationData(cloned as object);
          anim.setJsonText(JSON.stringify(cloned, null, 2));
          anim.pushState(cloned as object);
        }
        break;
      case "compose":
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, playback, exportState, panels]);

  return (
    <div className="flex flex-col h-[100dvh]">
      <h1 className="sr-only">Lottie Studio Editor</h1>

      {/* Accessibility: save status announcer */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {anim.saveStatus === "saved" && "Animation saved"}
        {anim.saveStatus === "error" && "Save failed"}
        {anim.saving && "Saving animation..."}
      </div>

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
          value={anim.name}
          onChange={(e) => anim.setName(e.target.value)}
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
          animationData={anim.animationData}
          isNewMode={anim.isNewMode}
          currentId={anim.currentId}
          gifExporting={exportState.gifExporting}
          gifProgress={exportState.gifProgress}
          apngExporting={exportState.apngExporting}
          apngProgress={exportState.apngProgress}
          videoExporting={exportState.videoExporting}
          videoProgress={exportState.videoProgress}
          mp4Exporting={exportState.mp4Exporting}
          mp4Progress={exportState.mp4Progress}
          presetExporting={exportState.presetExporting}
          presetProgress={exportState.presetProgress}
          presetExportingId={exportState.presetExportingId}
          onExportJson={exportState.handleExport}
          onExportGif={exportState.handleExportGif}
          onExportApng={exportState.handleExportApng}
          onExportDotLottie={exportState.handleExportDotLottie}
          onExportVideo={exportState.handleExportVideo}
          onExportMp4={exportState.handleExportMp4}
          onExportPreset={exportState.handleExportPreset}
          onOpenPresetDialog={() => panels.setPresetDialogOpen(true)}
          onDuplicate={anim.handleDuplicate}
          isDuplicating={anim.duplicating}
        />
        </div>
        {!anim.isNewMode && anim.animationData && (
          <QualityPanel
            animationData={anim.animationData}
            onSuggestionClick={(suggestion) => {
              anim.setInsertText(suggestion);
              panels.setRightPanel("chat");
              panels.setMobileView("chat");
              setTimeout(() => anim.setInsertText(""), 0);
            }}
          />
        )}
        <ThemeIndicator onClick={() => panels.setThemePanelOpen((v) => !v)} />
        <button
          onClick={() => panels.setSubmitTemplateOpen(true)}
          disabled={anim.isNewMode}
          aria-label="Submit as template"
          className="hidden md:inline-flex px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit as Template
        </button>
        <button
          onClick={() => panels.setEmbedOpen(true)}
          disabled={anim.isNewMode}
          aria-label="Open embed dialog"
          className="hidden md:inline-flex px-4 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm font-medium hover:border-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('editor.embed')}
        </button>
        <button
          onClick={anim.handleToggleShareChat}
          disabled={anim.isNewMode || anim.shareChatSaving}
          title="Include chat history in share page"
          aria-label={panels.shareChat ? "Chat history is shared" : "Share chat history"}
          aria-pressed={panels.shareChat}
          className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            panels.shareChat
              ? "border-emerald-600 text-emerald-400 hover:border-emerald-500"
              : "border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {panels.shareChat ? "Chat shared" : "Share chat"}
        </button>
        <button
          onClick={anim.handleSave}
          disabled={anim.saving || anim.animationData === null || anim.isNewMode}
          aria-label="Save animation"
          className="px-3 md:px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {anim.saving ? "..." : t('common.save')}
        </button>
        {anim.saveStatus === "saved" && (
          <span className="text-emerald-400 text-sm shrink-0">✓</span>
        )}
        {anim.saveStatus === "error" && (
          <span className="text-red-400 text-sm shrink-0">{t('editor.saveError')}</span>
        )}
        {/* Mobile overflow menu */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            onClick={() => panels.setMobileMenuOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={panels.mobileMenuOpen}
            aria-haspopup="true"
            className="px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
          >
            ⋯
          </button>
          {panels.mobileMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
              <button
                onClick={() => { exportState.handleExport(); panels.setMobileMenuOpen(false); }}
                disabled={anim.animationData === null || anim.isNewMode}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export JSON
              </button>
              <button
                onClick={(e) => { exportState.handleExportGif(e as unknown as MouseEvent); panels.setMobileMenuOpen(false); }}
                disabled={anim.animationData === null || exportState.gifExporting}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportState.gifExporting ? `Export GIF (${Math.round(exportState.gifProgress * 100)}%)` : "Export GIF"}
              </button>
              <button
                onClick={(e) => { exportState.handleExportApng(e as unknown as MouseEvent); panels.setMobileMenuOpen(false); }}
                disabled={anim.animationData === null || exportState.apngExporting}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportState.apngExporting ? `Export APNG (${Math.round(exportState.apngProgress * 100)}%)` : "Export APNG"}
              </button>
              <button
                onClick={() => { exportState.handleExportDotLottie(); panels.setMobileMenuOpen(false); }}
                disabled={anim.animationData === null}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export .lottie
              </button>
              <button
                onClick={(e) => { exportState.handleExportVideo(e as unknown as MouseEvent); panels.setMobileMenuOpen(false); }}
                disabled={anim.animationData === null || exportState.videoExporting}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportState.videoExporting ? `Export Video (${Math.round(exportState.videoProgress * 100)}%)` : "Export Video"}
              </button>
              <button
                onClick={() => { panels.setEmbedOpen(true); panels.setMobileMenuOpen(false); }}
                disabled={anim.isNewMode}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('editor.embed')}
              </button>
              <button
                onClick={() => { anim.handleToggleShareChat(); panels.setMobileMenuOpen(false); }}
                disabled={anim.isNewMode || anim.shareChatSaving}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {panels.shareChat ? "✓ Chat history shared" : "Share chat history"}
              </button>
              <button
                onClick={() => {
                  if (!anim.currentId) return;
                  navigator.clipboard.writeText(`${window.location.origin}/share/${anim.currentId}`);
                  anim.setShareStatus("copied");
                  setTimeout(() => anim.setShareStatus("idle"), 2000);
                  panels.setMobileMenuOpen(false);
                }}
                disabled={anim.isNewMode}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {anim.shareStatus === "copied" ? "✓ Link Copied" : "Copy Share Link"}
              </button>
              <div className="border-t border-zinc-700 my-1" />
              <button
                onClick={() => { anim.handleDuplicate(); panels.setMobileMenuOpen(false); }}
                disabled={anim.isNewMode || anim.duplicating}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {anim.duplicating ? "Duplicating..." : t('common.duplicate')}
              </button>
            </div>
          )}
        </div>
        <LanguageSwitcher />
        <UserMenu />
      </header>

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Main content */}
      <ErrorBoundary fallbackMessage={t('common.error')}>
      <div id="main-content" className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Preview panel - stacked on mobile (40vh top), side-by-side on desktop */}
        <div role="region" aria-label="Animation preview" className="flex flex-col h-[40vh] shrink-0 md:h-auto md:shrink md:w-1/2 md:min-h-0 md:border-r border-zinc-800">
          <div className="flex-1 p-2 md:p-4 min-h-0 relative" data-tour="canvas">
            <ErrorBoundary
              key={anim.currentId ?? "new"}
              fallbackMessage={t('common.error')}
              onReset={() => anim.setAnimationData(anim.animationData)}
            >
              <LottiePreview
                animationData={version.versionPreviewData ?? anim.progressivePreviewData ?? anim.animationData}
                isPlaying={playback.isPlaying}
                speed={playback.speed}
                loopConfig={playback.loopConfig}
                onFrameChange={playback.handleFrameChange}
                seekToFrame={playback.seekFrame}
                background={anim.canvasBg}
                placeholder={anim.isNewMode && anim.animationData === null && !anim.progressivePreviewData}
                ariaLabel={anim.name || "Animation preview"}
              />
              {anim.isPreviewActive && (
                <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Generating…
                </div>
              )}
            </ErrorBoundary>
            {anim.beforeAfter.isComparing && anim.beforeAfter.beforeData && anim.beforeAfter.afterData && (
              <BeforeAfterComparison
                beforeData={anim.beforeAfter.beforeData}
                afterData={anim.beforeAfter.afterData}
                comparisonMode={anim.beforeAfter.comparisonMode}
                onModeChange={anim.beforeAfter.setComparisonMode}
                onAccept={() => anim.beforeAfter.accept()}
                onRevert={() => {
                  const data = anim.beforeAfter.revert();
                  if (data) {
                    anim.setAnimationData(data);
                    anim.setJsonText(JSON.stringify(data, null, 2));
                    anim.pushState(data);
                  }
                }}
                isPlaying={playback.isPlaying}
                speed={playback.speed}
                loopConfig={playback.loopConfig}
                seekToFrame={playback.seekFrame}
                background={anim.canvasBg}
              />
            )}
            {anim.beforeAfter.beforeData && !anim.beforeAfter.isComparing && (
              <button
                onClick={() => anim.beforeAfter.setBeforeState(anim.beforeAfter.beforeData!)}
                title="Compare before/after"
                aria-label="Toggle before/after comparison"
                className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-md bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              </button>
            )}
            {version.previewingVersion !== null && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/90 text-white text-sm font-medium shadow-lg backdrop-blur-sm">
                <span>{t('versionHistory.previewingVersion', { version: version.previewingVersion })}</span>
                <button
                  onClick={version.handleExitVersionPreview}
                  className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-xs transition-colors"
                >
                  {t('versionHistory.exitPreview')}
                </button>
              </div>
            )}
            {anim.isNewMode && anim.animationData === null && (
              <div className="mt-4">
                <ImportLottie onImported={anim.handleAnimationCreated} />
              </div>
            )}
          </div>
          <KeyframeTimeline
            animationData={anim.animationData}
            currentFrame={playback.currentFrame}
            totalFrames={playback.totalFrames}
            onSeek={playback.handleSeek}
            markers={anim.animationData ? ((anim.animationData as Record<string, unknown>).markers as Array<{ cm: string; tm: number; dr: number }>) ?? undefined : undefined}
            onPlaySegment={(start) => {
              playback.setSeekFrame(start);
              playback.setIsPlaying(true);
            }}
          />
          <div className="flex items-center border-t border-zinc-800" data-tour="controls">
            <Controls
              isPlaying={playback.isPlaying}
              onTogglePlay={() => playback.setIsPlaying((p) => !p)}
              speed={playback.speed}
              onSpeedChange={playback.setSpeed}
              loopConfig={playback.loopConfig}
              onLoopConfigChange={playback.setLoopConfig}
              currentFrame={playback.currentFrame}
              totalFrames={playback.totalFrames}
              onSeek={playback.handleSeek}
              frameRate={(anim.animationData as Record<string, unknown>)?.fr as number ?? 30}
              onDurationChange={(newDurationSeconds) => {
                if (anim.animationData) {
                  const rescaled = rescaleDuration(anim.animationData, newDurationSeconds * 1000);
                  anim.setAnimationData(rescaled as object);
                  anim.setJsonText(JSON.stringify(rescaled, null, 2));
                  anim.pushState(rescaled as object);
                }
              }}
            />
            <div className="hidden md:block px-2 py-2 bg-zinc-900">
              <ArtboardPicker width={anim.currentWidth} height={anim.currentHeight} onChange={anim.handleArtboardChange} />
            </div>
            <div className="hidden md:block px-2 py-2 bg-zinc-900">
              <BackgroundPicker value={anim.canvasBg} onChange={anim.handleBgChange} />
            </div>
            <div className="hidden md:block px-2 py-2 bg-zinc-900">
              <ColorPalette
                animationData={anim.animationData}
                onChange={(updated) => {
                  anim.setAnimationData(updated as object);
                  anim.setJsonText(JSON.stringify(updated, null, 2));
                  anim.pushState(updated as object);
                }}
              />
            </div>
            <div className="hidden md:block px-2 py-2 bg-zinc-900">
              <TimingEditor
                animationData={anim.animationData}
                onChange={(updated) => {
                  anim.setAnimationData(updated as object);
                  anim.setJsonText(JSON.stringify(updated, null, 2));
                  anim.pushState(updated as object);
                }}
              />
            </div>
            <div className="hidden md:block px-2 py-2 bg-zinc-900">
              <EasingEditor
                animationData={anim.animationData}
                onChange={(updated) => {
                  anim.setAnimationData(updated as object);
                  anim.setJsonText(JSON.stringify(updated, null, 2));
                  anim.pushState(updated as object);
                }}
              />
            </div>
            <div className="hidden md:block px-2 py-2 bg-zinc-900">
              <button
                onClick={() => panels.setFullscreenOpen(true)}
                disabled={!anim.animationData}
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
          <div className="hidden md:flex justify-center gap-2 px-4 pb-3">
            <button
              onClick={anim.handleUndo}
              disabled={!anim.canUndo}
              title="Undo (Ctrl+Z)"
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Undo
            </button>
            <button
              onClick={anim.handleRedo}
              disabled={!anim.canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Redo
            </button>
            <button
              onClick={playback.handleRestart}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Restart
            </button>
          </div>
        </div>

        {/* Editor panel - below canvas on mobile, side-by-side on desktop */}
        <main
          id="panel-chat"
          className="flex flex-col flex-1 md:min-h-0 min-h-0"
        >
          {/* Desktop-only right panel tabs */}
          <div role="tablist" aria-label="Editor panels" className="hidden md:flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 bg-zinc-900 shrink-0">
            <button
              role="tab"
              aria-selected={panels.rightPanel === "chat"}
              onClick={() => panels.setRightPanel("chat")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                panels.rightPanel === "chat"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t('editor.chat')}
            </button>
            <button
              role="tab"
              aria-selected={panels.rightPanel === "json"}
              onClick={() => panels.setRightPanel("json")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                panels.rightPanel === "json"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t('editor.json')}
            </button>
            <button
              role="tab"
              aria-selected={panels.rightPanel === "layers"}
              onClick={() => panels.setRightPanel("layers")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                panels.rightPanel === "layers"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t('editor.layers')}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => panels.setShortcutsHelpOpen(true)}
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
              onClick={() => panels.setVersionPanelOpen((v) => !v)}
              disabled={anim.isNewMode}
              title={t('editor.versions')}
              aria-label="Toggle version history"
              aria-expanded={panels.versionPanelOpen}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                panels.versionPanelOpen
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
            {/* On mobile: show chat or layers based on mobileView. On desktop: use rightPanel */}
            {isMobile ? (
              panels.mobileView === "chat" ? (
                <ErrorBoundary fallbackMessage={t('common.error')}>
                  <ChatPanel animationId={anim.currentId ?? undefined} insertText={anim.insertText} onAnimationCreated={anim.handleAnimationCreated} onAnimationUpdated={anim.handleAnimationUpdated} onCommand={handleCommand} initialPrompt={initialPrompt} selectedLayerIndex={anim.selectedLayerIndex} animationData={anim.animationData} onLayerContextConsumed={() => anim.setSelectedLayerIndex(null)} onProgressivePreview={anim.handleProgressivePreview} />
                </ErrorBoundary>
              ) : panels.mobileView === "layers" ? (
                <LayerPanel
                  animationData={anim.animationData}
                  onSelectLayer={handleSelectLayer}
                  onToggleVisibility={anim.handleToggleVisibility}
                  onChangeOpacity={anim.handleChangeOpacity}
                  onPreviewOpacity={anim.handlePreviewOpacity}
                  onReorderLayers={anim.handleReorderLayers}
                />
              ) : null
            ) : (
              panels.rightPanel === "chat" ? (
                <ErrorBoundary fallbackMessage={t('common.error')}>
                  <ChatPanel animationId={anim.currentId ?? undefined} insertText={anim.insertText} onAnimationCreated={anim.handleAnimationCreated} onAnimationUpdated={anim.handleAnimationUpdated} onCommand={handleCommand} initialPrompt={initialPrompt} selectedLayerIndex={anim.selectedLayerIndex} animationData={anim.animationData} onLayerContextConsumed={() => anim.setSelectedLayerIndex(null)} onProgressivePreview={anim.handleProgressivePreview} />
                </ErrorBoundary>
              ) : panels.rightPanel === "layers" ? (
                <LayerPanel
                  animationData={anim.animationData}
                  onSelectLayer={handleSelectLayer}
                  onToggleVisibility={anim.handleToggleVisibility}
                  onChangeOpacity={anim.handleChangeOpacity}
                  onPreviewOpacity={anim.handlePreviewOpacity}
                  onReorderLayers={anim.handleReorderLayers}
                />
              ) : (
                <JsonEditor value={anim.jsonText} onChange={anim.handleJsonChange} />
              )
            )}
          </div>
        </main>
      </div>
      </ErrorBoundary>

      {/* Mobile bottom tab bar */}
      <MobileTabBar
        activeTab={panels.mobileView}
        onTabChange={(tab) => {
          if (tab === "settings") {
            panels.setSettingsSheetOpen(true);
            return;
          }
          panels.setMobileView(tab);
          if (tab === "chat") panels.setRightPanel("chat");
          else if (tab === "layers") panels.setRightPanel("layers");
        }}
      />

      {/* Mobile bottom sheet for JSON editor */}
      <BottomSheet
        open={panels.jsonSheetOpen}
        onClose={() => panels.setJsonSheetOpen(false)}
        title="JSON Editor"
      >
        <div className="h-[60dvh]">
          <JsonEditor value={anim.jsonText} onChange={anim.handleJsonChange} />
        </div>
      </BottomSheet>

      {/* Mobile bottom sheet for settings */}
      <BottomSheet
        open={panels.settingsSheetOpen}
        onClose={() => panels.setSettingsSheetOpen(false)}
        title="Settings"
      >
        <div className="px-4 py-3 space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Canvas</h3>
            <div className="flex items-center gap-3">
              <ArtboardPicker width={anim.currentWidth} height={anim.currentHeight} onChange={anim.handleArtboardChange} />
              <BackgroundPicker value={anim.canvasBg} onChange={anim.handleBgChange} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tools</h3>
            <div className="flex items-center gap-3">
              <ColorPalette
                animationData={anim.animationData}
                onChange={(updated) => {
                  anim.setAnimationData(updated as object);
                  anim.setJsonText(JSON.stringify(updated, null, 2));
                  anim.pushState(updated as object);
                }}
              />
              <TimingEditor
                animationData={anim.animationData}
                onChange={(updated) => {
                  anim.setAnimationData(updated as object);
                  anim.setJsonText(JSON.stringify(updated, null, 2));
                  anim.pushState(updated as object);
                }}
              />
              <EasingEditor
                animationData={anim.animationData}
                onChange={(updated) => {
                  anim.setAnimationData(updated as object);
                  anim.setJsonText(JSON.stringify(updated, null, 2));
                  anim.pushState(updated as object);
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">View</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { panels.setJsonSheetOpen(true); panels.setSettingsSheetOpen(false); }}
                className="px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
              >
                JSON Editor
              </button>
              <button
                onClick={() => { panels.setVersionPanelOpen(true); panels.setSettingsSheetOpen(false); }}
                disabled={anim.isNewMode}
                className="px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors disabled:opacity-50"
              >
                Version History
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>
      {anim.currentId && (
        <VersionHistory
          animationId={anim.currentId}
          open={panels.versionPanelOpen}
          onClose={() => {
            panels.setVersionPanelOpen(false);
            version.handleExitVersionPreview();
          }}
          onPreview={version.handleVersionPreview}
          onExitPreview={version.handleExitVersionPreview}
          previewingVersion={version.previewingVersion}
        />
      )}
      <ShortcutsHelp
        open={panels.shortcutsHelpOpen}
        onClose={() => panels.setShortcutsHelpOpen(false)}
      />
      <CommandPalette
        open={panels.commandPaletteOpen}
        onClose={() => panels.setCommandPaletteOpen(false)}
        onCommand={handleCommand}
        onInsertText={(text) => {
          anim.setInsertText(text);
          panels.setRightPanel("chat");
          panels.setMobileView("chat");
          setTimeout(() => anim.setInsertText(""), 0);
        }}
        onNavigate={(path) => router.push(path)}
        onSave={anim.handleSave}
        onToggleFullscreen={() => panels.setFullscreenOpen((v) => !v)}
        onToggleJson={() => panels.setRightPanel("json")}
        onToggleLayers={() => panels.setRightPanel("layers")}
        onShowShortcuts={() => panels.setShortcutsHelpOpen(true)}
        onToggleVersionHistory={() => {
          if (!anim.isNewMode) panels.setVersionPanelOpen((v) => !v);
        }}
        onExportJson={exportState.handleExport}
        onExportGif={() => exportState.handleExportGif({ preventDefault: () => {} } as MouseEvent)}
        onExportApng={() => exportState.handleExportApng({ preventDefault: () => {} } as MouseEvent)}
        onExportVideo={() => exportState.handleExportVideo({ preventDefault: () => {} } as MouseEvent)}
        onExportDotLottie={exportState.handleExportDotLottie}
      />
      {panels.fullscreenOpen && (
        <FullscreenPreview
          animationData={anim.animationData}
          isPlaying={playback.isPlaying}
          speed={playback.speed}
          currentFrame={playback.currentFrame}
          totalFrames={playback.totalFrames}
          onTogglePlay={() => playback.setIsPlaying((p) => !p)}
          onSpeedChange={playback.setSpeed}
          onSeek={playback.handleSeek}
          onClose={() => panels.setFullscreenOpen(false)}
        />
      )}
      {anim.currentId && (
        <EmbedDialog
          animationId={anim.currentId}
          open={panels.embedOpen}
          onClose={() => panels.setEmbedOpen(false)}
        />
      )}
      <ThemePanel open={panels.themePanelOpen} onClose={() => panels.setThemePanelOpen(false)} />
      {anim.currentId && (
        <SubmitTemplateModal
          open={panels.submitTemplateOpen}
          onClose={() => panels.setSubmitTemplateOpen(false)}
          animationId={anim.currentId}
        />
      )}
      <ExportPresetDialog
        open={panels.presetDialogOpen}
        onClose={() => panels.setPresetDialogOpen(false)}
        onExport={(preset) => { panels.setPresetDialogOpen(false); exportState.handleExportPreset(preset); }}
        animationData={anim.animationData}
        exporting={exportState.presetExporting}
        exportProgress={exportState.presetProgress}
      />
      <OnboardingTour />
    </div>
  );
}
