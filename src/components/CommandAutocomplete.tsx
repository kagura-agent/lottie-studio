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
  { command: "/spring", description: "Spring physics animation (e.g. /spring --preset bouncy --property scale)", hasParams: true },
  { command: "/duration", description: "Set animation duration (e.g. /duration 2s)", hasParams: true },
  { command: "/goto", description: "Seek to frame/time (e.g. /goto 30, /goto 1.5s, /goto 50%)", hasParams: true },
  { command: "/loop", description: "Loop mode", hasParams: false },
  { command: "/once", description: "Play once", hasParams: false },
  { command: "/export", description: "Export (gif, video, json, dotlottie)", hasParams: true },
  { command: "/fade", description: "Fade in/out/pulse opacity transitions (e.g. /fade in --duration 2 --easing ease-in)", hasParams: true },
  { command: "/undo", description: "Undo last change", hasParams: false },
  { command: "/redo", description: "Redo", hasParams: false },
  { command: "/resize", description: "Resize canvas (e.g. /resize 800x600)", hasParams: true },
  { command: "/bg", description: "Set background color (e.g. /bg #ff0000)", hasParams: true },
  { command: "/fullscreen", description: "Toggle fullscreen", hasParams: false },
  { command: "/optimize", description: "Optimize animation (reduce file size)", hasParams: false },
  { command: "/style", description: "Apply visual style — no args to list, preset name, or free-form description", hasParams: true },
  { command: "/animate", description: "Apply motion preset (bounce, pulse, shake, float, spin, slide-in, fade-in, elastic, wiggle, typewriter)", hasParams: true },
  { command: "/marker", description: "Add/remove named segments (add, remove, list, clear)", hasParams: true },
  { command: "/compose", description: "Import layers from another animation", hasParams: true },
  { command: "/sequence", description: "Append animation after current one (storyboard)", hasParams: true },
  { command: "/layers", description: "List all layers in the current animation", hasParams: false },
  { command: "/duplicate-layer", description: "Duplicate a layer by name", hasParams: true },
  { command: "/delete-layer", description: "Delete a layer by name", hasParams: true },
  { command: "/rename-layer", description: "Rename a layer (old name → new name)", hasParams: true },
  { command: "/retime", description: "Change animation duration (e.g. /retime 2s, /retime 500ms)", hasParams: true },
  { command: "/presets", description: "Manage animation presets (list, save, delete, rename, info)", hasParams: true },
  { command: "/random", description: "Generate a surprise animation from a random prompt", hasParams: false },
  { command: "/trim", description: "Extract a frame range as the new animation (e.g. /trim 30-60, /trim 1s-2.5s)", hasParams: true },
  { command: "/mirror", description: "Flip animation horizontally or vertically (e.g. /mirror h, /mirror v)", hasParams: true },
  { command: "/rotate", description: "Rotate animation by degrees (e.g. /rotate 90, /rotate 45 ccw)", hasParams: true },
  { command: "/scale", description: "Scale animation elements (e.g. /scale 2x, /scale 0.5x, /scale 150%)", hasParams: true },
  { command: "/color", description: "Color tools: palette, shift, warm, cool, mono, swap, invert, saturate, brighten", hasParams: true },
  { command: "/easing", description: "Apply easing preset to keyframes (linear, ease-in, ease-out, ease-in-out, bounce, elastic, spring, sharp)", hasParams: true },
  { command: "/stagger", description: "Stagger layer timing (e.g. /stagger 200, /stagger 150 reverse, /stagger 100 random)", hasParams: true },
  { command: "/morph", description: "Morph shapes to target (e.g. /morph circle, /morph star --duration 2 --easing ease-in-out)", hasParams: true },
  { command: "/path", description: "Motion path animation (e.g. /path circle --radius 100, /path wave --amplitude 50)", hasParams: true },
  { command: "/particle", description: "Generate particle effects (confetti, snow, sparkle, stars, bubbles, rain, fireworks, hearts)", hasParams: true },
  { command: "/draw", description: "Stroke reveal/path drawing animation (e.g. /draw --duration 2 --easing ease-in-out --reverse)", hasParams: true },
  { command: "/slide", description: "Directional slide in/out (e.g. /slide left, /slide right --out --duration 2 --easing bounce)", hasParams: true },
  { command: "/camera", description: "Add camera movement (zoom, pan, shake, ken-burns)", hasParams: true },
  { command: "/text", description: "Animated text layers (e.g. /text \"Hello\" --style bounce --color #ff0000 --size 48)", hasParams: true },
  { command: "/reverse", description: "Reverse animation playback direction", hasParams: false },
  { command: "/fix", description: "Auto-diagnose and repair common animation issues", hasParams: false },
  { command: "/a11y", description: "Run accessibility audit (flash detection, reduced motion)", hasParams: false },
  { command: "/polish", description: "AI-powered animation polish", hasParams: false },
  { command: "/help", description: "Show available commands", hasParams: false },
  { command: "/variations", description: "Generate multiple options from one prompt (e.g. /variations bouncing ball)", hasParams: true },
  { command: "/wiggle", description: "Continuous organic randomness (e.g. /wiggle --property position --freq 3 --amp 20)", hasParams: true },
  { command: "/theme", description: "Set editor theme colors (set, show, clear)", hasParams: true },
  { command: "/trail", description: "Motion trail/afterimage effect (e.g. /trail 5 --fade exponential --spacing 3)", hasParams: true },
  { command: "/shake", description: "Add shake/vibration effect with decay (intensity, frequency, axis)", hasParams: true },
  { command: "/shadow", description: "Add drop shadow, inner shadow, or glow effect (e.g. /shadow glow --color #ff0 --blur 12)", hasParams: true },
  { command: "/gradient", description: "Animated gradient fill or stroke (e.g. /gradient sunset, /gradient radial --preset aurora --mode stroke)", hasParams: true },
  { command: "/mask", description: "Animated mask reveal/wipe effects (e.g. /mask circle, /mask wipe-right --duration 2 --easing ease-out)", hasParams: true },
  { command: "/blur", description: "Add blur/focus effects (e.g. /blur in --intensity 15, /blur pulse --layer bg)", hasParams: true },
  { command: "/repeat", description: "Array/grid/circle patterns with staggered animation (e.g. /repeat grid --cols 3 --rows 3 --gap 40)", hasParams: true },
  { command: "/3d", description: "3D perspective effects — card flip, rotation, parallax depth (e.g. /3d flip, /3d rotate --axis y)", hasParams: true },
  { command: "/wave", description: "Wave/sine motion effects — sine, ocean, flag, pulse, sound (e.g. /wave ocean --amplitude 40 --layers 4)", hasParams: true },
  { command: "/physics", description: "Physics simulations — gravity, bounce, throw, pendulum, float (e.g. /physics bounce --bounces 5 --damping 0.3)", hasParams: true },
  { command: "/transition", description: "Animated state transitions — fade, slide, wipe, zoom, flip, dissolve (e.g. /transition slide --direction right --duration 800)", hasParams: true },
  { command: "/import", description: "Import animation from URL", hasParams: true },
  { command: "/critique", description: "Get expert feedback on the current animation", hasParams: false },
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
