"use client";

import { useState, useEffect } from "react";
import { useTranslations } from 'next-intl';

interface EmbedDialogProps {
  animationId: string;
  open: boolean;
  onClose: () => void;
}

type Tab = "player" | "iframe" | "json";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://lottie.kagura-agent.com";

export default function EmbedDialog({
  animationId,
  open,
  onClose,
}: EmbedDialogProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<Tab>("player");
  const [copied, setCopied] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reset state when dialog opens (derived state pattern)
  if (open && !prevOpen) {
    setActiveTab("player");
    setCopied(false);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  if (!open) return null;

  const snippets: Record<Tab, string> = {
    player: `<script src="https://unpkg.com/@dotlottie/player-component@2/dist/dotlottie-player.mjs" type="module"></script>\n<dotlottie-player src="${BASE_URL}/api/animations/${animationId}/json" autoplay loop style="width:300px;height:300px" aria-label="Lottie animation"></dotlottie-player>`,
    iframe: `<iframe src="${BASE_URL}/embed/${animationId}" width="400" height="400" style="border:none" allowtransparency="true" title="Lottie animation"></iframe>`,
    json: `${BASE_URL}/api/animations/${animationId}/json`,
  };

  const tabLabels: Record<Tab, string> = {
    player: t('share.tabPlayer'),
    iframe: t('share.tabIframe'),
    json: t('share.tabJsonUrl'),
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[90vw] max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">
            {t('share.embedAnimation')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {(["player", "iframe", "json"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setCopied(false);
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-zinc-100 border-b-2 border-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Snippet */}
        <div className="p-5">
          <div className="relative">
            <pre className="bg-zinc-800 rounded-lg p-4 text-sm text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {snippets[activeTab]}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
            >
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
