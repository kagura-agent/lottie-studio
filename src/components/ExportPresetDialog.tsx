"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  SOCIAL_PRESETS,
  MESSAGING_PRESETS,
  WEB_PRESETS,
  type ExportPreset,
  type CustomPreset,
  type ConstraintWarning,
  checkPresetConstraints,
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from "@/lib/exportPresets";

interface ExportPresetDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (preset: ExportPreset) => void;
  animationData: object | null;
  exporting: boolean;
  exportProgress: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getAnimationDurationMs(data: object | null): number {
  if (!data) return 0;
  const d = data as Record<string, unknown>;
  const fr = (d.fr as number) || 30;
  const ip = (d.ip as number) || 0;
  const op = (d.op as number) || 60;
  return ((op - ip) / fr) * 1000;
}

export default function ExportPresetDialog({
  open,
  onClose,
  onExport,
  animationData,
  exporting,
  exportProgress,
}: ExportPresetDialogProps) {
  const t = useTranslations();
  const focusTrapRef = useFocusTrap(open);
  const [selected, setSelected] = useState<ExportPreset | null>(null);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (open && !prevOpen) {
    setSelected(null);
    setShowSaveForm(false);
    setCustomName("");
    setCustomPresets(loadCustomPresets());
  }
  if (open !== prevOpen) setPrevOpen(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSaveCustom = useCallback(() => {
    if (!selected || !customName.trim()) return;
    const preset: CustomPreset = {
      ...selected,
      id: `custom-${Date.now()}`,
      nameKey: customName.trim(),
      custom: true,
      createdAt: Date.now(),
    };
    saveCustomPreset(preset);
    setCustomPresets(loadCustomPresets());
    setShowSaveForm(false);
    setCustomName("");
  }, [selected, customName]);

  const handleDeleteCustom = useCallback((id: string) => {
    deleteCustomPreset(id);
    setCustomPresets(loadCustomPresets());
    if (selected?.id === id) setSelected(null);
  }, [selected]);

  if (!open) return null;

  const durationMs = getAnimationDurationMs(animationData);
  const warnings: ConstraintWarning[] = selected
    ? checkPresetConstraints(selected, durationMs)
    : [];

  const renderPresetCard = (preset: ExportPreset, isCustom = false) => {
    const isSelected = selected?.id === preset.id;
    const displayName = isCustom ? preset.nameKey : t(preset.nameKey);
    return (
      <button
        key={preset.id}
        onClick={() => setSelected(preset)}
        className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
          isSelected
            ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40"
            : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800"
        }`}
      >
        <span className="text-2xl">{preset.icon}</span>
        <span className="text-xs font-medium text-zinc-200 leading-tight">{displayName}</span>
        <span className="text-[10px] text-zinc-500">{preset.width}x{preset.height}</span>
        {isCustom && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteCustom(preset.id); }}
            className="mt-0.5 text-[10px] text-red-400 hover:text-red-300"
          >
            {t("exportPresets.deleteCustom")}
          </button>
        )}
      </button>
    );
  };

  const renderSection = (title: string, presets: ExportPreset[], isCustom = false) => {
    if (presets.length === 0) return null;
    return (
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{title}</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {presets.map((p) => renderPresetCard(p, isCustom))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        ref={focusTrapRef}
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t("exportPresets.dialogTitle")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-100">{t("exportPresets.dialogTitle")}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label={t("common.close")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {renderSection(t("exportPresets.socialPresets"), SOCIAL_PRESETS)}
          {renderSection(t("exportPresets.messagingPresets"), MESSAGING_PRESETS)}
          {renderSection(t("exportPresets.webPresets"), WEB_PRESETS)}
          {renderSection(t("exportPresets.customPresets"), customPresets, true)}
        </div>

        {/* Footer — shows details when a preset is selected */}
        {selected && (
          <div className="border-t border-zinc-700 px-5 py-4 space-y-3">
            {/* Preset details row */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-2xl">{selected.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-100">
                  {(selected as CustomPreset).custom
                    ? selected.nameKey
                    : t(selected.nameKey)}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mt-0.5">
                  <span>{t("exportPresets.dimensions", { width: selected.width, height: selected.height })}</span>
                  <span>{selected.format.toUpperCase()}</span>
                  <span>{t("exportPresets.fps", { fps: selected.fps })}</span>
                  {selected.maxDuration && (
                    <span>{t("exportPresets.maxDuration", { seconds: (selected.maxDuration / 1000).toFixed(0) })}</span>
                  )}
                  {selected.maxFileSize && (
                    <span>{t("exportPresets.maxFileSize", { size: formatFileSize(selected.maxFileSize) })}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-1">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onExport(selected)}
                disabled={exporting || !animationData}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {exporting
                  ? t("exportPresets.exporting", { progress: Math.round(exportProgress * 100) })
                  : t("exportPresets.exportButton")}
              </button>

              {!showSaveForm ? (
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors"
                >
                  {t("exportPresets.saveCustom")}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={t("exportPresets.customNamePlaceholder")}
                    className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-600 rounded text-zinc-200 placeholder-zinc-500 w-36"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveCustom(); }}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveCustom}
                    disabled={!customName.trim()}
                    className="px-2 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 rounded transition-colors"
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => setShowSaveForm(false)}
                    className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
