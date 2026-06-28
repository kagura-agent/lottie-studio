"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface CommandDef {
  command: string;
  description: string;
  hasParams: boolean;
}

export const COMMANDS: CommandDef[] = [
  { command: "/play", description: "Resume playback", hasParams: false },
  { command: "/pause", description: "Pause playback", hasParams: false },
  { command: "/speed", description: "Set playback speed (e.g. /speed 2x)", hasParams: true },
  { command: "/duration", description: "Set animation duration (e.g. /duration 2s)", hasParams: true },
  { command: "/goto", description: "Seek to frame/time (e.g. /goto 30, /goto 1.5s, /goto 50%)", hasParams: true },
  { command: "/loop", description: "Loop mode", hasParams: false },
  { command: "/once", description: "Play once", hasParams: false },
  { command: "/export", description: "Export (gif, video, json, dotlottie)", hasParams: true },
  { command: "/undo", description: "Undo last change", hasParams: false },
  { command: "/redo", description: "Redo", hasParams: false },
  { command: "/resize", description: "Resize canvas (e.g. /resize 800x600)", hasParams: true },
  { command: "/bg", description: "Set background color (e.g. /bg #ff0000)", hasParams: true },
  { command: "/fullscreen", description: "Toggle fullscreen", hasParams: false },
  { command: "/optimize", description: "Optimize animation (reduce file size)", hasParams: false },
  { command: "/style", description: "Apply visual style (neon, pastel, monochrome, gradient, retro, minimal, bold, nature)", hasParams: true },
  { command: "/animate", description: "Apply motion preset (bounce, pulse, shake, float, spin, slide-in, fade-in, elastic, wiggle, typewriter)", hasParams: true },
  { command: "/marker", description: "Add/remove named segments (add, remove, list, clear)", hasParams: true },
  { command: "/compose", description: "Import layers from another animation", hasParams: true },
  { command: "/sequence", description: "Append animation after current one (storyboard)", hasParams: true },
];

export function filterCommands(query: string): CommandDef[] {
  const normalized = query.toLowerCase();
  if (normalized === "/") return COMMANDS;
  return COMMANDS.filter((cmd) => cmd.command.startsWith(normalized));
}

interface CommandAutocompleteProps {
  query: string;
  visible: boolean;
  onSelect: (command: CommandDef) => void;
  onDismiss: () => void;
}

export default function CommandAutocomplete({
  query,
  visible,
  onSelect,
  onDismiss,
}: CommandAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = filterCommands(query);

  // Reset selection when query changes (adjust state during render)
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  // Scroll selected item into view
  useEffect(() => {
    const item = itemRefs.current[selectedIndex];
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? filtered.length - 1 : prev - 1
          );
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= filtered.length - 1 ? 0 : prev + 1
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          onSelect(filtered[selectedIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onDismiss();
          break;
      }
    },
    [visible, filtered, selectedIndex, onSelect, onDismiss]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener("keydown", handleKeyDown, true);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [visible, handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Command suggestions"
      className="absolute bottom-full left-0 right-0 mb-1 mx-3 max-h-[240px] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl z-50"
    >
      {filtered.map((cmd, index) => (
        <button
          key={cmd.command}
          ref={(el) => { itemRefs.current[index] = el; }}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
            index === selectedIndex
              ? "bg-indigo-600/40 text-zinc-100"
              : "text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <span className="font-mono font-medium text-indigo-300 shrink-0">
            {cmd.command}
          </span>
          <span className="text-zinc-400 text-xs truncate">
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  );
}
