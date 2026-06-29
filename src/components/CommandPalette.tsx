"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { COMMANDS, type CommandDef } from "@/components/CommandAutocomplete";
import {
  parseCommand,
  VALID_STYLES,
  VALID_ANIMATIONS,
  type Command,
  type StyleName,
  type AnimationPreset,
} from "@/lib/commands";

// --- Types ---

type PaletteItemKind =
  | "command"
  | "navigation"
  | "action"
  | "export"
  | "style"
  | "animation";

interface PaletteItem {
  id: string;
  kind: PaletteItemKind;
  label: string;
  description: string;
  shortcut?: string[];
  commandDef?: CommandDef;
  action?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onCommand: (command: Command) => void;
  onInsertText: (text: string) => void;
  onNavigate: (path: string) => void;
  onSave: () => void;
  onToggleFullscreen: () => void;
  onToggleJson: () => void;
  onToggleLayers: () => void;
  onShowShortcuts: () => void;
  onExportJson: () => void;
  onExportGif: () => void;
  onExportApng: () => void;
  onExportVideo: () => void;
  onExportDotLottie: () => void;
}

// --- Helpers ---

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-mono font-medium">
      {children}
    </kbd>
  );
}

function useIsMac() {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);
}

const GROUP_ORDER: PaletteItemKind[] = [
  "command",
  "navigation",
  "action",
  "export",
  "style",
  "animation",
];

// --- Component ---

