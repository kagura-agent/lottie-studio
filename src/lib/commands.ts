// Slash command parser for chat panel

export const VALID_STYLES = [
  "neon",
  "pastel",
  "monochrome",
  "gradient",
  "retro",
  "minimal",
  "bold",
  "nature",
] as const;

export type StyleName = (typeof VALID_STYLES)[number];

export const VALID_ANIMATIONS = [
  "bounce",
  "pulse",
  "shake",
  "float",
  "spin",
  "slide-in",
  "fade-in",
  "elastic",
  "wiggle",
  "typewriter",
] as const;

export type AnimationPreset = (typeof VALID_ANIMATIONS)[number];

export type Command =
  | { type: "play" }
  | { type: "pause" }
  | { type: "speed"; speed: number }
  | { type: "loop" }
  | { type: "once" }
  | { type: "export_gif" }
  | { type: "export_apng" }
  | { type: "export_video" }
  | { type: "export_json" }
  | { type: "export_dotlottie" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "duration"; durationMs: number }
  | { type: "resize"; width: number; height: number }
  | { type: "background"; color: string }
  | { type: "fullscreen" }
  | { type: "optimize" }
  | { type: "goto"; target: { value: number; unit: "frame" | "seconds" | "ms" | "percent" } }
  | { type: "style"; style: StyleName }
  | { type: "animate"; animation: AnimationPreset }
  | { type: "marker_add"; name: string; startFrame: number; endFrame: number }
  | { type: "marker_remove"; name: string }
  | { type: "marker_list" }
  | { type: "marker_clear" }
  | { type: "compose"; id: string }
  | { type: "sequence"; id: string }
  | { type: "help" }
  | { type: "error"; message: string };

