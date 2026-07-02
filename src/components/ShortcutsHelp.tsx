"use client";

import { useEffect, useRef, useMemo } from "react";
import { useTranslations } from 'next-intl';
import { resetOnboarding } from "./OnboardingTour";

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

function useIsMac() {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-mono font-medium">
      {children}
    </kbd>
  );
}

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const isMac = useIsMac();
  const mod = isMac ? "⌘" : "Ctrl";
  const t = useTranslations();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const groups: ShortcutGroup[] = [
    {
      title: t('shortcutsHelp.general'),
      shortcuts: [
        { keys: [mod, "S"], description: t('shortcutsHelp.save') },
        { keys: [mod, "Z"], description: t('shortcutsHelp.undo') },
        { keys: [mod, "Shift", "Z"], description: t('shortcutsHelp.redo') },
        { keys: [mod, "/"], description: t('shortcutsHelp.showShortcuts') },
        { keys: [mod, "K"], description: t('shortcutsHelp.commandPalette') },
      ],
    },
    {
      title: t('shortcutsHelp.playback'),
      shortcuts: [
        { keys: ["Space"], description: t('shortcutsHelp.togglePlay') },
        { keys: ["["], description: t('shortcutsHelp.speedDown') },
        { keys: ["]"], description: t('shortcutsHelp.speedUp') },
        { keys: ["F"], description: t('shortcutsHelp.toggleFullscreen') },
        { keys: ["←"], description: t('shortcutsHelp.prevFrame') },
        { keys: ["→"], description: t('shortcutsHelp.nextFrame') },
        { keys: ["Home"], description: "Jump to start" },
        { keys: ["End"], description: "Jump to end" },
      ],
    },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-zinc-100 text-base font-semibold">{t('shortcutsHelp.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label={t('common.close')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between"
                  >
                    <span className="text-zinc-300 text-sm">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-zinc-500 text-xs">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-zinc-500 text-xs">
            {"Playback shortcuts are disabled when typing in text fields"}
          </p>
          <button
            onClick={() => {
              resetOnboarding();
              onClose();
              // Force re-render by reloading the page
              window.location.reload();
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap ml-3"
          >
            {t('onboarding.restartTour')}
          </button>
        </div>
      </div>
    </div>
  );
}