export default function CommandPalette({
  open,
  onClose,
  onCommand,
  onInsertText,
  onNavigate,
  onSave,
  onToggleFullscreen,
  onToggleJson,
  onToggleLayers,
  onShowShortcuts,
  onExportJson,
  onExportGif,
  onExportApng,
  onExportVideo,
  onExportDotLottie,
}: CommandPaletteProps) {
  const t = useTranslations();
  const isMac = useIsMac();
  const mod = isMac ? "\u2318" : "Ctrl";

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Build all palette items
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    // 1. Slash commands
    for (const cmd of COMMANDS) {
      items.push({
        id: `cmd-${cmd.command}`,
        kind: "command",
        label: cmd.command,
        description: cmd.description,
        commandDef: cmd,
      });
    }

    // 2. Navigation
    items.push(
      { id: "nav-gallery", kind: "navigation", label: t("commandPalette.goToGallery"), description: t("commandPalette.goToGalleryDesc") },
      { id: "nav-explore", kind: "navigation", label: t("commandPalette.goToExplore"), description: t("commandPalette.goToExploreDesc") },
      { id: "nav-templates", kind: "navigation", label: t("commandPalette.goToTemplates"), description: t("commandPalette.goToTemplatesDesc") },
      { id: "nav-docs", kind: "navigation", label: t("commandPalette.goToDocs"), description: t("commandPalette.goToDocsDesc") },
    );

    // 3. Editor actions
    items.push(
      { id: "action-save", kind: "action", label: t("commandPalette.save"), description: t("commandPalette.saveDesc"), shortcut: [mod, "S"] },
      { id: "action-fullscreen", kind: "action", label: t("commandPalette.fullscreen"), description: t("commandPalette.fullscreenDesc"), shortcut: ["F"] },
      { id: "action-toggle-json", kind: "action", label: t("commandPalette.toggleJson"), description: t("commandPalette.toggleJsonDesc") },
      { id: "action-toggle-layers", kind: "action", label: t("commandPalette.toggleLayers"), description: t("commandPalette.toggleLayersDesc") },
      { id: "action-shortcuts", kind: "action", label: t("commandPalette.showShortcuts"), description: t("commandPalette.showShortcutsDesc"), shortcut: [mod, "/"] },
    );

    // 4. Export formats
    items.push(
      { id: "export-json", kind: "export", label: t("commandPalette.exportJson"), description: t("commandPalette.exportJsonDesc") },
      { id: "export-gif", kind: "export", label: t("commandPalette.exportGif"), description: t("commandPalette.exportGifDesc") },
      { id: "export-video", kind: "export", label: t("commandPalette.exportVideo"), description: t("commandPalette.exportVideoDesc") },
      { id: "export-apng", kind: "export", label: t("commandPalette.exportApng"), description: t("commandPalette.exportApngDesc") },
      { id: "export-dotlottie", kind: "export", label: t("commandPalette.exportDotLottie"), description: t("commandPalette.exportDotLottieDesc") },
    );

    // 5. Style presets
    for (const style of VALID_STYLES) {
      items.push({
        id: `style-${style}`,
        kind: "style",
        label: style,
        description: t("commandPalette.applyStyleDesc", { style }),
      });
    }

    // 6. Animation presets
    for (const anim of VALID_ANIMATIONS) {
      items.push({
        id: `anim-${anim}`,
        kind: "animation",
        label: anim,
        description: t("commandPalette.applyAnimationDesc", { animation: anim }),
      });
    }

    return items;
  }, [t, mod]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Group filtered items
  const grouped = useMemo(() => {
    const groups: { kind: PaletteItemKind; items: PaletteItem[] }[] = [];
    for (const kind of GROUP_ORDER) {
      const items = filtered.filter((i) => i.kind === kind);
      if (items.length > 0) groups.push({ kind, items });
    }
    return groups;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Group label i18n
  const groupLabel = useCallback(
    (kind: PaletteItemKind) => {
      switch (kind) {
        case "command":
          return t("commandPalette.groupCommands");
        case "navigation":
          return t("commandPalette.groupNavigation");
        case "action":
          return t("commandPalette.groupActions");
        case "export":
          return t("commandPalette.groupExport");
        case "style":
          return t("commandPalette.groupStyles");
        case "animation":
          return t("commandPalette.groupAnimations");
      }
    },
    [t]
  );

  // Execute selected item
  const executeItem = useCallback(
    (item: PaletteItem) => {
      onClose();

      switch (item.kind) {
        case "command": {
          const def = item.commandDef!;
          if (def.hasParams) {
            // Insert command text into chat so user can type params
            onInsertText(def.command + " ");
          } else {
            const cmd = parseCommand(def.command);
            if (cmd && cmd.type !== "error") {
              onCommand(cmd);
            }
          }
          break;
        }
        case "navigation": {
          const pathMap: Record<string, string> = {
            "nav-gallery": "/",
            "nav-explore": "/explore",
            "nav-templates": "/",
            "nav-docs": "/docs",
          };
          const path = pathMap[item.id];
          if (path) onNavigate(path);
          break;
        }
        case "action": {
          switch (item.id) {
            case "action-save":
              onSave();
              break;
            case "action-fullscreen":
              onToggleFullscreen();
              break;
            case "action-toggle-json":
              onToggleJson();
              break;
            case "action-toggle-layers":
              onToggleLayers();
              break;
            case "action-shortcuts":
              onShowShortcuts();
              break;
          }
          break;
        }
        case "export": {
          switch (item.id) {
            case "export-json":
              onExportJson();
              break;
            case "export-gif":
              onExportGif();
              break;
            case "export-video":
              onExportVideo();
              break;
            case "export-apng":
              onExportApng();
              break;
            case "export-dotlottie":
              onExportDotLottie();
              break;
          }
          break;
        }
        case "style": {
          const styleName = item.label as StyleName;
          onCommand({ type: "style", style: styleName });
          break;
        }
        case "animation": {
          const animName = item.label as AnimationPreset;
          onCommand({ type: "animate", animation: animName });
          break;
        }
      }
    },
    [
      onClose,
      onCommand,
      onInsertText,
      onNavigate,
      onSave,
      onToggleFullscreen,
      onToggleJson,
      onToggleLayers,
      onShowShortcuts,
      onExportJson,
      onExportGif,
      onExportApng,
      onExportVideo,
      onExportDotLottie,
    ]
  );

  // Reset state when opened (adjust during render)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setQuery("");
    setSelectedIndex(0);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Focus input when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Clamp selectedIndex when filtered list shrinks (adjust during render)
  if (selectedIndex >= flatList.length && flatList.length > 0) {
    setSelectedIndex(flatList.length - 1);
  } else if (flatList.length === 0 && selectedIndex !== 0) {
    setSelectedIndex(0);
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= flatList.length - 1 ? 0 : prev + 1
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? flatList.length - 1 : prev - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (flatList[selectedIndex]) {
            executeItem(flatList[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatList, selectedIndex, executeItem, onClose]
  );

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("commandPalette.title")}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[60vh]"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-400 shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t("commandPalette.searchPlaceholder")}
            className="flex-1 bg-transparent text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-listbox"
            aria-activedescendant={
              flatList[selectedIndex]
                ? `cp-item-${flatList[selectedIndex].id}`
                : undefined
            }
            autoComplete="off"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Kbd>Esc</Kbd>
          </div>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-listbox"
          role="listbox"
          aria-label={t("commandPalette.results")}
          className="overflow-y-auto flex-1"
        >
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              {t("commandPalette.noResults")}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.kind}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
                    {groupLabel(group.kind)}
                  </span>
                </div>
                {group.items.map((item) => {
                  const thisIndex = flatIndex++;
                  const isSelected = thisIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      id={`cp-item-${item.id}`}
                      ref={(el) => {
                        itemRefs.current[thisIndex] = el;
                      }}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(thisIndex)}
                      className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm transition-colors ${
                        isSelected
                          ? "bg-indigo-600/40 text-zinc-100"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {item.kind === "command" ? (
                        <span className="font-mono font-medium text-indigo-300 shrink-0">
                          {item.label}
                        </span>
                      ) : item.kind === "style" || item.kind === "animation" ? (
                        <span className="font-mono font-medium text-violet-300 shrink-0 capitalize">
                          {item.label}
                        </span>
                      ) : (
                        <span className="font-medium text-zinc-100 shrink-0">
                          {item.label}
                        </span>
                      )}
                      <span className="text-zinc-400 text-xs truncate flex-1">
                        {item.description}
                      </span>
                      {item.shortcut && (
                        <div className="flex items-center gap-1 shrink-0">
                          {item.shortcut.map((key, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span className="text-zinc-500 text-xs">+</span>
                              )}
                              <Kbd>{key}</Kbd>
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-4 text-zinc-500 text-xs">
          <span className="flex items-center gap-1">
            <Kbd>&uarr;</Kbd>
            <Kbd>&darr;</Kbd>
            {t("commandPalette.navigate")}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>&crarr;</Kbd>
            {t("commandPalette.select")}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd>
            {t("commandPalette.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
