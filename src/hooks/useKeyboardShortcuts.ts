import { useEffect } from "react";

interface KeyboardShortcutHandlers {
  onUndo: () => void;
  onRedo: () => void;
  onTogglePlay: () => void;
  onSave: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  onSpeedDown?: () => void;
  onSpeedUp?: () => void;
  onShowHelp?: () => void;
  onToggleFullscreen?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + Shift + Z  OR  Ctrl/Cmd + Y → Redo
      if (mod && ((e.key === "z" || e.key === "Z") && e.shiftKey || e.key === "y")) {
        e.preventDefault();
        handlers.onRedo();
        return;
      }

      // Ctrl/Cmd + Z → Undo
      if (mod && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        handlers.onUndo();
        return;
      }

      // Ctrl/Cmd + S → Save
      if (mod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handlers.onSave();
        return;
      }

      // Ctrl/Cmd + / → Show keyboard shortcuts help
      if (mod && e.key === "/" && handlers.onShowHelp) {
        e.preventDefault();
        handlers.onShowHelp();
        return;
      }

      // Everything below is blocked when focus is in an editable element
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable;
      if (isEditable) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlers.onTogglePlay();
          break;
        case "f":
        case "F":
          handlers.onToggleFullscreen?.();
          break;
        case "ArrowLeft":
          handlers.onSeekBackward?.();
          break;
        case "ArrowRight":
          handlers.onSeekForward?.();
          break;
        case "Home":
          handlers.onSeekStart?.();
          break;
        case "End":
          handlers.onSeekEnd?.();
          break;
        case "[":
          handlers.onSpeedDown?.();
          break;
        case "]":
          handlers.onSpeedUp?.();
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handlers]);
}