export function parseCommand(input: string): Command | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "play":
      return { type: "play" };

    case "pause":
      return { type: "pause" };

    case "speed": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /speed <number> (e.g. /speed 2x)" };
      }
      const raw = args[0].replace(/x$/i, "");
      const n = parseFloat(raw);
      if (isNaN(n) || n <= 0) {
        return { type: "error", message: `Invalid speed value: "${args[0]}"` };
      }
      return { type: "speed", speed: n };
    }

    case "loop":
      return { type: "loop" };

    case "once":
      return { type: "once" };

    case "export": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /export gif|video|json|dotlottie" };
      }
      const format = args[0].toLowerCase();
      switch (format) {
        case "gif":
          return { type: "export_gif" };
        case "apng":
          return { type: "export_apng" };
        case "video":
          return { type: "export_video" };
        case "json":
          return { type: "export_json" };
        case "dotlottie":
          return { type: "export_dotlottie" };
        default:
          return { type: "error", message: `Unknown export format: "${args[0]}". Use gif, apng, video, json, or dotlottie.` };
      }
    }

    case "undo":
      return { type: "undo" };

    case "redo":
      return { type: "redo" };

    case "duration": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /duration <time> (e.g. /duration 2s, /duration 500ms)" };
      }
      const raw = args[0].toLowerCase();
      let ms: number;
      if (raw.endsWith("ms")) {
        ms = parseFloat(raw.slice(0, -2));
      } else if (raw.endsWith("s")) {
        ms = parseFloat(raw.slice(0, -1)) * 1000;
      } else {
        ms = parseFloat(raw) * 1000; // bare number treated as seconds
      }
      if (isNaN(ms) || ms <= 0) {
        return { type: "error", message: `Invalid duration: "${args[0]}". Use a positive value like 2s or 500ms.` };
      }
      return { type: "duration", durationMs: ms };
    }

    case "resize": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /resize <width>x<height> (e.g. /resize 800x600)" };
      }
      const match = args[0].match(/^(\d+)x(\d+)$/i);
      if (!match) {
        return { type: "error", message: `Invalid resize format: "${args[0]}". Use WxH (e.g. 800x600).` };
      }
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      if (width <= 0 || height <= 0) {
        return { type: "error", message: "Width and height must be positive numbers." };
      }
      return { type: "resize", width, height };
    }

    case "bg":
    case "background": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /bg <color> (e.g. /bg #ff0000)" };
      }
      return { type: "background", color: args[0] };
    }

    case "fullscreen":
      return { type: "fullscreen" };

    case "optimize":
      return { type: "optimize" };

    case "goto": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /goto <target> (e.g. /goto 30, /goto 1.5s, /goto 50%)" };
      }
      const raw = args[0].toLowerCase();
      let value: number;
      let unit: "frame" | "seconds" | "ms" | "percent";
      if (raw.endsWith("%")) {
        value = parseFloat(raw.slice(0, -1));
        unit = "percent";
        if (isNaN(value) || value < 0 || value > 100) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Percentage must be 0-100.` };
        }
      } else if (raw.endsWith("ms")) {
        value = parseFloat(raw.slice(0, -2));
        unit = "ms";
        if (isNaN(value) || value < 0) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Time must be non-negative.` };
        }
      } else if (raw.endsWith("s")) {
        value = parseFloat(raw.slice(0, -1));
        unit = "seconds";
        if (isNaN(value) || value < 0) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Time must be non-negative.` };
        }
      } else {
        value = parseFloat(raw);
        unit = "frame";
        if (isNaN(value) || value < 0 || !Number.isFinite(value)) {
          return { type: "error", message: `Invalid goto target: "${args[0]}". Frame must be a non-negative number.` };
        }
      }
      return { type: "goto", target: { value, unit } };
    }

    case "style": {
      if (args.length === 0) {
        return { type: "error", message: `Usage: /style <name>. Available styles: ${VALID_STYLES.join(", ")}` };
      }
      const styleName = args[0].toLowerCase();
      if (VALID_STYLES.includes(styleName as StyleName)) {
        return { type: "style", style: styleName as StyleName };
      }
      return { type: "error", message: `Unknown style "${args[0]}". Available styles: ${VALID_STYLES.join(", ")}` };
    }

    case "animate": {
      if (args.length === 0) {
        return { type: "error", message: `Usage: /animate <preset>. Available presets: ${VALID_ANIMATIONS.join(", ")}` };
      }
      const animName = args[0].toLowerCase();
      if (VALID_ANIMATIONS.includes(animName as AnimationPreset)) {
        return { type: "animate", animation: animName as AnimationPreset };
      }
      return { type: "error", message: `Unknown animation preset "${args[0]}". Available presets: ${VALID_ANIMATIONS.join(", ")}` };
    }

    case "marker": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /marker add <name> <start>-<end> | /marker remove <name> | /marker list | /marker clear" };
      }
      const subcommand = args[0].toLowerCase();
      switch (subcommand) {
        case "add": {
          if (args.length < 3) {
            return { type: "error", message: "Usage: /marker add <name> <startFrame>-<endFrame>" };
          }
          const markerName = args[1];
          const rangeStr = args[2];
          const rangeMatch = rangeStr.match(/^(\d+)-(\d+)$/);
          if (!rangeMatch) {
            return { type: "error", message: `Invalid frame range: "${rangeStr}". Use format: <start>-<end> (e.g. 0-30)` };
          }
          const startFrame = parseInt(rangeMatch[1], 10);
          const endFrame = parseInt(rangeMatch[2], 10);
          if (startFrame >= endFrame) {
            return { type: "error", message: `Start frame must be less than end frame. Got ${startFrame}-${endFrame}.` };
          }
          return { type: "marker_add", name: markerName, startFrame, endFrame };
        }
        case "remove":
        case "delete": {
          if (args.length < 2) {
            return { type: "error", message: "Usage: /marker remove <name>" };
          }
          return { type: "marker_remove", name: args[1] };
        }
        case "list":
          return { type: "marker_list" };
        case "clear":
          return { type: "marker_clear" };
        default:
          return { type: "error", message: `Unknown marker subcommand: "${subcommand}". Use add, remove, list, or clear.` };
      }
    }

    case "compose": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /compose <animation-id>" };
      }
      return { type: "compose", id: args[0] };
    }

    case "sequence": {
      if (args.length === 0) {
        return { type: "error", message: "Usage: /sequence <animation-id>" };
      }
      return { type: "sequence", id: args[0] };
    }

    case "help":
    case "commands":
    case "?":
      return { type: "help" };

    default:
      return null;
  }
}
