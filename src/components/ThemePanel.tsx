"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDesignTokens, type DesignTokens } from "@/contexts/DesignTokensContext";

const WEB_SAFE_FONTS = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Impact",
];

interface PresetPalette {
  name: string;
  tokens: Partial<DesignTokens>;
}

const PRESET_PALETTES: PresetPalette[] = [
  {
    name: "Corporate Blue",
    tokens: { primary: "#3B82F6", secondary: "#1E40AF", accent: "#60A5FA", background: "#F8FAFC" },
  },
  {
    name: "Warm Sunset",
    tokens: { primary: "#F97316", secondary: "#DC2626", accent: "#FBBF24", background: "#FFFBEB" },
  },
  {
    name: "Neon",
    tokens: { primary: "#06B6D4", secondary: "#8B5CF6", accent: "#F43F5E", background: "#0F172A" },
  },
  {
    name: "Earthy",
    tokens: { primary: "#78716C", secondary: "#A16207", accent: "#65A30D", background: "#FAFAF9" },
  },
];

const TOKEN_KEYS: (keyof DesignTokens)[] = ["primary", "secondary", "accent", "background"];

interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ThemePanel({ open, onClose }: ThemePanelProps) {
  const t = useTranslations("theme");
  const { tokens, setToken, clearTokens } = useDesignTokens();
  const [editingKey, setEditingKey] = useState<keyof DesignTokens | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick as unknown as EventListener);
    return () => document.removeEventListener("mousedown", handleClick as unknown as EventListener);
  }, [open, onClose]);

  const handleColorChange = useCallback(
    (key: keyof DesignTokens, value: string) => {
      setToken(key, value);
    },
    [setToken]
  );

  const handleApplyPreset = useCallback(
    (preset: PresetPalette) => {
      for (const [key, value] of Object.entries(preset.tokens)) {
        if (value) setToken(key as keyof DesignTokens, value);
      }
    },
    [setToken]
  );

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-12 right-4 z-50 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{t("title")}</h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 text-lg leading-none"
          aria-label={t("close")}
        >
          ×
        </button>
      </div>

      {/* Color tokens */}
      <div className="space-y-2">
        {TOKEN_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 w-20 capitalize">{t(key)}</label>
            <div className="relative flex-1 flex items-center gap-1">
              <input
                type="color"
                value={tokens[key] || "#000000"}
                onChange={(e) => handleColorChange(key, e.target.value)}
                className="w-7 h-7 rounded border border-zinc-600 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={tokens[key] || ""}
                placeholder={t("noColor")}
                onChange={(e) => handleColorChange(key, e.target.value)}
                onFocus={() => setEditingKey(key)}
                onBlur={() => setEditingKey(null)}
                className={`flex-1 text-xs px-2 py-1 rounded bg-zinc-800 border text-zinc-200 placeholder-zinc-500 ${
                  editingKey === key ? "border-blue-500" : "border-zinc-700"
                }`}
              />
              {tokens[key] && (
                <button
                  onClick={() => setToken(key, "")}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                  title={t("remove")}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Font selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-400 w-20">{t("font")}</label>
        <select
          value={tokens.font || ""}
          onChange={(e) => setToken("font", e.target.value)}
          className="flex-1 text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200"
        >
          <option value="">{t("defaultFont")}</option>
          {WEB_SAFE_FONTS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>

      {/* Preset palettes */}
      <div className="space-y-1.5">
        <p className="text-xs text-zinc-400 font-medium">{t("presets")}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESET_PALETTES.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleApplyPreset(preset)}
              className="text-xs px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              <span className="flex gap-0.5">
                {Object.values(preset.tokens)
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((color, i) => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full border border-zinc-600"
                      style={{ backgroundColor: color }}
                    />
                  ))}
              </span>
              <span className="truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clear button */}
      <button
        onClick={clearTokens}
        className="w-full text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-red-900/30 border border-zinc-700 hover:border-red-700/50 text-zinc-400 hover:text-red-400 transition-colors"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}

/** Small color circle indicators for the editor header */
export function ThemeIndicator({ onClick }: { onClick: () => void }) {
  const { tokens, hasTokens } = useDesignTokens();
  const t = useTranslations("theme");

  if (!hasTokens) return null;

  const colors = [tokens.primary, tokens.secondary, tokens.accent, tokens.background].filter(
    Boolean
  ) as string[];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-zinc-700/50 transition-colors"
      title={t("indicator")}
    >
      {colors.map((color, i) => (
        <span
          key={i}
          className="w-3 h-3 rounded-full border border-zinc-500"
          style={{ backgroundColor: color }}
        />
      ))}
    </button>
  );
}
