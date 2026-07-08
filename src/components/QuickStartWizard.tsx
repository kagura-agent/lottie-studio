"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "lottie-wizard-skip";

const CATEGORIES = [
  { key: "ui", emoji: "🔘" },
  { key: "motion", emoji: "⚡" },
  { key: "text", emoji: "✍️" },
  { key: "nature", emoji: "🌿" },
  { key: "abstract", emoji: "🎨" },
  { key: "social", emoji: "📱" },
  { key: "branding", emoji: "💎" },
  { key: "custom", emoji: "✨" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

interface QuickStartWizardProps {
  onSelect: (prompt: string) => void;
  onSkip: () => void;
}

export default function QuickStartWizard({
  onSelect,
  onSkip,
}: QuickStartWizardProps) {
  const t = useTranslations("quickStart");
  const [visible, setVisible] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [customText, setCustomText] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const gridRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const dismiss = useCallback(
    (prompt?: string) => {
      if (dontShow) {
        try {
          localStorage.setItem(STORAGE_KEY, "true");
        } catch {}
      }
      setVisible(false);
      setTimeout(() => {
        if (prompt) onSelect(prompt);
        else onSkip();
      }, 250);
    },
    [dontShow, onSelect, onSkip]
  );

  const handleCategoryClick = (key: CategoryKey) => {
    if (key === "custom") {
      customInputRef.current?.focus();
      return;
    }
    dismiss(t(`categories.${key}.prompt`));
  };

  const handleCustomSubmit = () => {
    const text = customText.trim();
    if (text) dismiss(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      dismiss();
      return;
    }

    const cards = gridRef.current?.querySelectorAll<HTMLElement>("[data-card]");
    if (!cards?.length) return;

    let next = focusedIndex;
    const cols = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 2 : 1;

    switch (e.key) {
      case "ArrowRight":
        next = Math.min(focusedIndex + 1, cards.length - 1);
        break;
      case "ArrowLeft":
        next = Math.max(focusedIndex - 1, 0);
        break;
      case "ArrowDown":
        next = Math.min(focusedIndex + cols, cards.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(focusedIndex - cols, 0);
        break;
      default:
        return;
    }

    e.preventDefault();
    setFocusedIndex(next);
    cards[next]?.focus();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-250 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 shadow-2xl shadow-purple-950/20 transition-all duration-250 ${
          visible
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
      >
        <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.08),transparent_60%)] pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {t("title")}
            </h2>
            <p className="mt-2 text-sm text-gray-400">{t("subtitle")}</p>
          </div>

          <div
            ref={gridRef}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            role="listbox"
            aria-label={t("title")}
            onKeyDown={handleKeyDown}
          >
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.key}
                data-card
                role="option"
                aria-selected={focusedIndex === i}
                tabIndex={focusedIndex === i || (focusedIndex === -1 && i === 0) ? 0 : -1}
                className="group relative flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center transition-all duration-200 hover:scale-[1.04] hover:border-purple-500/30 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-purple-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 active:scale-[0.98]"
                onClick={() => handleCategoryClick(cat.key)}
                onFocus={() => setFocusedIndex(i)}
              >
                <span className="text-3xl transition-transform duration-200 group-hover:scale-110">
                  {cat.emoji}
                </span>
                <span className="text-sm font-medium text-white">
                  {t(`categories.${cat.key}.name`)}
                </span>
                <span className="text-xs text-gray-500 leading-snug">
                  {t(`categories.${cat.key}.description`)}
                </span>
              </button>
            ))}
          </div>

          {/* Custom prompt input */}
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                ref={customInputRef}
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                  if (e.key === "Escape") dismiss();
                }}
                placeholder={t("customPlaceholder")}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-purple-500/50 focus:bg-white/[0.07]"
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customText.trim()}
                className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600"
              >
                {t("go")}
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="rounded border-gray-600 bg-transparent text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
              />
              {t("dontShowAgain")}
            </label>

            <button
              onClick={() => dismiss()}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              {t("skip")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
